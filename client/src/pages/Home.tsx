import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  ExternalLink,
  Flame,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Github,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Package,
  Pin,
  Plus,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Tag,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Repo = {
  name: string;
  owner: string;
  description: string;
  language: string;
  languageColor: string;
  stars: string;
  forks: string;
  watchers: string;
  issues: number;
  updated: string;
  activity: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  pinned: boolean;
  alerts: { commits: boolean; issues: boolean; releases: boolean };
};

const initialRepos: Repo[] = [
  { name: "nexus-ui", owner: "rintu", description: "A composable React component system for modern products.", language: "TypeScript", languageColor: "#38bdf8", stars: "2.4k", forks: "318", watchers: "64", issues: 8, updated: "12 min ago", activity: 88, difficulty: "Advanced", pinned: true, alerts: { commits: true, issues: true, releases: false } },
  { name: "orbit-api", owner: "rintu-labs", description: "Fast, opinionated API primitives for edge-first applications.", language: "Go", languageColor: "#22c55e", stars: "1.1k", forks: "94", watchers: "31", issues: 3, updated: "2 hours ago", activity: 71, difficulty: "Intermediate", pinned: true, alerts: { commits: true, issues: false, releases: true } },
  { name: "pixel-archive", owner: "rintu", description: "A tiny, searchable archive for visual references and inspiration.", language: "Python", languageColor: "#f59e0b", stars: "486", forks: "52", watchers: "18", issues: 2, updated: "Yesterday", activity: 42, difficulty: "Beginner", pinned: false, alerts: { commits: false, issues: true, releases: false } },
  { name: "shipyard", owner: "rintu-labs", description: "Local developer environments that feel instant and predictable.", language: "Rust", languageColor: "#f97316", stars: "782", forks: "77", watchers: "26", issues: 5, updated: "3 days ago", activity: 62, difficulty: "Advanced", pinned: false, alerts: { commits: true, issues: true, releases: true } },
];

const activity = [
  { type: "commit", icon: GitCommitHorizontal, accent: "purple", title: "refactor: simplify command palette", repo: "nexus-ui", detail: "a81f92c", time: "8 min ago" },
  { type: "pr", icon: GitPullRequest, accent: "green", title: "Add request tracing middleware", repo: "orbit-api", detail: "#184", time: "42 min ago" },
  { type: "release", icon: Tag, accent: "gold", title: "v2.8.0 is now available", repo: "nexus-ui", detail: "Latest release", time: "2 hours ago" },
  { type: "issue", icon: CircleDot, accent: "red", title: "Cache invalidation on route change", repo: "shipyard", detail: "#47", time: "4 hours ago" },
];

const navGroups = [
  { label: "MONITORING", items: [{ label: "Dashboard", icon: LayoutDashboard }, { label: "Repositories", icon: BookOpen }] },
  { label: "ACTIVITY", items: [{ label: "Commits Feed", icon: GitCommitHorizontal }, { label: "Issues Tracker", icon: CircleDot }, { label: "PR Watcher", icon: GitPullRequest }] },
  { label: "TOOLS", items: [{ label: "Release Alerts", icon: Bell }, { label: "Repo Search", icon: Search }, { label: "Analytics", icon: TrendingUp }] },
];

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return <button aria-label={label} onClick={onClick} className="icon-button">{children}</button>;
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: React.ElementType; label: string; value: string; detail: string; tone: string }) {
  return <div className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={18} /></div>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-detail"><TrendingUp size={13} /> {detail}</div>
  </div>;
}

function AlertToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button className={`alert-toggle ${active ? "active" : ""}`} onClick={onClick} title={`${active ? "Disable" : "Enable"} ${label} alerts`}>
    {active ? <Check size={11} /> : <X size={11} />} {label}
  </button>;
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [repos, setRepos] = useState(initialRepos);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedRepoRef, setSelectedRepoRef] = useState<string | null>(null);
  const monitoringQuery = trpc.monitoring.list.useQuery(undefined, { enabled: isAuthenticated });
  const githubSearchQuery = trpc.github.search.useQuery({ query, page: 1 }, { enabled: query.trim().length >= 2 });
  const detailQuery = trpc.github.repository.useQuery({ repoRef: selectedRepoRef || "rintu/nexus-ui" }, { enabled: Boolean(selectedRepoRef) });
  const utils = trpc.useUtils();
  const updateMonitoring = trpc.monitoring.update.useMutation({ onSuccess: () => utils.monitoring.list.invalidate() });
  const persistedByRef = useMemo(() => new Map((monitoringQuery.data ?? []).map(row => [row.monitor.repoRef, row.monitor])), [monitoringQuery.data]);
  const hydratedRepos = useMemo(() => repos.map(repo => {
    const saved = persistedByRef.get(`${repo.owner}/${repo.name}`);
    return saved ? { ...repo, pinned: saved.isPinned, alerts: { commits: saved.alertNewCommits, issues: saved.alertNewIssues, releases: saved.alertNewReleases } } : repo;
  }), [repos, persistedByRef]);
  const filteredRepos = useMemo(() => hydratedRepos.filter(repo => `${repo.name} ${repo.owner} ${repo.language}`.toLowerCase().includes(query.toLowerCase())), [hydratedRepos, query]);
  const displayName = user?.name?.split(" ")[0] || "Rintu";
  const initials = (user?.name || "Rintu S").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();

  const toggleRepo = (name: string, action: "pinned" | "commits" | "issues" | "releases") => {
    const repo = hydratedRepos.find(item => item.name === name);
    if (!repo) return;
    const next = action === "pinned" ? { isPinned: !repo.pinned } : { [action === "commits" ? "alertNewCommits" : action === "issues" ? "alertNewIssues" : "alertNewReleases"]: !repo.alerts[action] };
    setRepos(current => current.map(item => item.name === name ? action === "pinned" ? { ...item, pinned: !item.pinned } : { ...item, alerts: { ...item.alerts, [action]: !item.alerts[action] } } : item));
    if (isAuthenticated) updateMonitoring.mutate({ repoRef: `${repo.owner}/${repo.name}`, ...next });
    toast.success(action === "pinned" ? "Repository pin updated" : "Alert preference updated", { description: name });
  };

  const handleNav = (label: string) => {
    setActiveNav(label);
    if (label !== "Dashboard") toast.info(`${label} view is ready to connect`, { description: "GitHub activity routes are scaffolded for the next data sync." });
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Code2 size={19} /></div><span>Git<span>Verse</span></span><div className="brand-pulse" /></div>
      <div className="workspace-chip"><div className="workspace-avatar">RS</div><div><strong>Personal space</strong><span>github.com/rintu</span></div><ChevronRight size={14} /></div>
      <nav className="side-nav">
        {navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-heading">{group.label}</div>{group.items.map(item => <button key={item.label} className={`nav-item ${activeNav === item.label ? "active" : ""}`} onClick={() => handleNav(item.label)}><item.icon size={17} /><span>{item.label}</span>{item.label === "Repositories" && <span className="nav-count">12</span>}{item.label === "Release Alerts" && <span className="nav-dot" />}</button>)}</div>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item"><Settings2 size={17} /><span>Settings</span></button>
        <div className="profile-card"><div className="profile-avatar">{initials}</div><div className="profile-copy"><strong>{user?.name || "Rintu Saha"}</strong><span>{isAuthenticated ? "Connected account" : "Preview workspace"}</span></div><IconButton label="Profile menu"><MoreHorizontal size={17} /></IconButton></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div><div className="top-actions"><div className={`search-shell ${showSearch ? "expanded" : ""}`}><Search size={16} /><input value={query} onFocus={() => setShowSearch(true)} onChange={e => setQuery(e.target.value)} placeholder="Search repos, commits, issues..." />{query && <IconButton label="Clear search" onClick={() => setQuery("")}><X size={14} /></IconButton>}<kbd>⌘ K</kbd></div><IconButton label="Notifications"><Bell size={18} /><span className="notification-dot" /></IconButton><div className="xp-badge"><Flame size={14} /><span>1,280 XP</span><span className="xp-level">Lv. 8</span></div></div></header>
      {showSearch && query.trim().length >= 2 && githubSearchQuery.data && <div className="search-results"><div className="search-results-head"><span>PUBLIC GITHUB SEARCH</span><button onClick={() => setShowSearch(false)} aria-label="Close search results"><X size={14} /></button></div>{githubSearchQuery.data.slice(0, 5).map(result => <button key={result.full_name} className="search-result" onClick={() => { setQuery(result.full_name); setShowSearch(false); }}><div className="repo-icon"><Github size={14} /></div><div><strong>{result.full_name}</strong><span>{result.language || "Mixed language"} · ★ {result.stargazers_count.toLocaleString()}</span></div><ExternalLink size={13} /></button>)}</div>}
      <div className="page-container">
        <section className="hero-row"><div><div className="eyebrow"><span className="live-dot" /> LIVE WORKSPACE</div><h1>Good morning, {displayName} <span className="wave">👋</span></h1><p>Here’s what’s happening across your monitored repositories.</p></div><button className="outline-button" onClick={() => toast.success("Sync queued", { description: "GitHub activity will refresh in the background." })}><Activity size={15} /> Sync now</button></section>
        <section className="hero-metrics"><div className="hero-metric"><span>12</span><small>Repos Monitored</small></div><div className="hero-divider" /><div className="hero-metric"><span>7 <Flame size={20} /></span><small>Day Streak</small></div><div className="hero-divider" /><div className="hero-metric"><span>Explorer</span><small>Current Rank</small></div><div className="level-progress"><div className="level-heading"><span>Next level</span><strong>1,280 / 1,500 XP</strong></div><div className="progress-track"><div className="progress-fill purple" style={{ width: "85%" }} /></div><span className="level-caption">220 XP to <strong>Navigator</strong></span></div></section>
        <section className="stats-grid"><StatCard icon={GitBranch} label="Active Repositories" value="12" detail="+2 this month" tone="purple" /><StatCard icon={Star} label="Total Stars" value="8.7k" detail="+14.6% this month" tone="gold" /><StatCard icon={AlertCircle} label="Open Issues" value="38" detail="-8.2% this month" tone="red" /><StatCard icon={Rocket} label="Recent Releases" value="24" detail="+6 this month" tone="green" /></section>

        <div className="content-grid"><section className="repos-panel panel"><div className="panel-heading"><div><div className="section-kicker">MONITORED REPOSITORIES</div><h2>My repos <span>({filteredRepos.length})</span></h2></div><div className="heading-actions"><button className="filter-button" onClick={() => setQuery("")}><span className="filter-active" /> All repos <ChevronRight size={14} /></button><IconButton label="Add repository" onClick={() => toast.info("Add repository", { description: "Search public GitHub repositories to start monitoring." })}><Plus size={17} /></IconButton></div></div><div className="repo-list">{filteredRepos.map(repo => <article className="repo-card" key={repo.name}><div className="repo-top"><div className="repo-icon"><Github size={17} /></div><div className="repo-title"><div><h3>{repo.name}</h3><span className="repo-owner">{repo.owner}</span></div><button className={`pin-button ${repo.pinned ? "pinned" : ""}`} aria-label={`${repo.pinned ? "Unpin" : "Pin"} ${repo.name}`} onClick={() => toggleRepo(repo.name, "pinned")}><Pin size={15} /></button></div></div><p className="repo-description">{repo.description}</p><div className="repo-meta"><span><i className="language-dot" style={{ background: repo.languageColor }} />{repo.language}</span><span className={`difficulty ${repo.difficulty.toLowerCase()}`}>{repo.difficulty}</span><span className="updated">Updated {repo.updated}</span></div><div className="repo-activity"><div className="activity-label"><span>Activity level</span><strong>{repo.activity}%</strong></div><div className="progress-track"><div className={`progress-fill ${repo.activity > 75 ? "purple" : repo.activity > 50 ? "blue" : "gold"}`} style={{ width: `${repo.activity}%` }} /></div></div><div className="repo-footer"><div className="repo-stats"><span><Star size={13} /> {repo.stars}</span><span><GitBranch size={13} /> {repo.forks}</span><span><Users size={13} /> {repo.watchers}</span><span><CircleDot size={13} /> {repo.issues}</span></div><div className="alert-controls"><AlertToggle label="C" active={repo.alerts.commits} onClick={() => toggleRepo(repo.name, "commits")} /><AlertToggle label="I" active={repo.alerts.issues} onClick={() => toggleRepo(repo.name, "issues")} /><AlertToggle label="R" active={repo.alerts.releases} onClick={() => toggleRepo(repo.name, "releases")} /></div></div><button className="repo-detail-link" onClick={() => setSelectedRepoRef(`${repo.owner}/${repo.name}`)}>View activity <ExternalLink size={12} /></button></article>)}{filteredRepos.length === 0 && <div className="empty-state"><Search size={24} /><strong>No repositories found</strong><span>Try a different search term.</span></div>}</div></section>

        <aside className="right-column"><section className="panel streak-panel"><div className="panel-heading compact"><div><div className="section-kicker">CONSISTENCY</div><h2>Commit streak</h2></div><button className="text-button">This week <ChevronRight size={13} /></button></div><div className="streak-total"><div className="streak-flame"><Flame size={22} /></div><div><strong>7 days</strong><span>Personal best: 14 days</span></div></div><div className="week-row">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <div className="day-cell" key={`${day}-${index}`}><span>{day}</span><div className={`day-orb ${index < 5 ? "complete" : index === 5 ? "today" : ""}`}>{index < 5 ? <Check size={12} /> : index === 5 ? <Flame size={13} /> : null}</div><small>{[4, 7, 3, 9, 6, 2, 0][index] || "–"}</small></div>)}</div></section><section className="panel activity-panel"><div className="panel-heading compact"><div><div className="section-kicker">LAST 24 HOURS</div><h2>Today’s Activity</h2></div><IconButton label="Activity options"><MoreHorizontal size={17} /></IconButton></div><div className="activity-list">{activity.map(item => <div className="activity-item" key={item.title}><div className={`activity-icon ${item.accent}`}><item.icon size={15} /></div><div className="activity-copy"><strong>{item.title}</strong><span><b>{item.repo}</b> · {item.detail}</span></div><time>{item.time}</time></div>)}</div><button className="view-all" onClick={() => toast.info("Activity feed", { description: "Showing all monitored repository activity." })}>View full activity <ChevronRight size={14} /></button></section><section className="quick-card"><div className="quick-icon"><ShieldCheck size={19} /></div><div><strong>Read-only connection</strong><span>GitVerse only requests safe GitHub access.</span></div><ChevronRight size={16} /></section></aside></div>
      </div>
    </main>
    {selectedRepoRef && <div className="detail-backdrop" onClick={() => setSelectedRepoRef(null)}><section className="detail-drawer" onClick={event => event.stopPropagation()}><div className="detail-drawer-head"><div><div className="section-kicker">REPOSITORY ACTIVITY</div><h2>{selectedRepoRef}</h2></div><IconButton label="Close repository activity" onClick={() => setSelectedRepoRef(null)}><X size={17} /></IconButton></div>{detailQuery.isLoading && <div className="detail-loading">Loading GitHub activity…</div>}{detailQuery.data && <div className="detail-content"><div className="detail-summary"><span><Star size={14} /> {detailQuery.data.repo.stargazers_count.toLocaleString()}</span><span><GitBranch size={14} /> {detailQuery.data.repo.forks_count.toLocaleString()}</span><span><CircleDot size={14} /> {detailQuery.data.repo.open_issues_count.toLocaleString()}</span></div><div className="detail-columns"><div><h3><GitCommitHorizontal size={14} /> Commits</h3>{detailQuery.data.commits.slice(0, 4).map(commit => <div className="detail-row" key={commit.sha}><strong>{commit.commit.message.split("\\n")[0]}</strong><span>{commit.sha.slice(0, 7)} · {commit.commit.author?.name || "GitHub author"}</span></div>)}</div><div><h3><CircleDot size={14} /> Issues</h3>{detailQuery.data.issues.slice(0, 4).map(issue => <div className="detail-row" key={issue.number}><strong>#{issue.number} {issue.title}</strong><span className={issue.state === "open" ? "state-open" : "state-closed"}>{issue.state}</span></div>)}</div><div><h3><GitPullRequest size={14} /> Pull requests</h3>{detailQuery.data.pullRequests.slice(0, 4).map(pr => <div className="detail-row" key={pr.number}><strong>#{pr.number} {pr.title}</strong><span>{pr.state} · {pr.user?.login || "author"}</span></div>)}</div><div><h3><Tag size={14} /> Releases</h3>{detailQuery.data.releases.slice(0, 4).map(release => <div className="detail-row" key={release.tag_name}><strong>{release.tag_name} {release.name}</strong><span>{release.published_at ? new Date(release.published_at).toLocaleDateString() : "Unpublished"}</span></div>)}</div></div></div>}</section></div>}
    {!isAuthenticated && <div className="auth-toast"><div className="auth-toast-icon"><Github size={17} /></div><div><strong>Connect your GitHub workspace</strong><span>Sign in to personalize your repository data.</span></div><div className="auth-buttons"><button className="auth-google" onClick={() => startLogin()}><Github size={13} /> Google</button><button className="auth-email" onClick={() => startLogin()}>Email</button></div></div>}
  </div>;
}
