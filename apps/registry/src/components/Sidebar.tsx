import { 
  Compass,
  PlusCircle,
  Users,
  CheckSquare,
  Settings,
  Info,
  LogOut,
  ChevronUp
} from 'lucide-react';
import type { RegistrySessionUser } from '@/src/lib/registryApi';
import logoUrl from '@/assets/logo.svg';

const navItems = ['Discover', 'Publish', 'Users', 'Audits', 'Settings'] as const;

type NavTab = typeof navItems[number];

interface SidebarProps {
  navTab: NavTab;
  setNavTab: (tab: NavTab) => void;
  currentUser: RegistrySessionUser;
  onLogout: () => void | Promise<void>;
  setView: (view: 'landing' | 'app') => void;
  onClearPublishToast?: () => void;
}

export function Sidebar({
  navTab,
  setNavTab,
  currentUser,
  onLogout,
  setView,
  onClearPublishToast
}: SidebarProps) {
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
        {navItems.map((item) => {
          const isActive = item === navTab;
          const Icon = {
            Discover: Compass,
            Publish: PlusCircle,
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
          <div>
            <strong>{currentUser.name}</strong>
            <span>
              @{currentUser.handle} {currentUser.githubLogin ? `• ${currentUser.githubLogin}` : ''}
            </span>
          </div>
          <ChevronUp className="registry-session-chevron" />
        </summary>
        <div className="registry-session-footer">
          <span>
            {currentUser.role || 'publisher'}
          </span>
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
