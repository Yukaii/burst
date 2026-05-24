import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { CheckCircle2 } from 'lucide-react';
import logoUrl from '@/assets/logo.svg';

// Correct /dashboard path to hash routing early
if (typeof window !== 'undefined' && (window.location.pathname === '/dashboard' || window.location.pathname.startsWith('/dashboard/'))) {
  const hash = window.location.hash || '#/discover';
  window.history.replaceState(null, '', '/' + hash);
}
import {
  getAuthConfig,
  getCurrentUser,
  getRegistryCommands,
  getRegistryCommand,
  getAuditReport,
  getPublisherProfile,
  getRegistryUsers,
  logout,
  AuditReport,
  RegistryAuthConfig,
  PublisherProfile,
  RegistrySessionUser,
  registryCommandsData,
} from '@/src/lib/registryApi';

import { LandingPage } from './components/LandingPage';
import { UsersPanel } from './components/UsersPanel';
import { AuditsPanel } from './components/AuditsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ProfilePanel } from './components/ProfilePanel';

// Extracted Sub-Components
import { Sidebar } from './components/Sidebar';
import { BridgeLogsConsole } from './components/BridgeLogsConsole';
import type { HandshakeLog } from './components/BridgeLogsConsole';
import { DiscoverPanel } from './components/DiscoverPanel';

const navItems = ['Discover', 'Publish', 'Profile', 'Users', 'Audits', 'Settings'] as const;
const PublishPanel = lazy(() => import('./components/PublishPanel').then((module) => ({ default: module.PublishPanel })));

const guestSessionUser: RegistrySessionUser = {
  handle: 'guest',
  name: 'Guest User',
  avatarInitials: 'G',
  role: 'member',
};

const bridgeClientId = `registry-${Math.random().toString(36).slice(2)}`;

// Helper to parse hash routing
const parseHash = () => {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  if (!hash || hash === '#/') {
    return { tab: 'Discover' as const, cmdId: null as string | null, open: false, view: null as 'landing' | 'app' | null };
  }

  const parts = hash.slice(2).split('/'); // removes '#/'
  const tabName = parts[0];
  const cmdId = parts[1] || null;

  const matchedTab = (['Discover', 'Publish', 'Profile', 'Users', 'Audits', 'Settings'] as const).find(
    (item) => item.toLowerCase() === tabName.toLowerCase()
  );

  if (matchedTab) {
    return {
      tab: matchedTab,
      cmdId: cmdId,
      open: matchedTab === 'Discover' && Boolean(cmdId),
      view: 'app' as const,
    };
  }

  return { tab: 'Discover' as const, cmdId: null, open: false, view: null };
};

const initialRoute = parseHash();
const hasSessionFlag = typeof window !== 'undefined' && localStorage.getItem('burst_has_session') === 'true';
const defaultView = initialRoute.view || (hasSessionFlag ? 'app' : 'landing');
type RegistryTheme = 'light' | 'dark';

function getStoredTheme(): RegistryTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return localStorage.getItem('burst-theme') === 'light' ? 'light' : 'dark';
}

function SplashLoadingScreen({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className={`flex flex-col items-center justify-center w-screen h-screen bg-background text-foreground ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          {/* Outer decorative ring */}
          <div className="absolute w-20 h-20 rounded-2xl border border-sky-500/30 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute w-16 h-16 rounded-xl border border-indigo-500/20 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
          <img className="w-12 h-12 rounded-xl object-cover shadow-lg relative z-10" src={logoUrl} alt="Burst Logo" />
        </div>
        <div className="flex flex-col items-center gap-1.5 animate-pulse">
          <span className="text-sm font-extrabold tracking-tight">Burst Registry</span>
          <span className="text-[11px] font-semibold text-muted-foreground">Authenticating session...</span>
        </div>
      </div>
    </div>
  );
}

export function RegistryApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authConfig, setAuthConfig] = useState<RegistryAuthConfig | null>(null);
  const [preferredTheme, setPreferredTheme] = useState<RegistryTheme>(getStoredTheme);
  const [navTab, setNavTab] = useState<'Discover' | 'Publish' | 'Profile' | 'Users' | 'Audits' | 'Settings'>(
    initialRoute.tab || 'Discover'
  );
  const [publishSuccessToast, setPublishSuccessToast] = useState<string | null>(null);
  const [view, setView] = useState<'landing' | 'app'>(defaultView);

  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<BurstCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);

  const [activeCommand, setActiveCommand] = useState<BurstCommand | null>(null);
  const [activeAuditReport, setActiveAuditReport] = useState<AuditReport | null>(null);
  const [activePublisherProfile, setActivePublisherProfile] = useState<PublisherProfile | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'audit' | 'publisher'>('details');

  const [currentUser, setCurrentUser] = useState<RegistrySessionUser>(guestSessionUser);
  const [registryUserStats, setRegistryUserStats] = useState<{ total: number; admins: number; verified: number } | null>(null);
  const [installedCommandIds, setInstalledCommandIds] = useState<string[]>([]);
  const [pinnedCommandIds, setPinnedCommandIds] = useState<string[]>([]);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Productivity-grade workspace states
  const [filterCategory, setFilterCategory] = useState<'all' | 'verified' | 'high_risk' | 'installed'>('all');
  const [logs, setLogs] = useState<HandshakeLog[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const bridgeConnectedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [config, user] = await Promise.all([getAuthConfig(), getCurrentUser()]);
        if (!active) return;
        setAuthConfig(config);
        setCurrentUser(user);

        // Parse routing from hash on load
        const route = parseHash();
        if (route.view) {
          setView(route.view);
          setNavTab(route.tab);
          if (route.tab === 'Discover' && route.cmdId) {
            setActiveCommandId(route.cmdId);
            setIsInspectorOpen(route.open);
          }
        } else if (user.handle !== 'guest') {
          setView('app');
        }

        if (user.handle !== 'guest') {
          localStorage.setItem('burst_has_session', 'true');
        } else {
          localStorage.removeItem('burst_has_session');
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to bootstrap registry auth state:', err);
        setAuthConfig({ githubEnabled: false });
        setCurrentUser(guestSessionUser);
        localStorage.removeItem('burst_has_session');
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  // 1. Listen for browser routing hash changes (back/forward history buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHash();
      if (route.view) {
        setView(route.view);
        setNavTab(route.tab);
        if (route.tab === 'Discover') {
          setActiveCommandId(route.cmdId);
          setIsInspectorOpen(route.open);
        }
      } else {
        setView('landing');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 2. Synchronize active state -> URL hash
  useEffect(() => {
    if (authLoading) return;
    if (view === 'landing') {
      if (window.location.hash) {
        window.location.hash = '';
      }
      return;
    }
    const tabLower = navTab.toLowerCase();
    let expectedHash = `#/${tabLower}`;
    if (navTab === 'Discover' && isInspectorOpen && activeCommandId) {
      expectedHash = `#/${tabLower}/${activeCommandId}`;
    }
    if (window.location.hash !== expectedHash) {
      window.location.hash = expectedHash;
    }
  }, [view, navTab, isInspectorOpen, activeCommandId, authLoading]);

  const isGuest = currentUser.handle === 'guest';
  const canManageRegistry = currentUser.role === 'admin';
  const visibleNavItems = navItems.filter((item) => canManageRegistry || !['Users', 'Audits'].includes(item));
  
  useEffect(() => {
    localStorage.setItem('burst-theme', preferredTheme);
    document.documentElement.setAttribute('data-theme', preferredTheme);
    document.documentElement.classList.toggle('dark', preferredTheme === 'dark');
  }, [preferredTheme]);

  useEffect(() => {
    let active = true;

    async function fetchUserStats() {
      if (isGuest) {
        setRegistryUserStats(null);
        return;
      }

      try {
        const users = await getRegistryUsers();
        if (!active) return;
        setRegistryUserStats({
          total: users.length,
          admins: users.filter((profile) => profile.role === 'admin').length,
          verified: users.filter((profile) => profile.verified).length,
        });
      } catch (err) {
        if (!active) return;
        console.error('Failed to load registry user stats:', err);
      }
    }

    void fetchUserStats();

    return () => {
      active = false;
    };
  }, [isGuest]);

  useEffect(() => {
    if (!canManageRegistry && ['Users', 'Audits'].includes(navTab)) {
      setNavTab('Discover');
    }
  }, [canManageRegistry, navTab]);

  const workspaceStatus = [
    currentUser.handle === 'guest' ? 'Guest session' : currentUser.role || 'publisher',
    `${registryCommandsData.length} commands`,
    `${registryCommandsData.filter((command) => command.trustLevel !== 'community').length} audited`,
  ];

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function fetchCommands() {
      try {
        const results = await getRegistryCommands(query);
        if (!active) return;
        setCommands(results);
        if (results.length > 0) {
          if (!activeCommandId || !results.some((c) => c.id === activeCommandId)) {
            setActiveCommandId(results[0].id);
          }
        } else {
          setActiveCommandId(null);
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch registry commands:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchCommands();

    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (!activeCommandId) {
      setActiveCommand(null);
      setActiveAuditReport(null);
      setActivePublisherProfile(null);
      return;
    }

    const commandId = activeCommandId;
    let active = true;
    setInspectorLoading(true);
    setInspectorTab('details');

    async function fetchDetails() {
      try {
        const cmd = await getRegistryCommand(commandId);
        if (!active) return;
        if (cmd) {
          setActiveCommand(cmd);
          const [audit, profile] = await Promise.all([
            getAuditReport(cmd.id, cmd.version || '1.0.0'),
            getPublisherProfile(cmd.publisher.handle),
          ]);
          if (!active) return;
          setActiveAuditReport(audit ?? null);
          setActivePublisherProfile(profile ?? null);
        } else {
          setActiveCommand(null);
          setActiveAuditReport(null);
          setActivePublisherProfile(null);
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch command details:', err);
      } finally {
        if (active) setInspectorLoading(false);
      }
    }

    void fetchDetails();

    return () => {
      active = false;
    };
  }, [activeCommandId]);

  // Hook Handshake Event Logging
  const sendBridgeMessage = (message: { type: string; [key: string]: any }) => {
    const outboundMessage = {
      ...message,
      bridgeClientId,
      bridgeRequestId: `request-${Math.random().toString(36).slice(2)}`,
      bridgeSender: 'registry-app',
    };
    const newLog: HandshakeLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      direction: 'out',
      type: message.type,
      payload: outboundMessage,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
    window.postMessage(outboundMessage, '*');
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      const { type } = event.data;
      if (event.data.bridgeSender === 'registry-app') return;
      if (event.data.bridgeClientId && event.data.bridgeClientId !== bridgeClientId) return;
      if (type === 'burst:bridge-ping') return;

      if (type && type.startsWith('burst:')) {
        const newLog: HandshakeLog = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          direction: 'in',
          type,
          payload: event.data,
        };
        setLogs((prev) => [newLog, ...prev].slice(0, 100));
      }

      if (type === 'burst:bridge-ready') {
        bridgeConnectedRef.current = true;
        setBridgeConnected(true);
      }

      if (type === 'burst:installed-commands-response') {
        bridgeConnectedRef.current = true;
        setBridgeConnected(true);
        setInstalledCommandIds(event.data.installedIds || []);
        setPinnedCommandIds(event.data.pinnedIds || []);
      }
    };

    window.addEventListener('message', handler);
    sendBridgeMessage({ type: 'burst:bridge-ping' });
    sendBridgeMessage({ type: 'burst:get-installed-commands' });

    const retryTimer = window.setInterval(() => {
      if (bridgeConnectedRef.current) return;
      sendBridgeMessage({ type: 'burst:bridge-ping' });
      sendBridgeMessage({ type: 'burst:get-installed-commands' });
    }, 1500);

    return () => {
      window.removeEventListener('message', handler);
      window.clearInterval(retryTimer);
    };
  }, []);

  const handleGitHubLogin = () => {
    const loginUrl = new URL(authConfig?.loginUrl ?? '/api/auth/github/start', window.location.origin);
    loginUrl.searchParams.set('returnTo', `${window.location.origin}/#/discover`);
    window.location.assign(loginUrl.toString());
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Failed to logout:', err);
    } finally {
      setCurrentUser(guestSessionUser);
      setNavTab('Discover');
      setPublishSuccessToast(null);
      setView('landing');
      localStorage.removeItem('burst_has_session');
    }
  };

  const handleInstall = (command: BurstCommand) => {
    sendBridgeMessage({ type: 'burst:install-command', command });
  };

  const handleUninstall = (commandId: string) => {
    sendBridgeMessage({ type: 'burst:uninstall-command', commandId });
  };

  const handlePin = (commandId: string) => {
    sendBridgeMessage({ type: 'burst:pin-command', commandId });
  };

  const handleUnpin = (commandId: string) => {
    sendBridgeMessage({ type: 'burst:unpin-command', commandId });
  };

  // Filter commands by quick filter tabs
  const filteredCommands = commands.filter((cmd) => {
    if (filterCategory === 'verified') {
      return cmd.trustLevel === 'verified';
    }
    if (filterCategory === 'high_risk') {
      return cmd.risk === 'high';
    }
    if (filterCategory === 'installed') {
      return installedCommandIds.includes(cmd.id) || pinnedCommandIds.includes(cmd.id);
    }
    return true;
  });

  // Keep selection synchronized when filter category changes
  useEffect(() => {
    if (filteredCommands.length > 0) {
      if (!activeCommandId || !filteredCommands.some((c) => c.id === activeCommandId)) {
        setActiveCommandId(filteredCommands[0].id);
      }
    } else {
      setActiveCommandId(null);
    }
  }, [filterCategory, commands]);

  // Keyboard Shortcuts & List Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Toggle Bridge Logs console via Option+L (or Alt+L)
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsConsoleOpen((prev) => !prev);
        return;
      }

      // 2. Focus search input via CMD+K / Ctrl+K or "/"
      const isInputOrTextArea =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (e.key === '/' && !isInputOrTextArea)) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search website"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // 3. Escape to blur or deselect
      if (e.key === 'Escape') {
        if (isInputOrTextArea) {
          (document.activeElement as HTMLElement).blur();
        } else {
          setActiveCommandId(null);
        }
        return;
      }

      // 4. Tab switching with keys (Alt/Option + 1 to 5)
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 6) {
          e.preventDefault();
          const targetTab = visibleNavItems[keyNum - 1];
          if (targetTab) {
            setNavTab(targetTab);
            setPublishSuccessToast(null);
          }
          return;
        }
      }

      // 5. Arrow navigation through filteredCommands when Discover is active
      if (navTab === 'Discover' && !isInputOrTextArea) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filteredCommands.length === 0) return;
          const currentIndex = filteredCommands.findIndex((c) => c.id === activeCommandId);
          const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, filteredCommands.length - 1);
          setActiveCommandId(filteredCommands[nextIndex].id);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filteredCommands.length === 0) return;
          const currentIndex = filteredCommands.findIndex((c) => c.id === activeCommandId);
          const prevIndex = currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
          setActiveCommandId(filteredCommands[prevIndex].id);
        } else if (e.key === 'Enter' && activeCommandId) {
          const cmd = filteredCommands.find((c) => c.id === activeCommandId);
          if (cmd) {
            e.preventDefault();
            const isInstalled = installedCommandIds.includes(cmd.id);
            if (isInstalled) {
              handleUninstall(cmd.id);
            } else {
              handleInstall(cmd);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navTab, activeCommandId, filteredCommands, installedCommandIds, visibleNavItems]);

  // Active command scrolling helper
  useEffect(() => {
    if (activeCommandId) {
      const el = document.querySelector(`[data-command-id="${activeCommandId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeCommandId]);

  if (authLoading) {
    if (view === 'app') {
      return <SplashLoadingScreen theme={preferredTheme} />;
    }
    return (
      <LandingPage
        authLoading
        authConfig={authConfig}
        currentUser={currentUser}
        onGitHubLogin={handleGitHubLogin}
        onLogout={handleLogout}
        onGoToDashboard={() => setView('app')}
      />
    );
  }

  if (view === 'landing') {
    return (
      <LandingPage
        authConfig={authConfig}
        currentUser={currentUser}
        onGitHubLogin={handleGitHubLogin}
        onLogout={handleLogout}
        onGoToDashboard={() => setView('app')}
      />
    );
  }

  return (
    <div className={`grid grid-cols-[280px_minmax(0,_1fr)] w-screen h-screen overflow-hidden bg-background text-foreground ${preferredTheme === 'dark' ? 'dark' : ''}`}>
      <Sidebar
        navTab={navTab}
        setNavTab={setNavTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        setView={setView}
        onClearPublishToast={() => setPublishSuccessToast(null)}
        onOpenBridgeLogs={() => setIsConsoleOpen(true)}
      />

      <main className="flex min-w-0 min-h-0 flex-col gap-3 overflow-hidden p-3.5">
        <header className="grid grid-cols-[minmax(0,_1fr)_auto] items-center gap-4 border border-border rounded-lg bg-card p-2.5 px-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold leading-none">
              <button type="button" className="border-0 bg-transparent text-inherit cursor-pointer font-inherit p-0 hover:text-foreground" onClick={() => setView('landing')}>Registry</button>
              <span>/</span>
              <strong className="text-foreground">{navTab}</strong>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5" aria-label="Workspace status">
            {workspaceStatus.map((item) => (
              <span key={item} className="border border-border rounded-full bg-background text-muted-foreground text-[11px] font-semibold leading-none p-1.5 px-2">{item}</span>
            ))}
          </div>
        </header>

        {publishSuccessToast && (
          <div className="flex items-center justify-between gap-2.5 border border-emerald-500/25 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold p-2 px-[11px]">
            <span className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {publishSuccessToast}
            </span>
            <button type="button" className="border-0 bg-transparent text-current cursor-pointer text-lg leading-none p-0 px-0.5" onClick={() => setPublishSuccessToast(null)}>×</button>
          </div>
        )}

        {navTab === 'Discover' && (
          <DiscoverPanel
            query={query}
            setQuery={setQuery}
            loading={loading}
            filteredCommands={filteredCommands}
            activeCommandId={activeCommandId}
            setActiveCommandId={setActiveCommandId}
            installedCommandIds={installedCommandIds}
            pinnedCommandIds={pinnedCommandIds}
            activeCommand={activeCommand}
            activeAuditReport={activeAuditReport}
            activePublisherProfile={activePublisherProfile}
            inspectorLoading={inspectorLoading}
            inspectorTab={inspectorTab}
            setInspectorTab={setInspectorTab}
            handleInstall={handleInstall}
            handleUninstall={handleUninstall}
            handlePin={handlePin}
            handleUnpin={handleUnpin}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            setNavTab={setNavTab}
            isInspectorOpen={isInspectorOpen}
            setIsInspectorOpen={setIsInspectorOpen}
          />
        )}

        {navTab === 'Publish' && (
          <Suspense fallback={<div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4 text-sm text-muted-foreground">Loading publish workspace...</div>}>
            <PublishPanel
              currentUser={currentUser}
              onPublishSuccess={(newCmd) => {
                setCommands((prev) => [newCmd, ...prev]);
                setActiveCommandId(newCmd.id);
                setNavTab('Discover');
                setPublishSuccessToast(`Successfully published "${newCmd.title}"!`);
              }}
              setNavTab={setNavTab}
            />
          </Suspense>
        )}
        {navTab === 'Profile' && (
          <ProfilePanel
            currentUser={currentUser}
            onCurrentUserUpdate={(updatedUser) => {
              setCurrentUser((prev) => ({
                ...prev,
                ...updatedUser,
              }));
            }}
            commands={commands}
            setActiveCommandId={setActiveCommandId}
            setIsInspectorOpen={setIsInspectorOpen}
            setNavTab={setNavTab}
          />
        )}
        {navTab === 'Users' && canManageRegistry && (
          <UsersPanel
            currentUser={currentUser}
            onCurrentUserUpdate={(updatedUser) => {
              setCurrentUser((prev) => ({
                ...prev,
                ...updatedUser,
              }));
            }}
          />
        )}

        {navTab === 'Audits' && canManageRegistry && <AuditsPanel />}

        {navTab === 'Settings' && (
          <SettingsPanel
            bridgeConnected={bridgeConnected}
            theme={preferredTheme}
            onThemeChange={setPreferredTheme}
          />
        )}
      </main>

      <BridgeLogsConsole
        logs={logs}
        onClearLogs={() => setLogs([])}
        isOpen={isConsoleOpen}
        onToggle={setIsConsoleOpen}
      />
    </div>
  );
}
