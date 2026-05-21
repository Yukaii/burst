import { useEffect, useState } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import { sampleManifestValidationResults } from '@/src/lib/manifest';
import {
  getRegistryCommands,
  getRegistryCommand,
  getAuditReport,
  getPublisherProfile,
  AuditReport,
  PublisherProfile,
  registryCommandsData,
} from '@/src/lib/registryApi';

const navItems = ['Discover', 'Audits', 'Publish', 'Settings'];

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
  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<BurstCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);

  const [activeCommand, setActiveCommand] = useState<BurstCommand | null>(null);
  const [activeAuditReport, setActiveAuditReport] = useState<AuditReport | null>(null);
  const [activePublisherProfile, setActivePublisherProfile] = useState<PublisherProfile | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'audit' | 'publisher'>('details');

  const validManifests = sampleManifestValidationResults.filter((sample) => sample.result.ok).length;

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
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setLoading(false);
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
            getAuditReport(cmd.id, '1.0.0'),
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
        setInspectorLoading(false);
      } catch (err) {
        if (!active) return;
        setInspectorLoading(false);
      }
    }

    void fetchDetails();

    return () => {
      active = false;
    };
  }, [activeCommandId]);

  return (
    <div className="registry-shell">
      <aside className="sidebar" aria-label="Registry navigation">
        <div className="brand">
          <span>B</span>
          <div>
            <strong>Burst</strong>
            <em>Registry</em>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={item === 'Discover' ? 'is-active' : ''} type="button" key={item}>
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
        <header className="topbar">
          <label className="search">
            <span>Search commands</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search website, publisher, permission, or use case"
            />
          </label>
          <button className="publish-button" type="button">Publish use case</button>
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
                    <strong>{command.title}</strong>
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
            />
          ) : (
            <EmptyInspector />
          )}
        </section>
      </main>
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
        <span className="publisher-avatar">B</span>
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
}: {
  command: BurstCommand;
  auditReport: AuditReport | null;
  publisherProfile: PublisherProfile | null;
  loading: boolean;
  activeTab: 'details' | 'audit' | 'publisher';
  setActiveTab: (tab: 'details' | 'audit' | 'publisher') => void;
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
        <button type="button">Install</button>
        <button type="button">Pin</button>
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
