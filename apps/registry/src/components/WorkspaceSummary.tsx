import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { RegistrySessionUser, RegistryAuthConfig } from '@/src/lib/registryApi';

interface WorkspaceSummaryProps {
  navTab: 'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings';
  setNavTab: (tab: 'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings') => void;
  currentUser: RegistrySessionUser;
  authConfig: RegistryAuthConfig | null;
  workspaceMetrics: Array<{ label: string; value: string }>;
  title: string;
  description: string;
}

export function WorkspaceSummary({
  navTab,
  setNavTab,
  currentUser,
  authConfig,
  workspaceMetrics,
  title,
  description
}: WorkspaceSummaryProps) {
  const currentGithubLogin = 'githubLogin' in currentUser ? currentUser.githubLogin : undefined;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch shrink-0" aria-label="Registry workspace summary">
      <div className="lg:col-span-2 flex flex-col justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <p className="text-[10px] font-extrabold text-sky-500 uppercase tracking-widest mb-1.5">Registry Workspace</p>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[70ch] leading-relaxed">{description}</p>

        <div className="flex flex-wrap gap-2 mt-4.5">
          <Badge variant="secondary" className="font-bold px-2.5 py-0.5 rounded-full text-xs">{currentUser.name}</Badge>
          <Badge variant="outline" className="font-bold px-2.5 py-0.5 rounded-full border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">@{currentUser.handle}</Badge>
          <Badge variant="outline" className="font-bold px-2.5 py-0.5 rounded-full border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">{currentUser.role || 'publisher'}</Badge>
          <Badge variant={authConfig?.githubEnabled ? 'default' : 'secondary'} className="font-bold px-2.5 py-0.5 rounded-full text-xs">
            {authConfig?.githubEnabled ? 'GitHub OAuth enabled' : 'GitHub OAuth unavailable'}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-5 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-xs border border-sky-500/20 shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div className="min-w-0">
            <strong className="text-sm font-bold text-slate-900 dark:text-white block truncate leading-tight">{currentUser.name}</strong>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{currentGithubLogin ? `@${currentGithubLogin}` : currentUser.handle}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5" aria-label="Workspace metrics">
          {workspaceMetrics.map((metric) => (
            <div key={metric.label} className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/45 shadow-sm">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{metric.label}</span>
              <strong className="text-lg font-extrabold text-slate-900 dark:text-white leading-none mt-auto">{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {navTab !== 'Discover' && (
            <Button variant="outline" size="sm" className="flex-1 font-bold text-xs py-1.5" onClick={() => setNavTab('Discover')}>
              Go to Discover
            </Button>
          )}
          {navTab !== 'Publish' && (
            <Button variant="default" size="sm" className="flex-1 font-bold text-xs py-1.5" onClick={() => setNavTab('Publish')}>
              Open Publish
            </Button>
          )}
          {navTab === 'Discover' && (
            <Button variant="default" size="sm" className="flex-1 font-bold text-xs py-1.5" onClick={() => setNavTab('Users')}>
              Review Users
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
