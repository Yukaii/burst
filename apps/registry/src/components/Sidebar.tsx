import { 
  Compass,
  PlusCircle,
  Users,
  CheckSquare,
  Settings,
  Info,
  LogOut,
  Shield
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
    <aside className="flex flex-col gap-6 p-5 bg-slate-900 dark:bg-slate-950 text-slate-100 sticky top-0 h-screen border-r border-slate-800/40 shadow-xl select-none" aria-label="Registry navigation">
      <div 
        className="flex items-center gap-3 px-2 py-1.5 cursor-pointer group hover:opacity-90 transition-all duration-150" 
        onClick={() => setView('landing')}
      >
        <img className="size-10 rounded-xl object-cover ring-2 ring-sky-500/20 group-hover:ring-sky-500/40 transition-all duration-200" src={logoUrl} alt="Burst Logo" />
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight leading-none text-white">Burst</span>
          <span className="text-[11px] text-sky-400 font-semibold uppercase tracking-wider mt-0.5">Registry</span>
        </div>
      </div>

      <div className="p-3 bg-slate-800/40 border border-slate-800/60 rounded-xl flex flex-col gap-3 shadow-inner">
        <div className="flex items-center gap-3">
          <div className="size-8.5 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs border border-sky-500/20 shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-slate-100 truncate leading-tight">{currentUser.name}</span>
            <span className="text-[11px] text-slate-400 truncate mt-0.5">
              @{currentUser.handle} {currentUser.githubLogin ? `• ${currentUser.githubLogin}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800/40 pt-2.5 mt-0.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-sky-500/10 text-sky-400 border border-sky-500/20">
            {currentUser.role || 'publisher'}
          </span>
          <button 
            className="text-[11px] font-semibold text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors bg-transparent border-0 cursor-pointer p-0" 
            type="button" 
            onClick={() => void onLogout()}
          >
            <LogOut className="size-3" />
            Log out
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold border-none w-full text-left cursor-pointer transition-all duration-150 ${
                isActive 
                  ? 'bg-sky-500/15 text-sky-400 border-l-2 border-sky-400' 
                  : 'bg-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-100'
              }`}
              type="button"
              key={item}
              onClick={() => {
                setNavTab(item);
                if (onClearPublishToast) onClearPublishToast();
              }}
            >
              <Icon className={`size-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              {item}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="p-3 bg-slate-800/10 border border-slate-800/30 rounded-xl flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Shield className="size-3.5 text-sky-400" />
            <strong className="text-xs font-bold">Security model</strong>
          </div>
          <span className="text-[11px] text-slate-400 leading-relaxed">
            Audit labels inform discovery. Source review stays yours.
          </span>
        </div>
        <div className="px-2 text-[10px] text-slate-500 flex flex-col gap-1.5 select-none">
          <div className="flex items-center justify-between">
            <span>Search Registry</span>
            <kbd className="bg-slate-800 text-[9px] text-slate-400 px-1 py-0.2 rounded font-mono">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Bridge Logs</span>
            <kbd className="bg-slate-800 text-[9px] text-slate-400 px-1 py-0.2 rounded font-mono">⌥L</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Navigate list</span>
            <kbd className="bg-slate-800 text-[9px] text-slate-400 px-1 py-0.2 rounded font-mono">↑↓</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Switch tabs</span>
            <kbd className="bg-slate-800 text-[9px] text-slate-400 px-1 py-0.2 rounded font-mono">⌥1-5</kbd>
          </div>
        </div>
      </div>
    </aside>
  );
}
