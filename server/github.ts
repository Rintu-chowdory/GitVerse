const GITHUB_API = "https://api.github.com";

type GithubRequestInit = RequestInit & { headers?: Record<string, string> };

async function githubFetch<T>(path: string, init: GithubRequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  return response.json() as Promise<T>;
}

export type GithubRepository = {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  updated_at: string;
  html_url: string;
};

export async function searchPublicRepositories(query: string, page = 1) {
  const data = await githubFetch<{ items: GithubRepository[] }>(`/search/repositories?q=${encodeURIComponent(query || "stars:%3E1000")}&sort=stars&order=desc&page=${page}&per_page=12`);
  return data.items;
}

export async function getRepositorySnapshot(repoRef: string) {
  const [repo, commits, issues, releases, pullRequests] = await Promise.all([
    githubFetch<GithubRepository>(`/repos/${repoRef}`),
    githubFetch<Array<{ sha: string; commit: { message: string; author?: { name?: string; date?: string } } }>>(`/repos/${repoRef}/commits?per_page=8`),
    githubFetch<Array<{ number: number; title: string; state: string; labels: Array<{ name: string }>; created_at: string }>>(`/repos/${repoRef}/issues?state=all&per_page=8`),
    githubFetch<Array<{ tag_name: string; name: string; body: string | null; published_at: string | null }>>(`/repos/${repoRef}/releases?per_page=8`),
    githubFetch<Array<{ number: number; title: string; state: string; user?: { login: string }; created_at: string }>>(`/repos/${repoRef}/pulls?state=all&per_page=8`),
  ]);
  return { repo, commits, issues: issues.filter(issue => !("pull_request" in issue)), releases, pullRequests };
}

export function normalizeRepoRef(repoRef: string) {
  return repoRef.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
}

export type GitVerseDashboardSnapshot = {
  repos: Array<GithubRepository & { activity: number; difficulty: "Beginner" | "Intermediate" | "Advanced" }>;
  activity: Array<{ type: "commit" | "issue" | "release" | "pr"; title: string; repo: string; detail: string; time: string }>;
  streak: { current: number; days: number[] };
  stats: { activeRepositories: number; totalStars: number; openIssues: number; recentReleases: number };
};

function relativeTime(value?: string | null) {
  if (!value) return "Recently";
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"} ago`;
}

export async function getGitVerseDashboard(repoRefs = ["facebook/react", "vercel/next.js", "microsoft/vscode", "tailwindlabs/tailwindcss"]): Promise<GitVerseDashboardSnapshot> {
  const results = await Promise.allSettled(repoRefs.slice(0, 8).map(getRepositorySnapshot));
  const successful = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const repos = successful.map((snapshot, index) => ({
    ...snapshot.repo,
    activity: Math.min(98, Math.max(18, Math.round((snapshot.commits.length * 7 + snapshot.issues.length * 3 + snapshot.pullRequests.length * 4) / 2))),
    difficulty: index % 3 === 0 ? "Advanced" as const : index % 3 === 1 ? "Intermediate" as const : "Beginner" as const,
  }));
  const activity = successful.flatMap(snapshot => [
    ...snapshot.commits.slice(0, 3).map(commit => ({ type: "commit" as const, title: commit.commit.message.split("\\n")[0], repo: snapshot.repo.name, detail: commit.sha.slice(0, 7), time: relativeTime(commit.commit.author?.date) })),
    ...snapshot.issues.slice(0, 2).map(issue => ({ type: "issue" as const, title: issue.title, repo: snapshot.repo.name, detail: `#${issue.number}`, time: relativeTime(issue.created_at) })),
    ...snapshot.releases.slice(0, 1).map(release => ({ type: "release" as const, title: `${release.tag_name} is now available`, repo: snapshot.repo.name, detail: "Latest release", time: relativeTime(release.published_at) })),
    ...snapshot.pullRequests.slice(0, 1).map(pr => ({ type: "pr" as const, title: pr.title, repo: snapshot.repo.name, detail: `#${pr.number}`, time: relativeTime(pr.created_at) })),
  ]).slice(0, 8);
  const counts = new Map<string, number>();
  successful.flatMap(snapshot => snapshot.commits).forEach(commit => {
    const date = commit.commit.author?.date?.slice(0, 10);
    if (date) counts.set(date, (counts.get(date) || 0) + 1);
  });
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    return counts.get(date.toISOString().slice(0, 10)) || 0;
  });
  let current = 0;
  for (let index = days.length - 1; index >= 0 && days[index] > 0; index -= 1) current += 1;
  return {
    repos,
    activity,
    streak: { current, days },
    stats: {
      activeRepositories: repos.length,
      totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
      openIssues: repos.reduce((sum, repo) => sum + repo.open_issues_count, 0),
      recentReleases: successful.reduce((sum, snapshot) => sum + snapshot.releases.length, 0),
    },
  };
}
