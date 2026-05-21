import { useEffect, useMemo, useState } from 'react';
import {
  BurstCommand,
  commandMatchesHost,
  getCommandIconLabel,
  getCommandIconUrl,
  getHostFromUrl,
  managementCommands,
  orderPaletteCommands,
  searchCommands,
} from '@/src/lib/commands';
import {
  getLocalScriptEventName,
  getLocalScriptResultEventName,
  loadLocalScripts,
  localScriptToCommand,
} from '@/src/lib/localScripts';
import {
  loadInstalledRegistryCommands,
  loadPinnedRegistryCommandIds,
  loadConsentGrants,
  saveConsentGrant,
  getRegistryScriptEventName,
  getRegistryScriptResultEventName,
} from '@/src/lib/registryStorage';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { getMockScriptCode } from '@/src/lib/registryApi';
import { ExtensionSettings, DEFAULT_SETTINGS, loadSettings } from '@/src/lib/settings';

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
  const [statusMessage, setStatusMessage] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const [consentPendingCommand, setConsentPendingCommand] = useState<BurstCommand | null>(null);
  const [capturedSelection, setCapturedSelection] = useState('');
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const host = useMemo(() => getHostFromUrl(pageUrl), [pageUrl]);

  const consentAnalysis = useMemo(() => {
    if (!consentPendingCommand) return null;
    const code = getMockScriptCode(consentPendingCommand.id);
    return analyzeScriptCode(code, consentPendingCommand.matchPatterns);
  }, [consentPendingCommand]);

  const siteCommands = useMemo(
    () => [
      ...localCommands.filter((command) => commandMatchesHost(command, host)),
      ...managementCommands,
    ],
    [host, localCommands],
  );

  const filteredCommands = useMemo(() => {
    return searchCommands(orderPaletteCommands(siteCommands), query);
  }, [query, siteCommands]);

  const activeCommand = filteredCommands[activeIndex] ?? filteredCommands[0];

  async function runCommand(command: BurstCommand) {
    if (settings.showConsoleLogs) {
      console.log(`[Burst] Execution started for "${command.title}" (${command.id})`, {
        action: command.action,
        selection: capturedSelection,
        url: pageUrl,
        timestamp: new Date().toISOString(),
      });
    }

    if (command.action === 'run-local-script') {
      if (command.localScriptId) {
        const result = await runLocalScript(command.localScriptId, capturedSelection, setToastMessage);
        if (settings.showConsoleLogs) {
          console.log(`[Burst] Execution outcome for "${command.title}":`, result);
        }
        if (!result.ok) {
          setStatusMessage(result.message);
          return;
        }
      }

      setIsOpen(false);
      return;
    }

    if (command.action === 'run-registry-script') {
      if (command.risk === 'high' || command.risk === 'medium') {
        const grants = await loadConsentGrants();
        if (!grants.includes(command.id)) {
          setConsentPendingCommand(command);
          return;
        }
      }

      const result = await runRegistryScript(command.id, capturedSelection, setToastMessage);
      if (settings.showConsoleLogs) {
        console.log(`[Burst] Execution outcome for "${command.title}":`, result);
      }
      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }
      setIsOpen(false);
      return;
    }

    if (command.action) {
      void browser.runtime.sendMessage({ type: 'burst:run-management-command', action: command.action });
    }

    setIsOpen(false);
  }

  async function handleConfirmConsent() {
    if (!consentPendingCommand) return;
    const command = consentPendingCommand;
    await saveConsentGrant(command.id);
    setConsentPendingCommand(null);

    const result = await runRegistryScript(command.id, capturedSelection, setToastMessage);
    if (!result.ok) {
      setStatusMessage(result.message);
      return;
    }
    setIsOpen(false);
  }

  useEffect(() => {
    function handleMessage(message: unknown) {
      if (isToggleMessage(message)) {
        setIsOpen((current) => {
          const next = !current;
          if (next) {
            // Capture selection synchronously before palette input autofocus steals focus
            const sel = window.getSelection()?.toString() ?? '';
            setCapturedSelection(sel);
          }
          return next;
        });
      }
    }

    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    async function initSettings() {
      const loaded = await loadSettings();
      setSettings(loaded);
    }
    void initSettings();

    if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
      const handleStorageChange = (changes: Record<string, any>, areaName: string) => {
        if (areaName === 'local' && changes['burst.settings.v1']) {
          const newValue = changes['burst.settings.v1'].newValue;
          if (newValue) {
            setSettings(newValue);
          }
        }
      };
      browser.storage.onChanged.addListener(handleStorageChange);
      return () => {
        browser.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && settings.backdropClickClose) {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setConsentPendingCommand(null);
      return;
    }

    async function refreshLocalCommands() {
      const syncResult = await browser.runtime
        .sendMessage({ type: 'burst:sync-local-scripts' })
        .catch(() => undefined);
      if (isLocalScriptSyncError(syncResult)) {
        setStatusMessage(syncResult.message);
      }

      const scripts = await loadLocalScripts();
      const registryCmds = await loadInstalledRegistryCommands();
      const pinnedIds = await loadPinnedRegistryCommandIds();

      const mappedRegistryCmds = registryCmds.map((cmd) => ({
        ...cmd,
        action: 'run-registry-script' as const,
        pinned: pinnedIds.includes(cmd.id),
      }));

      setLocalCommands([
        ...scripts
          .filter((script) => script.status === 'enabled')
          .map(localScriptToCommand),
        ...mappedRegistryCmds,
      ]);
    }

    void refreshLocalCommands();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (consentPendingCommand) {
          setConsentPendingCommand(null);
        } else {
          setIsOpen(false);
        }
        return;
      }

      if (consentPendingCommand) {
        if (event.key === 'Enter') {
          event.preventDefault();
          void handleConfirmConsent();
        }
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
  }, [activeCommand, filteredCommands.length, isOpen, consentPendingCommand]);

  useEffect(() => {
    setActiveIndex(0);
    setStatusMessage(undefined);
  }, [query]);

  useEffect(() => {
    if (!toastMessage) return;

    const timeout = window.setTimeout(() => setToastMessage(undefined), 2200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const activeTheme = settings.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : settings.theme;

  return (
    <>
      {isOpen ? (
        <div
          className={`burst-overlay position-${settings.position} theme-${activeTheme}`}
          role="presentation"
          onClick={handleOverlayClick}
        >
          <section className="burst-shell" aria-label="Burst command palette">
            {consentPendingCommand ? (
              <div className="burst-consent-modal">
                <div className="burst-consent-header">
                  <span className={`burst-risk-badge risk-${consentPendingCommand.risk}`}>
                    {consentPendingCommand.risk.toUpperCase()} RISK
                  </span>
                  <h2>Security Consent Required</h2>
                  <p className="burst-consent-subtitle">
                    The command <strong>{consentPendingCommand.title}</strong> by <code>{consentPendingCommand.publisher.handle}</code> requests permission to run on this site.
                  </p>
                </div>

                <div className="burst-consent-body">
                  <div className="burst-consent-info-grid">
                    <div className="info-item">
                      <span className="info-label">Publisher</span>
                      <span className="info-value text-glow">
                        {consentPendingCommand.publisher.name} ({consentPendingCommand.publisher.handle})
                      </span>
                    </div>
                    {consentPendingCommand.sourceUrl && (
                      <div className="info-item">
                        <span className="info-label">Source URL</span>
                        <a
                          href={consentPendingCommand.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="info-value link"
                        >
                          {consentPendingCommand.sourceUrl.replace('https://github.com/', '')}
                        </a>
                      </div>
                    )}
                    <div className="info-item">
                      <span className="info-label">Trust Status</span>
                      <span className={`trust-badge trust-${consentPendingCommand.trustLevel}`}>
                        {trustLabels[consentPendingCommand.trustLevel]}
                      </span>
                    </div>
                  </div>

                  <div className="burst-consent-permissions">
                    <h3>Declared Capabilities</h3>
                    <ul>
                      {consentPendingCommand.permissions.length > 0 ? (
                        consentPendingCommand.permissions.map((perm) => (
                          <li key={perm}>
                            <span className="checkbox-icon">✓</span>
                            <span>{perm}</span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <span className="checkbox-icon">✓</span>
                          <span>No special permissions requested</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {consentAnalysis && (
                    <div className="burst-consent-audit">
                      <h3>Static Security Audit</h3>
                      <div className="burst-audit-summary-box">
                        <span className={`audit-badge is-${consentAnalysis.status}`}>
                          {consentAnalysis.status}
                        </span>
                        <p>{consentAnalysis.summary}</p>
                      </div>
                      <ul className="burst-audit-checklist">
                        {Object.entries(consentAnalysis.checks).map(([key, check]) => {
                          if (check.status === 'pass') return null;
                          return (
                            <li key={key} className={`audit-item is-${check.status}`}>
                              <span className="check-icon">{check.status === 'warning' ? '⚠' : '✗'}</span>
                              <div className="check-text">
                                <strong>
                                  {key === 'hostScope'
                                    ? 'Host Scope'
                                    : key === 'permissions'
                                    ? 'Sensitive APIs'
                                    : key === 'remoteCode'
                                    ? 'Remote Code'
                                    : key === 'networkAccess'
                                    ? 'Network Access'
                                    : 'Obfuscation Heuristics'}
                                </strong>
                                <span>{check.detail}</span>
                              </div>
                            </li>
                          );
                        })}
                        {Object.values(consentAnalysis.checks).every((c) => c.status === 'pass') && (
                          <li className="audit-item is-pass">
                            <span className="check-icon">✓</span>
                            <div className="check-text">
                              <strong>All Checks Passed</strong>
                              <span>Static analysis found no risk signals.</span>
                            </div>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="burst-consent-warning-box">
                    <span className="warning-icon">⚠</span>
                    <p>
                      Running commands from external sources can access sensitive page details, read inputs, and execute actions on your behalf. Ensure you trust the publisher.
                    </p>
                  </div>
                </div>

                <div className="burst-consent-footer">
                  <button className="btn-cancel" onClick={() => setConsentPendingCommand(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-grant" onClick={handleConfirmConsent} type="button">
                    Grant & Run
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                  {statusMessage ? <div className="burst-status">{statusMessage}</div> : null}
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
              </>
            )}
          </section>
        </div>
      ) : null}
      {toastMessage ? (
        <div className="burst-toast" role="status">
          {toastMessage}
        </div>
      ) : null}
    </>
  );
}

async function runLocalScript(
  scriptId: string,
  selection: string,
  onToast: (message: string) => void,
): Promise<{ ok: boolean; message?: string }> {
  const resultEventName = getLocalScriptResultEventName(scriptId);

  const result = new Promise<{ ok: boolean; message?: string }>((resolve) => {
    const timeout = window.setTimeout(() => {
      document.removeEventListener(resultEventName, handleResult);
      resolve({
        ok: false,
        message: 'Local script is registered for future page loads. Reload this page, then run it again.',
      });
    }, 700);

    function handleResult(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail as { status?: string; message?: string } : {};
      if (detail.status === 'started') return;

      if (detail.status === 'toast' && detail.message) {
        onToast(detail.message);
        return;
      }

      document.removeEventListener(resultEventName, handleResult);
      window.clearTimeout(timeout);
      resolve({
        ok: detail.status === 'complete',
        message: detail.message ?? 'Local script failed.',
      });
    }

    document.addEventListener(resultEventName, handleResult);
  });

  document.dispatchEvent(new CustomEvent(getLocalScriptEventName(scriptId), { detail: { selection } }));
  return result;
}

async function runRegistryScript(
  commandId: string,
  selection: string,
  onToast: (message: string) => void,
): Promise<{ ok: boolean; message?: string }> {
  const resultEventName = getRegistryScriptResultEventName(commandId);

  const result = new Promise<{ ok: boolean; message?: string }>((resolve) => {
    const timeout = window.setTimeout(() => {
      document.removeEventListener(resultEventName, handleResult);
      resolve({
        ok: false,
        message: 'Registry script is registered for future page loads. Reload this page, then run it again.',
      });
    }, 700);

    function handleResult(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail as { status?: string; message?: string } : {};
      if (detail.status === 'started') return;

      if (detail.status === 'toast' && detail.message) {
        onToast(detail.message);
        return;
      }

      document.removeEventListener(resultEventName, handleResult);
      window.clearTimeout(timeout);
      resolve({
        ok: detail.status === 'complete',
        message: detail.message ?? 'Registry script failed.',
      });
    }

    document.addEventListener(resultEventName, handleResult);
  });

  document.dispatchEvent(new CustomEvent(getRegistryScriptEventName(commandId), { detail: { selection } }));
  return result;
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

function isLocalScriptSyncError(
  value: unknown,
): value is { ok: false; message: string } {
  return typeof value === 'object'
    && value !== null
    && 'ok' in value
    && value.ok === false
    && 'message' in value
    && typeof value.message === 'string';
}
