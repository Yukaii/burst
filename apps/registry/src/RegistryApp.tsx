import { useMemo, useState } from 'react';
import { BurstCommand, searchCommands, seedCommands } from '@/src/lib/commands';

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
  const [activeCommandId, setActiveCommandId] = useState(seedCommands[0]?.id);

  const commands = useMemo(() => searchCommands(seedCommands, query), [query]);
  const activeCommand = commands.find((command) => command.id === activeCommandId) ?? commands[0] ?? seedCommands[0];

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
          <SummaryStat label="Commands" value={seedCommands.length.toString()} />
          <SummaryStat
            label="Audited"
            value={seedCommands.filter((command) => command.trustLevel === 'verified' || command.trustLevel === 'reviewed').length.toString()}
          />
          <SummaryStat label="Sensitive" value={seedCommands.filter((command) => command.risk === 'high').length.toString()} />
          <SummaryStat label="Pinned seeds" value={seedCommands.filter((command) => command.pinned).length.toString()} />
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

            {commands.map((command) => (
              <button
                className={`command-row ${activeCommand.id === command.id ? 'is-selected' : ''}`}
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
            ))}
          </div>

          <CommandInspector command={activeCommand} />
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

function CommandInspector({ command }: { command: BurstCommand }) {
  return (
    <aside className="inspector" aria-label="Selected command audit details">
      <div className="inspector-head">
        <span className="publisher-avatar">{command.publisher.avatarInitials}</span>
        <div>
          <h2>{command.title}</h2>
          <p>{command.description}</p>
        </div>
      </div>

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
          <dd><a href={command.sourceUrl}>{command.sourceUrl.replace('https://github.com/', '')}</a></dd>
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

      <div className="audit-report">
        <h3>Audit report</h3>
        <p>
          Static review checks manifest scope, host matching, network access, and source availability. Runtime behavior still requires user review before install.
        </p>
      </div>

      <div className="inspector-actions">
        <button type="button">Install</button>
        <button type="button">Pin</button>
      </div>
    </aside>
  );
}
