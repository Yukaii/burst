import { useEffect, useMemo, useState } from 'react';
import {
  BurstCommand,
  commandMatchesHost,
  getHostFromUrl,
  searchCommands,
  seedCommands,
} from '@/src/lib/commands';

type BurstPaletteProps = {
  pageUrl: string;
  pageTitle: string;
};

const trustLabels: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

const riskLabels: Record<BurstCommand['risk'], string> = {
  low: 'Low risk',
  medium: 'Review permissions',
  high: 'Sensitive access',
};

export function BurstPalette({ pageUrl, pageTitle }: BurstPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const host = useMemo(() => getHostFromUrl(pageUrl), [pageUrl]);

  const siteCommands = useMemo(
    () => seedCommands.filter((command) => commandMatchesHost(command, host)),
    [host],
  );

  const filteredCommands = useMemo(() => {
    const ordered = [...siteCommands].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    return searchCommands(ordered, query);
  }, [query, siteCommands]);

  const pinnedCommands = useMemo(
    () => seedCommands.filter((command) => command.pinned),
    [],
  );

  const activeCommand = filteredCommands[activeIndex] ?? filteredCommands[0];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isLauncher = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isLauncher) {
        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }

      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, filteredCommands.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (event.key === 'Enter' && activeCommand) {
        event.preventDefault();
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeCommand, filteredCommands.length, isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) {
    return (
      <button className="burst-launcher" type="button" onClick={() => setIsOpen(true)} aria-label="Open Burst">
        <span className="burst-mark">B</span>
        <span>⌘K</span>
      </button>
    );
  }

  return (
    <div className="burst-overlay" role="presentation">
      <section className="burst-shell" aria-label="Burst command palette">
        <aside className="burst-pins" aria-label="Pinned commands">
          <div className="burst-mark burst-mark-large">B</div>
          {pinnedCommands.map((command) => (
            <button
              className="burst-pin"
              key={command.id}
              type="button"
              title={command.title}
              onClick={() => {
                setQuery(command.title);
                setActiveIndex(0);
              }}
            >
              {command.publisher.avatarInitials}
            </button>
          ))}
        </aside>

        <main className="burst-main">
          <header className="burst-header">
            <div>
              <h1>Run a command</h1>
              <p>{host} · {pageTitle || 'Current page'}</p>
            </div>
            <button className="burst-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close Burst">
              Esc
            </button>
          </header>

          <label className="burst-search">
            <span>Search registry and site actions</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “summarize”, “notion”, or “reviewed”"
            />
          </label>

          <div className="burst-content">
            <div className="burst-results" role="listbox" aria-label="Available commands">
              <div className="burst-section-label">Available here</div>
              {filteredCommands.length > 0 ? (
                filteredCommands.map((command, index) => (
                  <button
                    className={`burst-command ${index === activeIndex ? 'is-active' : ''}`}
                    key={command.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="burst-command-icon">{command.publisher.avatarInitials}</span>
                    <span className="burst-command-copy">
                      <strong>{command.title}</strong>
                      <span>{command.description}</span>
                    </span>
                    <span className="burst-command-meta">
                      {command.pinned ? <span className="burst-pill">Pinned</span> : null}
                      <kbd>{command.shortcut ?? '↵'}</kbd>
                    </span>
                  </button>
                ))
              ) : (
                <div className="burst-empty">
                  <strong>No command matches that search.</strong>
                  <span>Try a publisher, permission, use case, or audit level.</span>
                </div>
              )}
            </div>

            <aside className="burst-detail" aria-label="Command details">
              {activeCommand ? (
                <>
                  <div className={`burst-trust burst-trust-${activeCommand.trustLevel}`}>
                    {trustLabels[activeCommand.trustLevel]}
                  </div>
                  <h2>{activeCommand.title}</h2>
                  <p>{activeCommand.description}</p>
                  <dl>
                    <div>
                      <dt>Publisher</dt>
                      <dd>{activeCommand.publisher.name} <span>{activeCommand.publisher.handle}</span></dd>
                    </div>
                    <div>
                      <dt>Risk</dt>
                      <dd>{riskLabels[activeCommand.risk]}</dd>
                    </div>
                    <div>
                      <dt>Usage</dt>
                      <dd>{activeCommand.installs.toLocaleString()} installs · {activeCommand.rating.toFixed(1)} rating</dd>
                    </div>
                  </dl>
                  <div className="burst-permissions">
                    <span>Permissions</span>
                    {activeCommand.permissions.map((permission) => (
                      <em key={permission}>{permission}</em>
                    ))}
                  </div>
                  <a href={activeCommand.sourceUrl} target="_blank" rel="noreferrer">
                    Review source
                  </a>
                </>
              ) : null}
            </aside>
          </div>
        </main>
      </section>
    </div>
  );
}
