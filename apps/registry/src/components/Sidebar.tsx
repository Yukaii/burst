import { 
  Compass,
  PlusCircle,
  Users,
  CheckSquare,
  Settings,
  Info,
  LogOut,
  ChevronUp,
  User
} from 'lucide-react';
import type { RegistrySessionUser } from '@/src/lib/registryApi';
import logoUrl from '@/assets/logo.svg';

const navItems = ['Discover', 'Publish', 'Profile', 'Users', 'Audits', 'Settings'] as const;

type NavTab = typeof navItems[number];

interface SidebarProps {
  navTab: NavTab;
  setNavTab: (tab: NavTab) => void;
  currentUser: RegistrySessionUser;
  onLogout: () => void | Promise<void>;
  setView: (view: 'landing' | 'app') => void;
  onClearPublishToast?: () => void;
  onOpenBridgeLogs?: () => void;
}

export function Sidebar({
  navTab,
  setNavTab,
  currentUser,
  onLogout,
  setView,
  onClearPublishToast,
  onOpenBridgeLogs
}: SidebarProps) {
  const canManageRegistry = currentUser.role === 'admin';
  const isGuest = currentUser.handle === 'guest';
  const visibleNavItems = navItems.filter((item) => {
    if (item === 'Profile' && isGuest) return false;
    if (['Users', 'Audits'].includes(item) && !canManageRegistry) return false;
    return true;
  });
  const displayHandle = currentUser.handle.startsWith('@') ? currentUser.handle : `@${currentUser.handle}`;
  
  // Prevent duplicate handle/github username if they are identical
  const cleanHandle = currentUser.handle.replace(/^@/, '').toLowerCase();
  const cleanGithub = currentUser.githubLogin?.replace(/^@/, '').toLowerCase();
  const showGithub = cleanGithub && cleanGithub !== cleanHandle;

  return (
    <aside className="flex flex-col gap-4 min-h-0 overflow-hidden border-r border-border bg-card p-4" aria-label="Registry navigation">
      <div 
        className="flex items-center gap-3 h-12 cursor-pointer"
        onClick={() => setView('landing')}
      >
        <img className="w-7 h-7 shrink-0" src={logoUrl} alt="Burst Logo" />
        <div>
          <span className="block text-foreground text-[14px] font-[650] leading-none">Burst</span>
          <em className="block mt-1 text-muted-foreground text-[11px] not-italic font-[500] leading-none">Registry workspace</em>
        </div>
      </div>

      <nav className="flex flex-col gap-1 min-h-0">
        {visibleNavItems.map((item) => {
          const isActive = item === navTab;
          const Icon = {
            Discover: Compass,
            Publish: PlusCircle,
            Profile: User,
            Users: Users,
            Audits: CheckSquare,
            Settings: Settings
          }[item] || Info;

          return (
            <button
              className={`flex items-center gap-2.5 w-full h-[34px] border rounded-lg bg-transparent cursor-pointer text-[12px] font-[650] px-2.5 text-left transition-all duration-150 ${
                isActive 
                  ? 'border-border bg-accent text-accent-foreground' 
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-accent-foreground'
              }`}
              type="button"
              key={item}
              onClick={() => {
                setNavTab(item);
                if (onClearPublishToast) onClearPublishToast();
              }}
            >
              <Icon className="size-[15px]" />
              {item}
            </button>
          );
        })}
      </nav>

      <details className="group grid mt-auto border border-border rounded-lg bg-background p-2 px-3">
        <summary className="grid grid-cols-[32px_1fr_auto] gap-2.5 items-center cursor-pointer list-none outline-none m-0 p-0 [&::-webkit-details-marker]:hidden">
          <div className="grid w-8 h-8 place-items-center rounded-lg bg-accent text-accent-foreground text-[11.5px] font-extrabold">
            {currentUser.avatarInitials}
          </div>
          <div className="flex flex-col justify-center min-w-0 h-8 pt-[1px]">
            <strong className="text-foreground text-[12.5px] font-semibold leading-tight block overflow-hidden text-ellipsis whitespace-nowrap">
              {currentUser.name}
            </strong>
            <span className="mt-[1px] text-muted-foreground text-[11px] leading-tight block overflow-hidden text-ellipsis whitespace-nowrap">
              {displayHandle} {showGithub ? `• ${currentUser.githubLogin}` : ''}
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <div className="flex items-center justify-between gap-2.5 border-t border-border pt-2.25 mt-2.5">
          <span className="rounded bg-muted text-muted-foreground text-[10px] font-extrabold leading-none px-1.5 py-1 uppercase">
            {currentUser.role || 'publisher'}
          </span>
          {onOpenBridgeLogs && (
            <button
              type="button"
              onClick={onOpenBridgeLogs}
              className="inline-flex items-center gap-1 border-0 bg-transparent text-muted-foreground cursor-pointer text-[11px] font-semibold p-0 hover:text-sky-500 transition-colors"
            >
              Bridge logs
            </button>
          )}
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex items-center gap-1 border-0 bg-transparent text-muted-foreground cursor-pointer text-[11px] font-semibold p-0 hover:text-destructive transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Log out
          </button>
        </div>
      </details>
    </aside>
  );
}
