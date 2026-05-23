import { useEffect, useState } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { CheckCircle2 } from 'lucide-react';
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
import { PublishPanel } from './components/PublishPanel';
import { AuditsPanel } from './components/AuditsPanel';
import { SettingsPanel } from './components/SettingsPanel';

// Extracted Sub-Components
import { Sidebar } from './components/Sidebar';
import { BridgeLogsConsole } from './components/BridgeLogsConsole';
import type { HandshakeLog } from './components/BridgeLogsConsole';
import { DiscoverPanel } from './components/DiscoverPanel';

const navItems = ['Discover', 'Publish', 'Users', 'Audits', 'Settings'] as const;

const guestSessionUser: RegistrySessionUser = {
  handle: 'guest',
  name: 'Guest User',
  avatarInitials: 'G',
  role: 'member',
};

const bridgeClientId = `registry-${Math.random().toString(36).slice(2)}`;

export function RegistryApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authConfig, setAuthConfig] = useState<RegistryAuthConfig | null>(null);
  const [navTab, setNavTab] = useState<'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings'>('Discover');
  const [publishSuccessToast, setPublishSuccessToast] = useState<string | null>(null);
  const [view, setView] = useState<'landing' | 'app'>('landing');

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

  // Productivity-grade workspace states
  const [filterCategory, setFilterCategory] = useState<'all' | 'verified' | 'high_risk' | 'installed'>('all');
  const [logs, setLogs] = useState<HandshakeLog[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [config, user] = await Promise.all([getAuthConfig(), getCurrentUser()]);
        if (!active) return;
        setAuthConfig(config);
        setCurrentUser(user);
        if (user.handle !== 'guest') {
          setView('app');
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to bootstrap registry auth state:', err);
        setAuthConfig({ githubEnabled: false });
        setCurrentUser(guestSessionUser);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const isGuest = currentUser.handle === 'guest';
  const canManageRegistry = currentUser.role === 'admin';
  const visibleNavItems = navItems.filter((item) => canManageRegistry || !['Users', 'Audits'].includes(item));
  
  const preferredTheme = typeof window === 'undefined'
    ? 'dark'
    : localStorage.getItem('burst-theme') === 'light'
    ? 'light'
    : 'dark';

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
      if (event.data.bridgeClientId === bridgeClientId) return;

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

      if (type === 'burst:installed-commands-response') {
        setBridgeConnected(true);
        setInstalledCommandIds(event.data.installedIds || []);
        setPinnedCommandIds(event.data.pinnedIds || []);
      }
    };

    window.addEventListener('message', handler);
    sendBridgeMessage({ type: 'burst:get-installed-commands' });

    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);

  const handleGitHubLogin = () => {
    const loginUrl = new URL(authConfig?.loginUrl ?? '/api/auth/github/start', window.location.origin);
    loginUrl.searchParams.set('returnTo', `${window.location.origin}/dashboard`);
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
        if (keyNum >= 1 && keyNum <= 5) {
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
    <div className={`registry-app-shell ${preferredTheme === 'dark' ? 'dark' : ''}`}>
      <Sidebar
        navTab={navTab}
        setNavTab={setNavTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        setView={setView}
        onClearPublishToast={() => setPublishSuccessToast(null)}
      />

      <main className="registry-workspace">
        <header className="registry-toolbar">
          <div className="min-w-0">
            <div className="registry-toolbar-title">
              <button type="button" onClick={() => setView('landing')}>Registry</button>
              <span>/</span>
              <strong>{navTab}</strong>
            </div>
          </div>
          <div className="registry-toolbar-status" aria-label="Workspace status">
            {workspaceStatus.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </header>

        {publishSuccessToast && (
          <div className="registry-toast-success">
            <span className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {publishSuccessToast}
            </span>
            <button type="button" onClick={() => setPublishSuccessToast(null)}>×</button>
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
          />
        )}

        {navTab === 'Publish' && (
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

        {navTab === 'Settings' && <SettingsPanel bridgeConnected={bridgeConnected} />}
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
