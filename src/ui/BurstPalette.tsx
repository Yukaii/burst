import { useEffect, useMemo, useState } from 'react';
import {
  BurstCommand,
  commandMatchesHost,
  getCommandIconLabel,
  getCommandIconUrl,
  getHostFromUrl,
  managementCommands,
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

export function BurstPalette({ pageUrl, pageTitle }: BurstPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const host = useMemo(() => getHostFromUrl(pageUrl), [pageUrl]);

  const siteCommands = useMemo(
    () => [
      ...seedCommands.filter((command) => commandMatchesHost(command, host)),
      ...managementCommands,
    ],
    [host],
  );

  const filteredCommands = useMemo(() => {
    const ordered = [...siteCommands].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    return searchCommands(ordered, query);
  }, [query, siteCommands]);

  const activeCommand = filteredCommands[activeIndex] ?? filteredCommands[0];

  function runCommand(command: BurstCommand) {
    if (command.action) {
      void browser.runtime.sendMessage({ type: 'burst:run-management-command', action: command.action });
    }

    setIsOpen(false);
  }

  useEffect(() => {
    function handleMessage(message: unknown) {
      if (isToggleMessage(message)) {
        setIsOpen((current) => !current);
      }
    }

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
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
        runCommand(activeCommand);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeCommand, filteredCommands.length, isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="burst-overlay" role="presentation">
      <section className="burst-shell" aria-label="Burst command palette">
        <label className="burst-search">
          <span>{host}</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${pageTitle || host}`}
          />
        </label>

        <div className="burst-results" role="listbox" aria-label="Available commands">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((command, index) => (
              <button
                className={`burst-command ${index === activeIndex ? 'is-active' : ''}`}
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runCommand(command)}
              >
                <CommandIcon command={command} />
                <span className="burst-command-copy">
                  <strong>{command.title}</strong>
                  <span>
                    {command.website} · {trustLabels[command.trustLevel]} · {command.publisher.handle}
                  </span>
                </span>
                <kbd>{command.shortcut ?? '↵'}</kbd>
              </button>
            ))
          ) : (
            <div className="burst-empty">No commands found.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function CommandIcon({ command }: { command: BurstCommand }) {
  const iconUrl = getCommandIconUrl(command);

  if (iconUrl) {
    return (
      <span className="burst-command-icon">
        <img src={iconUrl} alt="" />
      </span>
    );
  }

  return <span className="burst-command-icon">{getCommandIconLabel(command)}</span>;
}

function isToggleMessage(message: unknown): message is { type: 'burst:toggle-palette' } {
  return typeof message === 'object' && message !== null && 'type' in message
    && message.type === 'burst:toggle-palette';
}
