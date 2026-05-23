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
    <aside className="registry-sidebar" aria-label="Registry navigation">
      <div 
        className="registry-sidebar-brand"
        onClick={() => setView('landing')}
      >
        <img src={logoUrl} alt="Burst Logo" />
        <div>
          <span>Burst</span>
          <em>Registry workspace</em>
        </div>
      </div>

      <nav className="registry-sidebar-nav">
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
              className={isActive ? 'is-active' : ''}
              type="button"
              key={item}
              onClick={() => {
                setNavTab(item);
                if (onClearPublishToast) onClearPublishToast();
              }}
            >
              <Icon />
              {item}
            </button>
          );
        })}
      </nav>

      <details className="registry-sidebar-session">
        <summary className="registry-session-main">
          <div className="registry-session-avatar">
            {currentUser.avatarInitials}
          </div>
          <div className="registry-session-info">
            <strong>{currentUser.name}</strong>
            <span>
              {displayHandle} {showGithub ? `• ${currentUser.githubLogin}` : ''}
            </span>
          </div>
          <ChevronUp className="registry-session-chevron" />
        </summary>
        <div className="registry-session-footer">
          <span>
            {currentUser.role || 'publisher'}
          </span>
          {onOpenBridgeLogs && (
            <button
              type="button"
              onClick={onOpenBridgeLogs}
            >
              Bridge logs
            </button>
          )}
          <button
            type="button"
            onClick={() => void onLogout()}
          >
            <LogOut />
            Log out
          </button>
        </div>
      </details>
    </aside>
  );
}
