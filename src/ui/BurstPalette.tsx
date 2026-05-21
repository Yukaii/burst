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
import { getLocalScript, loadLocalScripts, localScriptToCommand } from '@/src/lib/localScripts';

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
  const [localCommands, setLocalCommands] = useState<BurstCommand[]>([]);
  const host = useMemo(() => getHostFromUrl(pageUrl), [pageUrl]);

  const siteCommands = useMemo(
    () => [
      ...localCommands.filter((command) => commandMatchesHost(command, host)),
      ...seedCommands.filter((command) => commandMatchesHost(command, host)),
      ...managementCommands,
    ],
    [host, localCommands],
  );

  const filteredCommands = useMemo(() => {
    const ordered = [...siteCommands].sort((a, b) => {
      const localScriptDelta = Number(Boolean(b.localScriptId)) - Number(Boolean(a.localScriptId));
      if (localScriptDelta !== 0) return localScriptDelta;
      return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    });

    return searchCommands(ordered, query);
  }, [query, siteCommands]);

  const activeCommand = filteredCommands[activeIndex] ?? filteredCommands[0];

  async function runCommand(command: BurstCommand) {
    if (command.action === 'run-local-script') {
      if (command.localScriptId) {
        await runLocalScript(command.localScriptId).catch((error: unknown) => {
          console.error('[Burst] Local script failed', error);
        });
      }

      setIsOpen(false);
      return;
    }

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

    async function refreshLocalCommands() {
      const scripts = await loadLocalScripts();
      setLocalCommands(
        scripts
          .filter((script) => script.status === 'enabled')
          .map(localScriptToCommand),
      );
    }

    void refreshLocalCommands();
  }, [isOpen]);

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
        void runCommand(activeCommand);
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
                onClick={() => void runCommand(command)}
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

async function runLocalScript(scriptId: string) {
  const script = await getLocalScript(scriptId);
  if (!script || script.status !== 'enabled') return;

  const run = compileLocalScript(script.code);
  await run({
    page: document,
    window,
    location,
    navigator,
    selection: window.getSelection()?.toString() ?? '',
    url: location.href,
    title: document.title,
  });
}

function compileLocalScript(code: string): (context: Record<string, unknown>) => unknown | Promise<unknown> {
  const moduleBody = code.replace(/^\s*export\s+default\s+/, '');
  const factory = new Function(`return (${moduleBody});`);
  const run = factory();

  if (typeof run !== 'function') {
    throw new Error('Local script must export a default function.');
  }

  return run;
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
