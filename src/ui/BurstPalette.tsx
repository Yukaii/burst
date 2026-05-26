import { useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  BurstCommand,
  BurstCustomList,
  BurstListItem,
  commandMatchesHost,
  getCommandIconLabel,
  getCommandIconUrl,
  getHostFromUrl,
  managementCommands,
  orderPaletteCommands,
  searchCommands,
  searchListItems,
} from '@/src/lib/commands';
import {
  getLocalScriptEventName,
  getLocalScriptResultEventName,
  loadLocalScripts,
  localScriptToCommand,
} from '@/src/lib/localScripts';
import {
  loadInstalledRegistryCommands,
  isRegistryCommandEnabled,
  loadPinnedRegistryCommandIds,
  loadConsentGrants,
  saveConsentGrant,
  getRegistryScriptEventName,
  getRegistryScriptResultEventName,
} from '@/src/lib/registryStorage';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { getMockScriptCode } from '@/src/lib/registryApi';
import { ExtensionSettings, DEFAULT_SETTINGS, loadSettings } from '@/src/lib/settings';
import {
  loadCommandPaletteTheme,
  resolveCommandPaletteThemeMeta,
  type CommandPaletteTheme,
} from '@/src/lib/paletteThemes';
import {
  captureSelectionSnapshot,
  restoreSelectionSnapshot,
  type SelectionSnapshot,
} from '@/src/ui/selection';

type BurstPaletteProps = {
  pageUrl: string;
  pageTitle: string;
};

type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
type ToastAnimation = 'slide' | 'fade' | 'pop' | 'none';
type ToastVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

type BurstToast = {
  id: number;
  title?: string;
  message: string;
  variant: ToastVariant;
  position: ToastPosition;
  animation: ToastAnimation;
  duration: number;
  dismissible: boolean;
  showProgress: boolean;
};

const trustLabels: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

const PALETTE_QUERY_STORAGE_KEY = 'burst.palette.query.v1';
const REGISTRY_STORE_PAGE_SIZE = 20;

export function BurstPalette({ pageUrl, pageTitle }: BurstPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(() => readPaletteQuery());
  const [activeIndex, setActiveIndex] = useState(0);
  const [showNumberHints, setShowNumberHints] = useState(false);
  const [localCommands, setLocalCommands] = useState<BurstCommand[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>();
  const [toast, setToast] = useState<BurstToast>();
  const [consentPendingCommand, setConsentPendingCommand] = useState<BurstCommand | null>(null);
  const [capturedSelection, setCapturedSelection] = useState('');
  const [capturedSelectionSnapshot, setCapturedSelectionSnapshot] =
    useState<SelectionSnapshot | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [paletteTheme, setPaletteTheme] = useState<CommandPaletteTheme | null>(null);
  const [customList, setCustomList] = useState<BurstCustomList | null>(null);
  const [listCommand, setListCommand] = useState<BurstCommand | null>(null);
  const [isRegistryStoreOpen, setIsRegistryStoreOpen] = useState(false);
  const [registryDiscoveryCommands, setRegistryDiscoveryCommands] = useState<BurstCommand[]>([]);
  const [registryDiscoveryLoading, setRegistryDiscoveryLoading] = useState(false);
  const [registryDiscoveryHasMore, setRegistryDiscoveryHasMore] = useState(false);
  const [registryDiscoveryOffset, setRegistryDiscoveryOffset] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const host = useMemo(() => getHostFromUrl(pageUrl), [pageUrl]);
  const isMacPlatform = useMemo(() => /Mac|iPhone|iPad|iPod/.test(navigator.platform), []);

  const consentAnalysis = useMemo(() => {
    if (!consentPendingCommand) return null;
    const code =
      consentPendingCommand.code ||
      getMockScriptCode(consentPendingCommand.registryCommandId ?? consentPendingCommand.id);
    return analyzeScriptCode(code, consentPendingCommand.matchPatterns);
  }, [consentPendingCommand]);

  const siteCommands = useMemo(
    () =>
      isRegistryStoreOpen
        ? registryDiscoveryCommands
        : [
            ...localCommands.filter((command) => commandMatchesHost(command, host)),
            ...managementCommands,
          ],
    [host, isRegistryStoreOpen, localCommands, registryDiscoveryCommands],
  );

  const filteredCommands = useMemo(() => {
    return searchCommands(orderPaletteCommands(siteCommands), query);
  }, [query, siteCommands]);

  const filteredListItems = useMemo(() => {
    return customList ? searchListItems(customList.items, query) : [];
  }, [customList, query]);

  const activeCommand = filteredCommands[activeIndex] ?? filteredCommands[0];
  const activeListItem = filteredListItems[activeIndex] ?? filteredListItems[0];

  function closePalette() {
    restoreSelectionSnapshot(capturedSelectionSnapshot);
    setConsentPendingCommand(null);
    setCustomList(null);
    setListCommand(null);
    setIsOpen(false);
  }

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
        const result = await runLocalScript(command.localScriptId, capturedSelection, setToast);
        if (settings.showConsoleLogs) {
          console.log(`[Burst] Execution outcome for "${command.title}":`, result);
        }
        if (!result.ok) {
          setStatusMessage(result.message);
          return;
        }
        if (result.list) {
          setCustomList(result.list);
          setListCommand(command);
          setQuery('');
          setActiveIndex(0);
          return;
        }
      }

      closePalette();
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

      const result = await runRegistryScript(command.id, capturedSelection, setToast);
      if (settings.showConsoleLogs) {
        console.log(`[Burst] Execution outcome for "${command.title}":`, result);
      }
      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }
      if (result.list) {
        setCustomList(result.list);
        setListCommand(command);
        setQuery('');
        setActiveIndex(0);
        return;
      }
      closePalette();
      return;
    }

    if (command.action === 'install-registry-command') {
      const commandId = command.registryCommandId ?? command.id.replace(/^registry-discover-/, '');
      setStatusMessage(`Installing "${command.title.replace(/^Install:\s*/, '')}"...`);
      const result = await browser.runtime
        .sendMessage({ type: 'burst:install-registry-command', commandId })
        .catch((error) => ({
          ok: false,
          message: error instanceof Error ? error.message : 'Registry install failed.',
        }));

      if (!isInstallRegistryResponse(result) || result.ok === false) {
        setStatusMessage(result?.message || 'Registry install failed.');
        return;
      }

      setLocalCommands((current) => [
        ...current.filter((item) => item.id !== result.command.id),
        { ...result.command, action: 'run-registry-script' as const },
      ]);
      setRegistryDiscoveryCommands((current) =>
        current.map((item) =>
          item.registryCommandId === result.command.id
            ? {
                ...result.command,
                id: result.command.id,
                registryCommandId: result.command.id,
                registryInstalled: true,
                subtitle: `Installed · ${result.command.publisher.handle} · ${result.command.website}`,
                action: 'run-registry-script' as const,
              }
            : item,
        ),
      );
      setStatusMessage(
        result.syncOk === false && result.message
          ? `Installed "${result.command.title}". ${result.message}`
          : `Installed "${result.command.title}". Reload this page if it does not run immediately.`,
      );
      return;
    }

    if (command.id === 'burst-install-script' || command.action === 'open-registry-store') {
      setIsRegistryStoreOpen(true);
      setRegistryDiscoveryCommands([]);
      setQuery('');
      setActiveIndex(0);
      setStatusMessage('Search the Burst registry store.');
      return;
    }

    if (command.action) {
      void browser.runtime.sendMessage({
        type: 'burst:run-management-command',
        action: command.action,
      });
    }

    closePalette();
  }

  async function handleConfirmConsent() {
    if (!consentPendingCommand) return;
    const command = consentPendingCommand;
    await saveConsentGrant(command.id);
    setConsentPendingCommand(null);

    const result = await runRegistryScript(command.id, capturedSelection, setToast);
    if (!result.ok) {
      setStatusMessage(result.message);
      return;
    }
    closePalette();
  }

  useEffect(() => {
    function handleMessage(message: unknown) {
      if (isToggleMessage(message)) {
        setIsOpen((current) => {
          const next = !current;
          if (next) {
            // Capture selection synchronously before palette input autofocus steals focus
            const snapshot = captureSelectionSnapshot(window.getSelection());
            setCapturedSelectionSnapshot(snapshot);
            setCapturedSelection(snapshot.text);
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
      setCapturedSelectionSnapshot(null);
      setIsRegistryStoreOpen(false);
      setRegistryDiscoveryCommands([]);
      setRegistryDiscoveryLoading(false);
      setRegistryDiscoveryHasMore(false);
      setRegistryDiscoveryOffset(0);
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

      const mappedRegistryCmds = registryCmds.filter(isRegistryCommandEnabled).map((cmd) => ({
        ...cmd,
        action: 'run-registry-script' as const,
        pinned: pinnedIds.includes(cmd.id),
      }));

      setLocalCommands([
        ...scripts.filter((script) => script.status === 'enabled').map(localScriptToCommand),
        ...mappedRegistryCmds,
      ]);
    }

    void refreshLocalCommands();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || customList || !isRegistryStoreOpen) return;

    const normalized = query.trim();
    let active = true;
    setRegistryDiscoveryCommands([]);
    setRegistryDiscoveryOffset(0);
    setRegistryDiscoveryHasMore(false);
    setRegistryDiscoveryLoading(true);
    const timeout = window.setTimeout(() => {
      browser.runtime
        .sendMessage({
          type: 'burst:search-registry-commands',
          query: normalized,
          host,
          offset: 0,
          limit: REGISTRY_STORE_PAGE_SIZE,
        })
        .then((response) => {
          if (!active) return;
          if (!isRegistrySearchResponse(response)) {
            setRegistryDiscoveryCommands([]);
            setRegistryDiscoveryHasMore(false);
            return;
          }

          setRegistryDiscoveryCommands(
            mapRegistryStoreCommands(response.commands, response.installedIds),
          );
          setRegistryDiscoveryOffset(response.nextOffset);
          setRegistryDiscoveryHasMore(response.hasMore);
        })
        .catch(() => {
          if (active) setRegistryDiscoveryCommands([]);
        })
        .finally(() => {
          if (active) setRegistryDiscoveryLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [customList, host, isOpen, isRegistryStoreOpen, query]);

  useEffect(() => {
    if (!isOpen || !isRegistryStoreOpen || customList) return;
    const node = resultsRef.current;
    if (!node) return;

    function handleScroll() {
      if (!node || registryDiscoveryLoading || !registryDiscoveryHasMore) return;
      const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (remaining > 96) return;

      setRegistryDiscoveryLoading(true);
      browser.runtime
        .sendMessage({
          type: 'burst:search-registry-commands',
          query: query.trim(),
          host,
          offset: registryDiscoveryOffset,
          limit: REGISTRY_STORE_PAGE_SIZE,
        })
        .then((response) => {
          if (!isRegistrySearchResponse(response)) {
            setRegistryDiscoveryHasMore(false);
            return;
          }
          setRegistryDiscoveryCommands((current) => [
            ...current,
            ...mapRegistryStoreCommands(response.commands, response.installedIds).filter(
              (next) =>
                !current.some((existing) => existing.registryCommandId === next.registryCommandId),
            ),
          ]);
          setRegistryDiscoveryOffset(response.nextOffset);
          setRegistryDiscoveryHasMore(response.hasMore);
        })
        .catch(() => setRegistryDiscoveryHasMore(false))
        .finally(() => setRegistryDiscoveryLoading(false));
    }

    node.addEventListener('scroll', handleScroll);
    return () => node.removeEventListener('scroll', handleScroll);
  }, [
    customList,
    host,
    isOpen,
    isRegistryStoreOpen,
    query,
    registryDiscoveryHasMore,
    registryDiscoveryLoading,
    registryDiscoveryOffset,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (customList) {
          setCustomList(null);
          setListCommand(null);
          setQuery('');
          setActiveIndex(0);
          return;
        }
        if (isRegistryStoreOpen) {
          setIsRegistryStoreOpen(false);
          setRegistryDiscoveryCommands([]);
          setQuery('');
          setActiveIndex(0);
          setStatusMessage(undefined);
          return;
        }
        closePalette();
        return;
      }

      if (consentPendingCommand) {
        if (event.key === 'Enter') {
          event.preventDefault();
          void handleConfirmConsent();
        }
        return;
      }

      const isDown =
        event.key === 'ArrowDown' || (event.ctrlKey && (event.key === 'n' || event.key === 'j'));
      const isUp =
        event.key === 'ArrowUp' || (event.ctrlKey && (event.key === 'p' || event.key === 'k'));

      if (isDown) {
        event.preventDefault();
        const maxIndex = customList ? filteredListItems.length - 1 : filteredCommands.length - 1;
        setActiveIndex((index) => Math.min(index + 1, maxIndex));
        return;
      }

      if (isUp) {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (event.key === 'Enter' && customList && activeListItem && listCommand) {
        event.preventDefault();
        void runListItemAction(listCommand, customList, activeListItem, setToast).then((result) => {
          if (!result.ok) {
            setStatusMessage(result.message);
            return;
          }
          if (result.list) {
            setCustomList(result.list);
            setQuery('');
            setActiveIndex(0);
            return;
          }
          closePalette();
        });
        return;
      }

      if (event.key === 'Enter' && activeCommand) {
        event.preventDefault();
        void runCommand(activeCommand);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    activeCommand,
    activeListItem,
    customList,
    filteredCommands.length,
    filteredListItems.length,
    isOpen,
    isRegistryStoreOpen,
    listCommand,
    consentPendingCommand,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setShowNumberHints(false);
      return;
    }

    const modifierKey = isMacPlatform ? 'Meta' : 'Control';

    function updateShortcutHints(event: KeyboardEvent) {
      const modifierHeld = isMacPlatform ? event.metaKey : event.ctrlKey;

      if (event.key === modifierKey) {
        setShowNumberHints(event.type === 'keydown');
        return;
      }

      setShowNumberHints(modifierHeld);
    }

    function resetShortcutHints() {
      setShowNumberHints(false);
    }

    window.addEventListener('keydown', updateShortcutHints, true);
    window.addEventListener('keyup', updateShortcutHints, true);
    window.addEventListener('blur', resetShortcutHints);
    document.addEventListener('visibilitychange', resetShortcutHints);

    return () => {
      window.removeEventListener('keydown', updateShortcutHints, true);
      window.removeEventListener('keyup', updateShortcutHints, true);
      window.removeEventListener('blur', resetShortcutHints);
      document.removeEventListener('visibilitychange', resetShortcutHints);
    };
  }, [isMacPlatform, isOpen]);

  useEffect(() => {
    writePaletteQuery(query);
    setActiveIndex(0);
    setStatusMessage(undefined);
  }, [query]);

  useEffect(() => {
    if (!toast || toast.duration <= 0) return;

    const timeout = window.setTimeout(() => setToast(undefined), toast.duration);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const activeOption = resultsRef.current?.querySelector<HTMLElement>('.burst-command.is-active');
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, customList, filteredCommands.length, filteredListItems.length, isOpen]);

  const activeTheme =
    settings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : settings.theme;
  const paletteThemeMeta = resolveCommandPaletteThemeMeta(
    settings.commandPaletteTheme,
    pageUrl,
    activeTheme,
  );
  const activePaletteTheme = paletteTheme?.id === paletteThemeMeta.id ? paletteTheme : null;

  useEffect(() => {
    let active = true;
    void loadCommandPaletteTheme(paletteThemeMeta.id).then((theme) => {
      if (active) setPaletteTheme(theme);
    });
    return () => {
      active = false;
    };
  }, [paletteThemeMeta.id]);

  return (
    <>
      <div
        className={`burst-overlay position-${settings.position} theme-${activeTheme} palette-theme-${paletteThemeMeta.id} ${isOpen ? '' : 'is-hidden'}`}
        style={(activePaletteTheme?.variables ?? {}) as React.CSSProperties}
        hidden={!isOpen}
        aria-hidden={!isOpen}
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
                  The command <strong>{consentPendingCommand.title}</strong> by{' '}
                  <code>{consentPendingCommand.publisher.handle}</code> requests permission to run
                  on this site.
                </p>
              </div>

              <div className="burst-consent-body">
                <div className="burst-consent-info-grid">
                  <div className="info-item">
                    <span className="info-label">Publisher</span>
                    <span className="info-value text-glow">
                      {consentPendingCommand.publisher.name} (
                      {consentPendingCommand.publisher.handle})
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
                            <span className="check-icon">
                              {check.status === 'warning' ? '⚠' : '✗'}
                            </span>
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
                    Running commands from external sources can access sensitive page details, read
                    inputs, and execute actions on your behalf. Ensure you trust the publisher.
                  </p>
                </div>
              </div>

              <div className="burst-consent-footer">
                <button
                  className="btn-cancel"
                  onClick={() => setConsentPendingCommand(null)}
                  type="button"
                >
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
                <span>
                  {customList
                    ? (customList.subtitle ?? listCommand?.title ?? host)
                    : isRegistryStoreOpen
                      ? 'Burst Store'
                      : host}
                </span>
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    customList?.searchPlaceholder ??
                    (isRegistryStoreOpen
                      ? 'Search registry commands'
                      : `Search ${pageTitle || host}`)
                  }
                />
              </label>

              <div
                ref={resultsRef}
                className="burst-results"
                role="listbox"
                aria-label={customList ? customList.title : 'Available commands'}
              >
                {statusMessage ? <div className="burst-status">{statusMessage}</div> : null}
                {registryDiscoveryLoading && isRegistryStoreOpen && !customList ? (
                  <div className="burst-status">Searching registry...</div>
                ) : null}
                {customList ? (
                  filteredListItems.length > 0 ? (
                    filteredListItems.map((item, index) => {
                      const shortcutHint = getShortcutHint(
                        index,
                        activeIndex,
                        showNumberHints,
                        isMacPlatform,
                      );

                      return (
                        <button
                          className={`burst-command burst-list-item ${index === activeIndex ? 'is-active' : ''}`}
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => {
                            if (!listCommand || !customList) return;
                            void runListItemAction(listCommand, customList, item, setToast).then(
                              (result) => {
                                if (!result.ok) {
                                  setStatusMessage(result.message);
                                  return;
                                }
                                if (result.list) {
                                  setCustomList(result.list);
                                  setQuery('');
                                  setActiveIndex(0);
                                  return;
                                }
                                closePalette();
                              },
                            );
                          }}
                        >
                          <CommandIcon
                            icon={item.icon}
                            fallbackLabel={item.title.slice(0, 2).toUpperCase()}
                          />
                          <span className="burst-command-copy">
                            <span className="burst-command-title">
                              <strong>{item.title}</strong>
                              {item.subtitle ? (
                                <span className="burst-command-subtitle">{item.subtitle}</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="burst-list-accessory">
                            {item.accessories?.[0] ?? item.actions?.[0]?.title ?? ''}
                          </span>
                          <kbd
                            className={shortcutHint ? '' : 'is-hidden'}
                            aria-hidden={!shortcutHint}
                          >
                            {shortcutHint ?? '↵'}
                          </kbd>
                        </button>
                      );
                    })
                  ) : (
                    <div className="burst-empty">{customList.emptyState ?? 'No items found.'}</div>
                  )
                ) : filteredCommands.length > 0 ? (
                  filteredCommands.map((command, index) => {
                    const shortcutHint = getShortcutHint(
                      index,
                      activeIndex,
                      showNumberHints,
                      isMacPlatform,
                    );

                    return (
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
                          <span className="burst-command-title">
                            <strong>{command.title}</strong>
                            {command.registryInstalled ? (
                              <span className="burst-installed-check" aria-label="Installed">
                                ✓
                              </span>
                            ) : null}
                            {command.subtitle ? (
                              <span className="burst-command-subtitle">{command.subtitle}</span>
                            ) : null}
                          </span>
                        </span>
                        <kbd
                          className={shortcutHint ? '' : 'is-hidden'}
                          aria-hidden={!shortcutHint}
                        >
                          {shortcutHint ?? '↵'}
                        </kbd>
                      </button>
                    );
                  })
                ) : (
                  <div className="burst-empty">No commands found.</div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {toast ? (
        <div
          className={`burst-toast theme-${activeTheme} position-${toast.position} variant-${toast.variant} animation-${toast.animation}`}
          role="status"
          aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
          style={{ '--burst-toast-duration': `${toast.duration}ms` } as React.CSSProperties}
        >
          <span className="burst-toast-icon" aria-hidden="true">
            {getToastIcon(toast.variant)}
          </span>
          <span className="burst-toast-copy">
            {toast.title ? <strong>{toast.title}</strong> : null}
            <span>{toast.message}</span>
          </span>
          {toast.dismissible ? (
            <button
              className="burst-toast-close"
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToast(undefined)}
            >
              <LucideIcons.X size={14} />
            </button>
          ) : null}
          {toast.showProgress && toast.duration > 0 ? (
            <span className="burst-toast-progress" />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

async function runLocalScript(
  scriptId: string,
  selection: string,
  onToast: (toast: BurstToast) => void,
): Promise<{ ok: boolean; message?: string; list?: BurstCustomList }> {
  const resultEventName = getLocalScriptResultEventName(scriptId);

  const result = new Promise<{ ok: boolean; message?: string; list?: BurstCustomList }>(
    (resolve) => {
      const timeout = window.setTimeout(() => {
        document.removeEventListener(resultEventName, handleResult);
        resolve({
          ok: false,
          message:
            'Local script is registered for future page loads. Reload this page, then run it again.',
        });
      }, 700);

      function handleResult(event: Event) {
        const detail = parseBurstEventDetail(event) as {
          status?: string;
          message?: unknown;
          toast?: unknown;
          list?: unknown;
          url?: unknown;
        };
        if (detail.status === 'started') return;

        if (detail.status === 'toast') {
          onToast(normalizeToastPayload(detail.toast ?? detail.message));
          return;
        }

        if (detail.status === 'navigate-open') {
          void openNavigationTab(detail.url, onToast);
          return;
        }

        if (detail.status === 'list' && isBurstCustomList(detail.list)) {
          document.removeEventListener(resultEventName, handleResult);
          window.clearTimeout(timeout);
          resolve({ ok: true, list: detail.list });
          return;
        }

        document.removeEventListener(resultEventName, handleResult);
        window.clearTimeout(timeout);
        resolve({
          ok: detail.status === 'complete',
          message: typeof detail.message === 'string' ? detail.message : 'Local script failed.',
        });
      }

      document.addEventListener(resultEventName, handleResult);
    },
  );

  const CustomEventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
  document.dispatchEvent(
    new CustomEventConstructor(getLocalScriptEventName(scriptId), {
      detail: JSON.stringify({ selection }),
    }),
  );
  return result;
}

async function runRegistryScript(
  commandId: string,
  selection: string,
  onToast: (toast: BurstToast) => void,
): Promise<{ ok: boolean; message?: string; list?: BurstCustomList }> {
  const resultEventName = getRegistryScriptResultEventName(commandId);

  const result = new Promise<{ ok: boolean; message?: string; list?: BurstCustomList }>(
    (resolve) => {
      const timeout = window.setTimeout(() => {
        document.removeEventListener(resultEventName, handleResult);
        resolve({
          ok: false,
          message:
            'Registry script is registered for future page loads. Reload this page, then run it again.',
        });
      }, 700);

      function handleResult(event: Event) {
        const detail = parseBurstEventDetail(event) as {
          status?: string;
          message?: unknown;
          toast?: unknown;
          list?: unknown;
          url?: unknown;
        };
        if (detail.status === 'started') return;

        if (detail.status === 'toast') {
          onToast(normalizeToastPayload(detail.toast ?? detail.message));
          return;
        }

        if (detail.status === 'navigate-open') {
          void openNavigationTab(detail.url, onToast);
          return;
        }

        if (detail.status === 'list' && isBurstCustomList(detail.list)) {
          document.removeEventListener(resultEventName, handleResult);
          window.clearTimeout(timeout);
          resolve({ ok: true, list: detail.list });
          return;
        }

        document.removeEventListener(resultEventName, handleResult);
        window.clearTimeout(timeout);
        resolve({
          ok: detail.status === 'complete',
          message: typeof detail.message === 'string' ? detail.message : 'Registry script failed.',
        });
      }

      document.addEventListener(resultEventName, handleResult);
    },
  );

  const CustomEventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
  document.dispatchEvent(
    new CustomEventConstructor(getRegistryScriptEventName(commandId), {
      detail: JSON.stringify({ selection }),
    }),
  );
  return result;
}

async function runListItemAction(
  command: BurstCommand,
  list: BurstCustomList,
  item: BurstListItem,
  onToast: (toast: BurstToast) => void,
): Promise<{ ok: boolean; message?: string; list?: BurstCustomList }> {
  const action = item.actions?.[0];
  if (!action) return { ok: false, message: 'This list item has no action.' };

  const isRegistry = command.action === 'run-registry-script';
  const resultEventName = isRegistry
    ? getRegistryScriptResultEventName(command.id)
    : command.localScriptId
      ? getLocalScriptResultEventName(command.localScriptId)
      : '';
  const eventName = isRegistry
    ? getRegistryScriptEventName(command.id)
    : command.localScriptId
      ? getLocalScriptEventName(command.localScriptId)
      : '';

  if (!eventName || !resultEventName)
    return { ok: false, message: 'List action source is unavailable.' };

  const result = new Promise<{ ok: boolean; message?: string; list?: BurstCustomList }>(
    (resolve) => {
      const timeout = window.setTimeout(() => {
        document.removeEventListener(resultEventName, handleResult);
        resolve({ ok: false, message: 'List action timed out. Try running the command again.' });
      }, 1200);

      function handleResult(event: Event) {
        const detail = parseBurstEventDetail(event) as {
          status?: string;
          message?: unknown;
          toast?: unknown;
          list?: unknown;
          url?: unknown;
        };

        if (detail.status === 'toast') {
          onToast(normalizeToastPayload(detail.toast ?? detail.message));
          return;
        }

        if (detail.status === 'navigate-open') {
          void openNavigationTab(detail.url, onToast);
          return;
        }

        if (detail.status === 'list' && isBurstCustomList(detail.list)) {
          document.removeEventListener(resultEventName, handleResult);
          window.clearTimeout(timeout);
          resolve({ ok: true, list: detail.list });
          return;
        }

        document.removeEventListener(resultEventName, handleResult);
        window.clearTimeout(timeout);
        resolve({
          ok: detail.status === 'action-complete' || detail.status === 'complete',
          message: typeof detail.message === 'string' ? detail.message : 'List action failed.',
        });
      }

      document.addEventListener(resultEventName, handleResult);
    },
  );

  const CustomEventConstructor = document.defaultView?.CustomEvent ?? CustomEvent;
  document.dispatchEvent(
    new CustomEventConstructor(eventName, {
      detail: JSON.stringify({
        kind: 'list-action',
        listId: list.id,
        itemId: item.id,
        actionId: action.id,
      }),
    }),
  );

  return result;
}

function parseBurstEventDetail(event: Event): unknown {
  if (typeof event !== 'object' || event === null || !('detail' in event)) return {};
  const detail = (event as any).detail;
  if (typeof detail === 'string') {
    try {
      const parsed = JSON.parse(detail);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return detail && typeof detail === 'object' ? detail : {};
}

async function openNavigationTab(url: unknown, onToast: (toast: BurstToast) => void) {
  if (typeof url !== 'string' || !url) {
    onToast(normalizeToastPayload({ variant: 'error', message: 'Navigation URL is unavailable.' }));
    return;
  }

  const result = await browser.runtime
    .sendMessage({ type: 'burst:navigate-open', url })
    .catch((error) => ({
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to open tab.',
    }));

  if (!isRecord(result) || result.ok !== true) {
    onToast(
      normalizeToastPayload({
        variant: 'error',
        message: typeof result?.message === 'string' ? result.message : 'Failed to open tab.',
      }),
    );
  }
}

function normalizeToastPayload(payload: unknown): BurstToast {
  const options = isRecord(payload) ? payload : {};
  const message =
    typeof payload === 'string'
      ? payload
      : typeof options.message === 'string'
        ? options.message
        : typeof options.description === 'string'
          ? options.description
          : 'Command finished';

  return {
    id: Date.now(),
    title: typeof options.title === 'string' ? truncateText(options.title, 80) : undefined,
    message: truncateText(message, 240),
    variant: readOneOf(
      options.variant,
      ['default', 'info', 'success', 'warning', 'error'],
      'default',
    ),
    position: readOneOf(
      options.position,
      ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'],
      'bottom-right',
    ),
    animation: readOneOf(options.animation, ['slide', 'fade', 'pop', 'none'], 'slide'),
    duration: readDuration(options.duration),
    dismissible:
      typeof options.dismissible === 'boolean'
        ? options.dismissible
        : typeof options.closeButton === 'boolean'
          ? options.closeButton
          : true,
    showProgress:
      typeof options.showProgress === 'boolean'
        ? options.showProgress
        : typeof options.progress === 'boolean'
          ? options.progress
          : true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapRegistryStoreCommands(
  commands: BurstCommand[],
  installedIdsValue: string[],
): BurstCommand[] {
  const installedIds = new Set(installedIdsValue);
  return commands.map((command) => {
    const registryInstalled = installedIds.has(command.id);
    return {
      ...command,
      id: registryInstalled ? command.id : `registry-discover-${command.id}`,
      registryCommandId: command.id,
      registryInstalled,
      title: registryInstalled ? command.title : `Install: ${command.title}`,
      subtitle: `${registryInstalled ? 'Installed · ' : ''}${command.publisher.handle} · ${command.website}`,
      action: registryInstalled
        ? ('run-registry-script' as const)
        : ('install-registry-command' as const),
    };
  });
}

function isRegistrySearchResponse(value: unknown): value is {
  commands: BurstCommand[];
  installedIds: string[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number;
} {
  if (!isRecord(value) || !Array.isArray(value.commands) || !Array.isArray(value.installedIds))
    return false;
  return (
    typeof value.nextOffset === 'number' &&
    typeof value.hasMore === 'boolean' &&
    value.commands.every(
      (command) =>
        isRecord(command) && typeof command.id === 'string' && typeof command.title === 'string',
    )
  );
}

function isInstallRegistryResponse(value: unknown): value is {
  ok?: boolean;
  syncOk?: boolean;
  message?: string;
  command: BurstCommand;
  installedIds: string[];
  pinnedIds: string[];
} {
  return (
    isRecord(value) &&
    isRecord(value.command) &&
    typeof value.command.id === 'string' &&
    typeof value.command.title === 'string' &&
    Array.isArray(value.installedIds) &&
    Array.isArray(value.pinnedIds)
  );
}

function isBurstCustomList(value: unknown): value is BurstCustomList {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string',
    )
  );
}

function readOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function readDuration(value: unknown): number {
  if (value === 0 || value === false) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) return 3200;
  return Math.max(800, Math.min(15000, Math.round(value)));
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function getToastIcon(variant: ToastVariant): string {
  if (variant === 'success') return '✓';
  if (variant === 'warning') return '!';
  if (variant === 'error') return '×';
  if (variant === 'info') return 'i';
  return '•';
}

function getShortcutHint(
  index: number,
  activeIndex: number,
  showNumberHints: boolean,
  isMacPlatform: boolean,
): string | null {
  if (!showNumberHints) {
    return index === activeIndex ? '↵' : null;
  }

  const shortcutNumber = index <= 8 ? String(index + 1) : index === 9 ? '0' : null;
  if (!shortcutNumber) return null;

  return `${isMacPlatform ? '⌘' : 'Ctrl+'}${shortcutNumber}`;
}

function readPaletteQuery(): string {
  try {
    return window.sessionStorage.getItem(PALETTE_QUERY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writePaletteQuery(query: string): void {
  try {
    if (query) {
      window.sessionStorage.setItem(PALETTE_QUERY_STORAGE_KEY, query);
    } else {
      window.sessionStorage.removeItem(PALETTE_QUERY_STORAGE_KEY);
    }
  } catch {
    // Some pages restrict storage access; the palette still works without persistence.
  }
}

function CommandIcon({
  command,
  icon = command?.icon,
  fallbackLabel,
}: {
  command?: BurstCommand;
  icon?: BurstCommand['icon'];
  fallbackLabel?: string;
}) {
  if (icon?.type === 'lucide') {
    const IconComponent = (LucideIcons as any)[icon.name];
    return (
      <span className="burst-command-icon">
        {IconComponent ? <IconComponent size={18} /> : <LucideIcons.Code size={18} />}
      </span>
    );
  }

  const iconUrl = command
    ? getCommandIconUrl(command)
    : icon && (icon.type === 'url' || icon.type === 'asset')
      ? icon.src
      : undefined;

  if (iconUrl) {
    return (
      <span className="burst-command-icon">
        <img src={iconUrl} alt="" />
      </span>
    );
  }

  if (command) return <span className="burst-command-icon">{getCommandIconLabel(command)}</span>;
  if (icon?.type === 'emoji' || icon?.type === 'initials')
    return <span className="burst-command-icon">{icon.value}</span>;
  return <span className="burst-command-icon">{fallbackLabel ?? 'LI'}</span>;
}

function isToggleMessage(message: unknown): message is { type: 'burst:toggle-palette' } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'burst:toggle-palette'
  );
}

function isLocalScriptSyncError(value: unknown): value is { ok: false; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === false &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
