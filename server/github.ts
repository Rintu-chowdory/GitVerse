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
