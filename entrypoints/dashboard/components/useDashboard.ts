import { useEffect, useMemo, useState, useRef } from 'react';
import type { LocalScript } from '@/src/lib/localScripts';
import {
  createLocalScriptBackup,
  createLocalScriptDraft,
  loadLocalScripts,
  parseLocalScriptBackup,
  prepareLocalScriptForSave,
  saveLocalScripts,
} from '@/src/lib/localScripts';
import {
  isRegistryCommandEnabled,
  loadInstalledRegistryCommands,
  saveInstalledRegistryCommands,
  setRegistryCommandStatus,
  uninstallRegistryCommand,
  uninstallRegistryCommandPack,
} from '@/src/lib/registryStorage';
import { getRegistryCommand } from '@/src/lib/registryApi';
import type { BurstCommand } from '@/src/lib/commands';
import { ExtensionSettings, DEFAULT_SETTINGS, getRegistryServerBaseUrl, loadSettings, saveSettings } from '@/src/lib/settings';
import { formatLocalScriptCode, parseGitUrl, loadGitRegistries, saveGitRegistries, validateLocalScriptCode } from './utils';
import type { GitRegistry, ScriptUpdate } from './types';

type DashboardRoute =
  | { view: 'script'; id?: string }
  | { view: 'registry'; id?: string }
  | { view: 'updates' }
  | { view: 'git'; id: string };

function parseDashboardHash(): DashboardRoute {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [view, id] = raw.split('/').map(decodeURIComponent);
  if (view === 'registry') return { view: 'registry', id };
  if (view === 'updates') return { view: 'updates' };
  if (view === 'git' && id) return { view: 'git', id };
  return { view: 'script', id: view === 'script' ? id : undefined };
}

function writeDashboardHash(route: DashboardRoute) {
  const next = route.view === 'script' && route.id
    ? `#/script/${encodeURIComponent(route.id)}`
    : route.view === 'registry' && route.id
    ? `#/registry/${encodeURIComponent(route.id)}`
    : route.view === 'git'
    ? `#/git/${encodeURIComponent(route.id)}`
    : '#/updates';
  if (window.location.hash !== next) {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  }
}

export function useDashboard() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [scripts, setScripts] = useState<LocalScript[]>([]);
  const [installedRegistryCommands, setInstalledRegistryCommands] = useState<BurstCommand[]>([]);
  const [selectedRegistryCommandId, setSelectedRegistryCommandId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [editorFontFamily, setEditorFontFamily] = useState('"SFMono-Regular", Consolas, "Liberation Mono", monospace');
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [editorTheme, setEditorTheme] = useState('default');
  const [editorKeymap, setEditorKeymap] = useState<'default' | 'vim' | 'emacs'>('default');
  const [editorWordWrap, setEditorWordWrap] = useState(true);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveState, setSaveState] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [testOutput, setTestOutput] = useState('Ready. Test runs will execute against the current editor source.');
  const [mockUrl, setMockUrl] = useState('https://github.com/burst/examples');
  const [mockTitle, setMockTitle] = useState('burst/examples: GitHub');
  const [mockSelection, setMockSelection] = useState('v0.1.0-draft');
  const [mockHtml, setMockHtml] = useState('\n<div data-icv-name="Switch branches/tags">v0.1.0-draft</div>\n');

  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('burst.dashboard.leftWidth');
    return saved ? Number.parseInt(saved, 10) : 280;
  });
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('burst.dashboard.rightWidth');
    return saved ? Number.parseInt(saved, 10) : 360;
  });
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('burst.dashboard.leftSidebarOpen');
    return saved !== 'false';
  });
  const [rightPanelOpen, setRightPanelOpen] = useState(() => {
    const saved = localStorage.getItem('burst.dashboard.rightPanelOpen');
    return saved === 'true';
  });
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const [activeTab, setActiveTab] = useState<'editor' | 'git-updates'>('editor');
  const [gitRegistries, setGitRegistries] = useState<GitRegistry[]>([]);
  const [selectedGitView, setSelectedGitView] = useState<'updates' | string>('updates');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [availableUpdates, setAvailableUpdates] = useState<ScriptUpdate[]>([]);
  const [updateStatusText, setUpdateStatusText] = useState('Not checked yet.');
  const [hasUserScriptsPermission, setHasUserScriptsPermission] = useState(true);

  const [editorPrefModalOpen, setEditorPrefModalOpen] = useState(false);
  const [testHarnessOpen, setTestHarnessOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void | Promise<void>;
    isDestructive?: boolean;
  }>({ open: false, title: '', message: '' });

  const selectedScript = scripts.find((script) => script.id === selectedId) ?? scripts[0];
  const selectedRegistryCommand = installedRegistryCommands.find((command) => command.id === selectedRegistryCommandId);

  useEffect(() => {
    if (settings.editorFontFamily) setEditorFontFamily(settings.editorFontFamily);
    if (settings.editorFontSize) setEditorFontSize(settings.editorFontSize);
    if (settings.editorTheme) setEditorTheme(settings.editorTheme);
    if (settings.editorKeymap) setEditorKeymap(settings.editorKeymap);
    if (settings.editorWordWrap !== undefined) setEditorWordWrap(settings.editorWordWrap);
  }, [settings.editorFontFamily, settings.editorFontSize, settings.editorTheme, settings.editorKeymap, settings.editorWordWrap]);

  async function updateEditorSettings(
    fontFamily: string, fontSize: number, theme: string,
    keymap: 'default' | 'vim' | 'emacs', wordWrap: boolean
  ) {
    setEditorFontFamily(fontFamily); setEditorFontSize(fontSize); setEditorTheme(theme);
    setEditorKeymap(keymap); setEditorWordWrap(wordWrap);
    const next = { ...settings, editorFontFamily: fontFamily, editorFontSize: fontSize, editorTheme: theme, editorKeymap: keymap, editorWordWrap: wordWrap };
    setSettings(next); await saveSettings(next);
  }

  const startLeftDrag = (e: React.MouseEvent) => { e.preventDefault(); setIsDraggingLeft(true); };
  const startRightDrag = (e: React.MouseEvent) => { e.preventDefault(); setIsDraggingRight(true); };

  useEffect(() => {
    if (!isDraggingLeft && !isDraggingRight) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const w = Math.max(180, Math.min(500, e.clientX));
        setLeftWidth(w); localStorage.setItem('burst.dashboard.leftWidth', String(w));
      } else if (isDraggingRight) {
        const w = Math.max(240, Math.min(600, window.innerWidth - e.clientX));
        setRightWidth(w); localStorage.setItem('burst.dashboard.rightWidth', String(w));
      }
    };
    const handleMouseUp = () => { setIsDraggingLeft(false); setIsDraggingRight(false); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDraggingLeft, isDraggingRight]);

  useEffect(() => {
    function checkPermission() {
      const hasWxt = typeof browser !== 'undefined' && !!(browser as unknown as { userScripts?: unknown }).userScripts;
      const hasChrome = typeof window !== 'undefined' && 'chrome' in window && !!((window as unknown as { chrome?: { userScripts?: unknown } }).chrome?.userScripts);
      setHasUserScriptsPermission(hasWxt || hasChrome);
    }
    checkPermission();
    window.addEventListener('focus', checkPermission);
    return () => window.removeEventListener('focus', checkPermission);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const storedScripts = await loadLocalScripts();
        const storedRegistryCommands = await loadInstalledRegistryCommands();
        const storedRegistries = await loadGitRegistries();
        const params = new URLSearchParams(window.location.search);
        const shouldCreateDraft = params.get('mode') === 'new' || params.has('new');
        const nextScripts = shouldCreateDraft ? [createLocalScriptDraft(), ...storedScripts] : storedScripts;
        if (shouldCreateDraft) {
          await saveLocalScripts(nextScripts);
          params.delete('mode'); params.delete('new');
          const nextSearch = params.toString();
          window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`);
        }
        if (cancelled) return;
        const route = parseDashboardHash();
        setScripts(nextScripts);
        setInstalledRegistryCommands(storedRegistryCommands);
        setGitRegistries(storedRegistries);
        applyDashboardRoute(route, nextScripts, storedRegistryCommands, storedRegistries);
        setLoadState('ready');
        setSaveState(shouldCreateDraft ? 'Draft saved' : '');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setSaveState(error instanceof Error ? error.message : 'Failed to load scripts');
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, []);

  function applyDashboardRoute(
    route: DashboardRoute,
    currentScripts = scripts,
    currentRegistryCommands = installedRegistryCommands,
    currentGitRegistries = gitRegistries,
  ) {
    if (route.view === 'registry' && route.id && currentRegistryCommands.some((command) => command.id === route.id)) {
      setActiveTab('editor');
      setSelectedRegistryCommandId(route.id);
      setSelectedId(undefined);
      return;
    }
    if (route.view === 'updates') {
      setActiveTab('git-updates');
      setSelectedGitView('updates');
      return;
    }
    if (route.view === 'git' && currentGitRegistries.some((registry) => registry.id === route.id)) {
      setActiveTab('git-updates');
      setSelectedGitView(route.id);
      return;
    }
    const nextScriptId = route.view === 'script' && route.id && currentScripts.some((script) => script.id === route.id)
      ? route.id
      : currentScripts[0]?.id;
    setActiveTab('editor');
    setSelectedRegistryCommandId(undefined);
    setSelectedId(nextScriptId);
  }

  useEffect(() => {
    if (loadState !== 'ready') return;
    function handleHashChange() {
      applyDashboardRoute(parseDashboardHash());
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [loadState, scripts, installedRegistryCommands, gitRegistries]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    if (activeTab === 'editor' && selectedRegistryCommandId) {
      writeDashboardHash({ view: 'registry', id: selectedRegistryCommandId });
    } else if (activeTab === 'editor' && selectedId) {
      writeDashboardHash({ view: 'script', id: selectedId });
    } else if (activeTab === 'git-updates' && selectedGitView === 'updates') {
      writeDashboardHash({ view: 'updates' });
    } else if (activeTab === 'git-updates') {
      writeDashboardHash({ view: 'git', id: selectedGitView });
    }
  }, [activeTab, loadState, selectedGitView, selectedId, selectedRegistryCommandId]);

  useEffect(() => {
    async function init() { const loaded = await loadSettings(); setSettings(loaded); }
    void init();
    if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
      const handler = (changes: Record<string, unknown>, areaName: string) => {
        if (areaName === 'local' && changes['burst.settings.v1']) {
          const nv = (changes['burst.settings.v1'] as { newValue?: ExtensionSettings }).newValue;
          if (nv) setSettings(nv);
        }
      };
      browser.storage.onChanged.addListener(handler as Parameters<typeof browser.storage.onChanged.addListener>[0]);
      return () => browser.storage.onChanged.removeListener(handler as Parameters<typeof browser.storage.onChanged.removeListener>[0]);
    }
  }, []);

  useEffect(() => {
    async function refreshInstalledRegistryCommands() {
      setInstalledRegistryCommands(await loadInstalledRegistryCommands());
    }

    window.addEventListener('focus', refreshInstalledRegistryCommands);
    return () => window.removeEventListener('focus', refreshInstalledRegistryCommands);
  }, []);

  const activeTheme = useMemo(() => {
    return settings.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.className = `theme-${activeTheme}`;
    if (settings.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => { document.documentElement.className = `theme-${media.matches ? 'light' : 'dark'}`; };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [activeTheme, settings.theme]);

  useEffect(() => {
    if (!hasUnsavedChanges || loadState !== 'ready' || !selectedScript) return;
    const timeout = window.setTimeout(() => void saveSelectedScript('Autosaved'), 800);
    return () => window.clearTimeout(timeout);
  }, [hasUnsavedChanges, loadState, scripts, selectedScript?.id]);

  async function persistScripts(nextScripts: LocalScript[], successMessage: string) {
    try {
      await saveLocalScripts(nextScripts);
      if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
        void browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
      }
      setSaveState(successMessage);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Failed to save scripts');
    }
  }

  function updateSelectedScript(patch: Partial<LocalScript>) {
    if (!selectedScript) return;
    setScripts(current => current.map(s => s.id === selectedScript.id ? { ...s, ...patch } : s));
    setHasUnsavedChanges(true); setSaveState('Unsaved changes');
  }

  function navigateToScript(id: string | undefined) {
    if (!id) return;
    setActiveTab('editor');
    setSelectedId(id);
    setSelectedRegistryCommandId(undefined);
    writeDashboardHash({ view: 'script', id });
  }

  function navigateToRegistryCommand(id: string) {
    setActiveTab('editor');
    setSelectedRegistryCommandId(id);
    setSelectedId(undefined);
    writeDashboardHash({ view: 'registry', id });
  }

  function navigateToGitView(view: 'updates' | string) {
    setActiveTab('git-updates');
    setSelectedGitView(view);
    writeDashboardHash(view === 'updates' ? { view: 'updates' } : { view: 'git', id: view });
  }

  async function saveSelectedScript(successMessage = 'Saved') {
    if (!selectedScript) return;
    const syntax = validateLocalScriptCode(selectedScript.code);
    if (!syntax.ok) {
      setSaveState(`Syntax error: ${syntax.message}`);
      return;
    }
    const nextScripts = scripts.map(s => s.id === selectedScript.id ? prepareLocalScriptForSave(s) : s);
    setScripts(nextScripts); setSaveState('Saving...');
    await persistScripts(nextScripts, successMessage); setHasUnsavedChanges(false);
  }

  function formatSelectedScript() {
    if (!selectedScript) return;
    try {
      const code = formatLocalScriptCode(selectedScript.code);
      setScripts(current => current.map(s => s.id === selectedScript.id ? { ...s, code } : s));
      setHasUnsavedChanges(true);
      setSaveState('Formatted');
    } catch (error) {
      setSaveState(`Format failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function createDraft() {
    const draft = createLocalScriptDraft();
    const nextScripts = [draft, ...scripts];
    setScripts(nextScripts); navigateToScript(draft.id);
    await persistScripts(nextScripts, 'Draft saved');
  }

  async function deleteSelectedScript() {
    if (!selectedScript) return;
    const idx = scripts.findIndex(s => s.id === selectedScript.id);
    const nextScripts = scripts.filter(s => s.id !== selectedScript.id);
    const fallback = nextScripts.length > 0 ? undefined : createLocalScriptDraft();
    const finalScripts = fallback ? [fallback] : nextScripts;
    const nextSelection = (finalScripts[Math.max(0, idx - 1)] ?? finalScripts[0]).id;
    setScripts(finalScripts); navigateToScript(nextSelection);
    await persistScripts(finalScripts, fallback ? 'Deleted script and created a draft' : 'Deleted script');
  }

  function exportScripts() {
    const backup = createLocalScriptBackup(scripts);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `burst-local-scripts-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setSaveState(`Exported ${backup.scripts.length} scripts`);
  }

  async function setScriptStatusDirectly(script: LocalScript, status: LocalScript['status']) {
    if (status === 'enabled') {
      const syntax = validateLocalScriptCode(script.code);
      if (!syntax.ok) {
        setSaveState(`Cannot enable "${script.name}": ${syntax.message}`);
        return;
      }
    }
    const nextScripts = scripts.map(s => s.id === script.id ? prepareLocalScriptForSave({ ...s, status }) : s);
    setScripts(nextScripts); await persistScripts(nextScripts, 'Saved');
  }

  async function setRegistryCommandStatusDirectly(command: BurstCommand, status: 'enabled' | 'disabled') {
    await setRegistryCommandStatus(command.id, status);
    const next = (await loadInstalledRegistryCommands()).map((item) => (
      item.id === command.id ? { ...item, status } : item
    ));
    setInstalledRegistryCommands(next);
    if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
      await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
    }
    setSaveState(isRegistryCommandEnabled({ status }) ? 'Enabled registry command' : 'Disabled registry command');
  }

  async function setRegistryCommandPackStatusDirectly(packId: string, status: 'enabled' | 'disabled') {
    const packCommands = installedRegistryCommands.filter((command) => command.packId === packId);
    for (const command of packCommands) {
      await setRegistryCommandStatus(command.id, status);
    }
    const next = (await loadInstalledRegistryCommands()).map((item) => (
      item.packId === packId ? { ...item, status } : item
    ));
    setInstalledRegistryCommands(next);
    if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
      await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
    }
    setSaveState(isRegistryCommandEnabled({ status }) ? 'Enabled registry pack' : 'Disabled registry pack');
  }

  async function uninstallOfficialRegistryCommand(commandId: string) {
    await uninstallRegistryCommand(commandId);
    const next = await loadInstalledRegistryCommands();
    setInstalledRegistryCommands(next);
    if (selectedRegistryCommandId === commandId) {
      setSelectedRegistryCommandId(undefined);
      navigateToScript(scripts[0]?.id);
    }
    if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
      await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
    }
    setSaveState('Uninstalled registry command');
  }

  async function uninstallOfficialRegistryCommandPack(packId: string) {
    const removedIds = installedRegistryCommands.filter((command) => command.packId === packId).map((command) => command.id);
    await uninstallRegistryCommandPack(packId);
    const next = await loadInstalledRegistryCommands();
    setInstalledRegistryCommands(next);
    if (selectedRegistryCommandId && removedIds.includes(selectedRegistryCommandId)) {
      setSelectedRegistryCommandId(undefined);
      navigateToScript(scripts[0]?.id);
    }
    if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
      await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
    }
    setSaveState('Uninstalled registry pack');
  }

  async function forkOfficialRegistryCommand(command: BurstCommand) {
    const existing = scripts.find((script) => script.originRegistryKind === 'official' && script.originCommandId === command.id);
    const baseCode = command.code || '';
    if (existing) {
      setSelectedId(existing.id);
      setSaveState(`Opened fork "${existing.name}"`);
      return;
    }

    const fork: LocalScript = {
      id: `local-fork-${command.id}-${Date.now()}`,
      name: `${command.title} fork`,
      matchPatterns: command.matchPatterns.length > 0 ? command.matchPatterns : ['<all_urls>'],
      icon: command.icon || { type: 'initials', value: command.title.substring(0, 2).toUpperCase() },
      status: 'enabled',
      updatedAt: new Date().toISOString().slice(0, 10),
      code: baseCode,
      originRegistryUrl: getRegistryServerBaseUrl(settings),
      originRegistryKind: 'official',
      originCommandId: command.id,
      upstreamCodeAtFork: baseCode,
      version: command.version || '1.0.0',
    };
    const nextScripts = [fork, ...scripts];
    setScripts(nextScripts);
    navigateToScript(fork.id);
    await persistScripts(nextScripts, `Forked "${command.title}" for local customization`);
  }

  async function unlinkForkedScript(scriptId: string) {
    const script = scripts.find((item) => item.id === scriptId);
    if (!script) return;
    const confirmed = window.confirm(`Unlink "${script.name}" from registry updates? It will remain as a local script.`);
    if (!confirmed) return;
    const nextScripts = scripts.map((script) => script.id === scriptId ? prepareLocalScriptForSave({
      ...script,
      originRegistryUrl: undefined,
      originRegistryKind: undefined,
      originCommandId: undefined,
      upstreamCodeAtFork: undefined,
      version: undefined,
    }) : script);
    setScripts(nextScripts);
    await persistScripts(nextScripts, 'Unlinked customized script from registry updates');
  }

  async function resetForkedScriptToUpstream(scriptId: string) {
    const script = scripts.find((item) => item.id === scriptId);
    if (!script?.upstreamCodeAtFork) return;
    const confirmed = window.confirm(`Reset "${script.name}" to the last known registry source? Local edits will be replaced.`);
    if (!confirmed) return;
    const nextScripts = scripts.map((item) => item.id === scriptId ? prepareLocalScriptForSave({
      ...item,
      code: script.upstreamCodeAtFork!,
    }) : item);
    setScripts(nextScripts);
    await persistScripts(nextScripts, 'Reset fork to registry source');
  }

  function exportSingleScript(script: LocalScript) {
    const backup = createLocalScriptBackup([script]);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `burst-script-${script.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setSaveState(`Exported "${script.name}"`);
  }

  async function importScripts(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const importedScripts = parseLocalScriptBackup(parsed);
      if (importedScripts.length === 0) { setSaveState('Import failed: no valid scripts found'); return; }
      setScripts(importedScripts); setSelectedId(importedScripts[0].id);
      await persistScripts(importedScripts, `Imported ${importedScripts.length} scripts`);
    } catch (error) { setSaveState(error instanceof Error ? error.message : 'Import failed'); }
  }

  async function handleAddRegistry(e: React.FormEvent) {
    e.preventDefault(); setAddError('');
    const parsed = parseGitUrl(newRepoUrl);
    if (!parsed) { setAddError('Invalid URL. Format: github.com/owner/repo or owner/repo'); return; }
    const id = `git-${parsed.owner}-${parsed.repo}`;
    if (gitRegistries.some(r => r.id === id)) { setAddError('This registry is already added.'); return; }
    setAddError('Fetching manifest...');
    try {
      const manifestUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.commands.json`;
      const fallbackUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.command.json`;
      let res = await fetch(manifestUrl);
      if (!res.ok) res = await fetch(fallbackUrl);
      if (!res.ok) throw new Error(`Could not find burst.commands.json or burst.command.json in ${parsed.owner}/${parsed.repo}`);
      const json = await res.json();
      const manifestCommands = Array.isArray(json) ? json : (json.commands || []);
      const newRegistry: GitRegistry = {
        id, url: `https://github.com/${parsed.owner}/${parsed.repo}`,
        name: `${parsed.owner}/${parsed.repo}`,
        owner: parsed.owner, repo: parsed.repo, branch: parsed.branch,
        commands: manifestCommands,
      };
      const nextRegistries = [...gitRegistries, newRegistry];
      setGitRegistries(nextRegistries); await saveGitRegistries(nextRegistries);
      setNewRepoUrl(''); setAddError(''); navigateToGitView(id);
    } catch (error) { setAddError(error instanceof Error ? error.message : 'Failed to fetch manifest'); }
  }

  async function handleRemoveRegistry(id: string) {
    const reg = gitRegistries.find(r => r.id === id);
    if (!reg) return;
    const next = gitRegistries.filter(r => r.id !== id);
    setGitRegistries(next); await saveGitRegistries(next); navigateToGitView('updates');
  }

  async function installGitCommand(command: BurstCommand, registry: GitRegistry) {
    const alreadyInstalled = scripts.find(s => s.originRegistryUrl === registry.url && s.originCommandId === command.id);
    if (alreadyInstalled) {
      const nextScripts = scripts.map(s => s.id === alreadyInstalled.id ? {
        ...s, name: command.title,
        matchPatterns: command.matchPatterns.length > 0 ? command.matchPatterns : ['<all_urls>'],
        icon: command.icon || { type: 'initials', value: command.title.substring(0, 2).toUpperCase() },
        code: command.code || '', version: command.version || '1.0.0',
        updatedAt: new Date().toISOString().slice(0, 10),
      } : s);
      setScripts(nextScripts);
      await persistScripts(nextScripts, `Updated local script "${command.title}"`);
      return;
    }
    const newScript: LocalScript = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: command.title,
      matchPatterns: command.matchPatterns.length > 0 ? command.matchPatterns : ['<all_urls>'],
      icon: command.icon || { type: 'initials', value: command.title.substring(0, 2).toUpperCase() },
      status: 'enabled', updatedAt: new Date().toISOString().slice(0, 10),
      code: command.code || '', originRegistryUrl: registry.url, originCommandId: command.id,
      version: command.version || '1.0.0',
    };
    const nextScripts = [newScript, ...scripts];
    setScripts(nextScripts);
    await persistScripts(nextScripts, `Installed local script "${command.title}"`);
  }

  async function checkUpdates() {
    setIsCheckingUpdates(true); setUpdateStatusText('Checking for updates...');
    const officialUpdates: ScriptUpdate[] = []; const gitUpdates: ScriptUpdate[] = []; const forkUpdates: ScriptUpdate[] = [];
    try {
      const installedRegistryCmds = await loadInstalledRegistryCommands();
      for (const cmd of installedRegistryCmds) {
        try {
          const officialCmd = await getRegistryCommand(cmd.id, getRegistryServerBaseUrl(settings));
          if (officialCmd?.version && cmd.version && officialCmd.version !== cmd.version) {
            officialUpdates.push({ type: 'official', id: cmd.id, name: cmd.title, currentVersion: cmd.version, latestVersion: officialCmd.version, code: officialCmd.code || '', manifestCommand: officialCmd });
          }
        } catch (e) { console.error(`Failed to check update for official command ${cmd.id}:`, e); }
      }
      const officialForks = scripts.filter(s => s.originRegistryKind === 'official' && s.originCommandId);
      for (const script of officialForks) {
        try {
          const remoteCmd = await getRegistryCommand(script.originCommandId!, getRegistryServerBaseUrl(settings));
          if (remoteCmd?.version && script.version && remoteCmd.version !== script.version) {
            forkUpdates.push({
              type: 'fork',
              id: script.id,
              name: script.name,
              currentVersion: script.version,
              latestVersion: remoteCmd.version,
              code: remoteCmd.code || '',
              hasLocalChanges: Boolean(script.upstreamCodeAtFork && script.code !== script.upstreamCodeAtFork),
              upstreamCodeAtFork: script.upstreamCodeAtFork,
              manifestCommand: remoteCmd,
            });
          }
        } catch (e) { console.error(`Failed to check update for fork ${script.id}:`, e); }
      }
      const gitScripts = scripts.filter(s => s.originRegistryUrl && s.originCommandId && s.originRegistryKind !== 'official');
      const uniqueUrls = Array.from(new Set(gitScripts.map(s => s.originRegistryUrl).filter((url): url is string => !!url)));
      for (const url of uniqueUrls) {
        try {
          const parsed = parseGitUrl(url); if (!parsed) continue;
          let manifestData: Array<{ id?: string; version?: string; code?: string }> = [];
          const manifestUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.commands.json`;
          const fallbackUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.command.json`;
          let res = await fetch(manifestUrl); if (!res.ok) res = await fetch(fallbackUrl);
          if (res.ok) { const json = await res.json(); manifestData = Array.isArray(json) ? json : (json.commands || []); }
          const scriptsForUrl = gitScripts.filter(s => s.originRegistryUrl === url);
          for (const script of scriptsForUrl) {
            const remoteCmd = manifestData.find(c => c.id === script.originCommandId);
            if (remoteCmd?.version && script.version && remoteCmd.version !== script.version) {
              gitUpdates.push({ type: 'git', id: script.id, name: script.name, currentVersion: script.version, latestVersion: remoteCmd.version, code: remoteCmd.code || '' });
            }
          }
        } catch (e) { console.error(`Failed to check updates for Git registry ${url}:`, e); }
      }
      const allUpdates = [...officialUpdates, ...forkUpdates, ...gitUpdates];
      setAvailableUpdates(allUpdates);
      setUpdateStatusText(allUpdates.length > 0 ? `Found ${allUpdates.length} update(s).` : 'All scripts are up to date.');
    } catch (err) { setUpdateStatusText('Error checking for updates.'); console.error(err); }
    finally { setIsCheckingUpdates(false); }
  }

  async function handleUpdateScript(update: ScriptUpdate) {
    try {
      if (update.type === 'official') {
        const installed = await loadInstalledRegistryCommands();
        const updated = installed.map(cmd => cmd.id === update.id && update.manifestCommand ? update.manifestCommand : cmd);
        await saveInstalledRegistryCommands(updated);
      } else {
        if (update.type === 'fork' && update.hasLocalChanges) {
          const confirmed = window.confirm(`"${update.name}" has local customizations. Replace your fork with the registry version?`);
          if (!confirmed) return;
        }
        const nextScripts = scripts.map(s => s.id === update.id ? {
          ...s,
          code: update.code,
          version: update.latestVersion,
          upstreamCodeAtFork: update.code,
          updatedAt: new Date().toISOString().slice(0, 10),
        } : s);
        setScripts(nextScripts); await saveLocalScripts(nextScripts);
      }
      if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
        await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
      }
      setAvailableUpdates(current => current.filter(u => u.id !== update.id));
      setSaveState(`Updated ${update.name}`);
    } catch (error) { console.error(`Failed to update ${update.name}:`, error); }
  }

  async function handleUpdateAll() {
    const updatesToProcess = [...availableUpdates];
    for (const update of updatesToProcess) await handleUpdateScript(update);
  }

  async function handleMergeForkUpdate(update: ScriptUpdate) {
    const script = scripts.find((item) => item.id === update.id);
    if (!script) return;
    const mergedCode = [
      '<<<<<<< LOCAL CUSTOMIZATION',
      script.code,
      '=======',
      update.code,
      '>>>>>>> REGISTRY UPDATE',
    ].join('\n');
    const nextScripts = scripts.map((item) => item.id === update.id ? {
      ...item,
      code: mergedCode,
      version: update.latestVersion,
      upstreamCodeAtFork: update.code,
      updatedAt: new Date().toISOString().slice(0, 10),
    } : item);
    setScripts(nextScripts);
    navigateToScript(update.id);
    await saveLocalScripts(nextScripts);
    setAvailableUpdates(current => current.filter(u => u.id !== update.id));
    setSaveState(`Created merge conflict markers for ${update.name}`);
  }

  async function handleUnlinkUpdate(update: ScriptUpdate) {
    await unlinkForkedScript(update.id);
    setAvailableUpdates(current => current.filter(u => u.id !== update.id));
  }

  return {
    settings, setSettings,
    scripts, setScripts,
    installedRegistryCommands, setInstalledRegistryCommands,
    selectedId, setSelectedId,
    selectedRegistryCommandId, setSelectedRegistryCommandId,
    selectedScript,
    selectedRegistryCommand,
    editorFontFamily, setEditorFontFamily,
    editorFontSize, setEditorFontSize,
    editorTheme, setEditorTheme,
    editorKeymap, setEditorKeymap,
    editorWordWrap, setEditorWordWrap,
    updateEditorSettings,
    loadState, saveState, hasUnsavedChanges,
    testOutput, setTestOutput,
    mockUrl, setMockUrl,
    mockTitle, setMockTitle,
    mockSelection, setMockSelection,
    mockHtml, setMockHtml,
    leftWidth, setLeftWidth,
    rightWidth, setRightWidth,
    leftSidebarOpen, setLeftSidebarOpen,
    rightPanelOpen, setRightPanelOpen,
    isDraggingLeft, setIsDraggingLeft,
    isDraggingRight, setIsDraggingRight,
    startLeftDrag, startRightDrag,
    activeTab, setActiveTab,
    gitRegistries, setGitRegistries,
    selectedGitView, setSelectedGitView,
    newRepoUrl, setNewRepoUrl,
    addError, setAddError,
    isCheckingUpdates, setIsCheckingUpdates,
    availableUpdates, setAvailableUpdates,
    updateStatusText, setUpdateStatusText,
    hasUserScriptsPermission,
    persistScripts,
    navigateToScript,
    navigateToRegistryCommand,
    navigateToGitView,
    updateSelectedScript,
    saveSelectedScript,
    formatSelectedScript,
    createDraft,
    deleteSelectedScript,
    exportScripts,
    setScriptStatusDirectly,
    setRegistryCommandStatusDirectly,
    setRegistryCommandPackStatusDirectly,
    uninstallOfficialRegistryCommand,
    uninstallOfficialRegistryCommandPack,
    forkOfficialRegistryCommand,
    unlinkForkedScript,
    resetForkedScriptToUpstream,
    exportSingleScript,
    importScripts,
    handleAddRegistry,
    handleRemoveRegistry,
    installGitCommand,
    checkUpdates,
    handleUpdateScript,
    handleMergeForkUpdate,
    handleUnlinkUpdate,
    handleUpdateAll,
    activeTheme,
    editorPrefModalOpen, setEditorPrefModalOpen,
    testHarnessOpen, setTestHarnessOpen,
    confirmModal, setConfirmModal,
    createLocalScriptDraft,
  };
}
