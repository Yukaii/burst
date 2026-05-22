import { useEffect, useState } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { sampleManifestValidationResults } from '@/src/lib/manifest';
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
import { WorkspaceSummary } from './components/WorkspaceSummary';
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

  const validManifests = sampleManifestValidationResults.filter((sample) => sample.result.ok).length;
  const isGuest = currentUser.handle === 'guest';
  
  const dashboardCopy: Record<
    'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings',
    { title: string; description: string }
  > = {
    Discover: {
      title: 'Browse the public registry',
      description: 'Search commands, compare publishers, and inspect risk labels before anything reaches the extension.',
    },
    Publish: {
      title: 'Prepare a command for review',
      description: 'Draft a command, declare its capabilities, and run the audit before it gets indexed.',
    },
    Users: {
      title: 'Manage publisher identity',
      description: 'Review accounts, verified sources, and role assignments in one place.',
    },
    Audits: {
      title: 'Review security checks',
      description: 'Inspect the static analysis output that decides whether a command passes or fails.',
    },
    Settings: {
      title: 'Tune the workspace',
      description: 'Keep the registry interface predictable for moderators and publishers.',
    },
  };
  const dashboardState = dashboardCopy[navTab];

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

  const dashboardMetrics: Record<
    'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings',
    Array<{ label: string; value: string }>
  > = {
    Discover: [
      { label: 'Commands', value: registryCommandsData.length.toString() },
      { label: 'Audited', value: registryCommandsData.filter((command) => command.trustLevel !== 'community').length.toString() },
      { label: 'Sensitive', value: registryCommandsData.filter((command) => command.risk === 'high').length.toString() },
    ],
    Publish: [
      { label: 'Verified sources', value: currentUser.handle === 'guest' ? '0' : currentUser.verifiedSources.length.toString() },
      { label: 'Role', value: currentUser.role || 'publisher' },
      { label: 'Audit checks', value: '5' },
    ],
    Users: [
      { label: 'Publishers', value: registryUserStats ? registryUserStats.total.toString() : '…' },
      { label: 'Admins', value: registryUserStats ? registryUserStats.admins.toString() : '…' },
      { label: 'Verified', value: registryUserStats ? registryUserStats.verified.toString() : '…' },
    ],
    Audits: [
      { label: 'Pass', value: registryCommandsData.filter((command) => command.trustLevel === 'verified').length.toString() },
      { label: 'Review', value: registryCommandsData.filter((command) => command.trustLevel === 'reviewed').length.toString() },
      { label: 'Warnings', value: registryCommandsData.filter((command) => command.risk !== 'low').length.toString() },
    ],
    Settings: [
      { label: 'Theme', value: 'Adaptive' },
      { label: 'Session', value: currentUser.handle === 'guest' ? 'Guest' : 'Signed in' },
      { label: 'Storage', value: 'Local sync' },
    ],
  };
  const workspaceMetrics = dashboardMetrics[navTab];

  useEffect(() => {
    if (isGuest) {
      setCommands([]);
      setActiveCommandId(null);
      setLoading(false);
      return;
    }

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
  }, [isGuest, query]);

  useEffect(() => {
    if (isGuest) {
      setActiveCommand(null);
      setActiveAuditReport(null);
      setActivePublisherProfile(null);
      return;
    }

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
  }, [activeCommandId, isGuest]);

  // Hook Handshake Event Logging
  const sendBridgeMessage = (message: { type: string; [key: string]: any }) => {
    const newLog: HandshakeLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      direction: 'out',
      type: message.type,
      payload: message,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
    window.postMessage(message, '*');
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      const { type } = event.data;

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
          const targetTab = navItems[keyNum - 1];
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
  }, [navTab, activeCommandId, filteredCommands, installedCommandIds]);

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
    <div className="min-h-screen grid grid-cols-[250px_1fr] bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        navTab={navTab}
        setNavTab={setNavTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        setView={setView}
        onClearPublishToast={() => setPublishSuccessToast(null)}
      />

      <main className="p-6 lg:p-8 flex flex-col gap-6 lg:gap-8 max-w-[1400px] mx-auto w-full min-w-0 relative">
        {/* Navigation Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1 select-none" aria-label="Breadcrumb">
          <span className="hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer transition-colors" onClick={() => setView('landing')}>Registry</span>
          <span className="text-slate-300 dark:text-slate-800">/</span>
          <span className="text-slate-800 dark:text-slate-200">{navTab}</span>
        </nav>

        {publishSuccessToast && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-4 duration-200 shrink-0">
            <span className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {publishSuccessToast}
            </span>
            <button className="text-emerald-500 hover:text-emerald-400 font-bold bg-transparent border-0 cursor-pointer text-lg p-1" onClick={() => setPublishSuccessToast(null)}>×</button>
          </div>
        )}

        <WorkspaceSummary
          navTab={navTab}
          setNavTab={setNavTab}
          currentUser={currentUser}
          authConfig={authConfig}
          workspaceMetrics={workspaceMetrics}
          title={dashboardState.title}
          description={dashboardState.description}
        />

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
            validManifests={validManifests}
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

        {navTab === 'Users' && (
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

        {navTab === 'Audits' && <AuditsPanel />}

        {navTab === 'Settings' && <SettingsPanel />}
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
