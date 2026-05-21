import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import type { BurstCommand, CommandIcon } from '@/src/lib/commands';
import { getRegistryCommand } from '@/src/lib/registryApi';
import { loadInstalledRegistryCommands, saveInstalledRegistryCommands } from '@/src/lib/registryStorage';
import {
  createLocalScriptBackup,
  createLocalScriptDraft,
  detectRequiredCapabilities,
  loadLocalScripts,
  LocalScript,
  parseLocalScriptBackup,
  prepareLocalScriptForSave,
  saveLocalScripts,
  stripDefaultExport,
} from '@/src/lib/localScripts';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { ExtensionSettings, DEFAULT_SETTINGS, loadSettings } from '@/src/lib/settings';
import logoUrl from '@/assets/logo.svg';
import './style.css';

const GIT_REGISTRIES_STORAGE_KEY = 'burst.gitRegistries.v1';

export type GitRegistry = {
  id: string;
  url: string;
  name: string;
  owner: string;
  repo: string;
  branch: string;
  commands: BurstCommand[];
};

export type ScriptUpdate = {
  type: 'official' | 'git';
  id: string; // localScript.id (for git) or commandId (for official)
  name: string;
  currentVersion: string;
  latestVersion: string;
  code: string;
  manifestCommand?: BurstCommand;
};

function parseGitUrl(input: string): { owner: string; repo: string; branch: string } | null {
  try {
    let clean = input.trim();
    if (clean.startsWith('http://')) clean = clean.substring(7);
    if (clean.startsWith('https://')) clean = clean.substring(8);
    if (clean.endsWith('.git')) clean = clean.slice(0, -4);
    if (clean.endsWith('/')) clean = clean.slice(0, -1);

    const parts = clean.split('/');
    let owner = '';
    let repo = '';
    let branch = 'main';

    if (parts[0].includes('.')) {
      if (parts.length < 3) return null;
      owner = parts[1];
      repo = parts[2];
      if (parts[3] === 'tree' && parts[4]) {
        branch = parts.slice(4).join('/');
      }
    } else {
      if (parts.length < 2) return null;
      owner = parts[0];
      repo = parts[1];
      if (parts[2] === 'tree' && parts[3]) {
        branch = parts.slice(3).join('/');
      }
    }

    if (!owner || !repo) return null;
    return { owner, repo, branch };
  } catch {
    return null;
  }
}

async function loadGitRegistries(): Promise<GitRegistry[]> {
  const extensionStorage = typeof browser !== 'undefined' && browser.storage?.local;
  if (extensionStorage) {
    const result = await extensionStorage.get(GIT_REGISTRIES_STORAGE_KEY);
    return (result[GIT_REGISTRIES_STORAGE_KEY] as GitRegistry[]) || [];
  }
  const raw = localStorage.getItem(GIT_REGISTRIES_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GitRegistry[];
  } catch {
    return [];
  }
}

async function saveGitRegistries(registries: GitRegistry[]): Promise<void> {
  const extensionStorage = typeof browser !== 'undefined' && browser.storage?.local;
  if (extensionStorage) {
    await extensionStorage.set({ [GIT_REGISTRIES_STORAGE_KEY]: registries });
    return;
  }
  localStorage.setItem(GIT_REGISTRIES_STORAGE_KEY, JSON.stringify(registries));
}

const iconOptions: Array<{ icon: CommandIcon; label: string; hint: string }> = [
  { icon: { type: 'favicon', host: 'github.com' }, label: 'GitHub', hint: 'github.com favicon' },
  { icon: { type: 'initials', value: 'CS' }, label: 'Capture', hint: 'CS initials' },
  { icon: { type: 'initials', value: 'UL' }, label: 'Default', hint: 'UL initials' },
  { icon: { type: 'initials', value: 'JS' }, label: 'Script', hint: 'JS initials' },
  { icon: { type: 'initials', value: 'AI' }, label: 'AI', hint: 'AI initials' },
  { icon: { type: 'emoji', value: '+' }, label: 'Create', hint: 'Plus glyph' },
];

const fontFamilyOptions = [
  {
    value: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    label: 'Monospace',
  },
  {
    value: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
    label: 'JetBrains',
  },
  {
    value: '"Fira Code", "SFMono-Regular", Consolas, monospace',
    label: 'Fira Code',
  },
  {
    value: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
    label: 'System Mono',
  },
];

const fontSizeOptions = [12, 13, 14, 15, 16, 18];

function createEditorTheme(fontFamily: string, fontSize: number, isDark: boolean) {
  if (isDark) {
    return EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: '#111827',
        color: '#dbeafe',
        fontSize: `${fontSize}px`,
      },
      '.cm-scroller': {
        fontFamily,
        lineHeight: '1.55',
      },
      '.cm-content': {
        padding: '14px 0',
      },
      '.cm-line': {
        color: '#dbeafe',
        textTransform: 'none',
        padding: '0 14px',
      },
      '.cm-gutters': {
        backgroundColor: '#111827',
        borderRight: '1px solid rgba(148, 163, 184, 0.14)',
        color: '#64748b',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(30, 41, 59, 0.55)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(30, 41, 59, 0.55)',
      },
      '.cm-cursor': {
        borderLeftColor: '#7dd3fc',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.tok-keyword': { color: '#7dd3fc' },
      '.tok-variableName': { color: '#dbeafe' },
      '.tok-propertyName': { color: '#bfdbfe' },
      '.tok-string': { color: '#86efac' },
      '.tok-comment': { color: '#64748b' },
      '.tok-punctuation': { color: '#94a3b8' },
    });
  } else {
    return EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: '#ffffff',
        color: '#1e293b',
        fontSize: `${fontSize}px`,
      },
      '.cm-scroller': {
        fontFamily,
        lineHeight: '1.55',
      },
      '.cm-content': {
        padding: '14px 0',
      },
      '.cm-line': {
        color: '#1e293b',
        textTransform: 'none',
        padding: '0 14px',
      },
      '.cm-gutters': {
        backgroundColor: '#f8fafc',
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        color: '#64748b',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
      },
      '.cm-cursor': {
        borderLeftColor: '#0ea5e9',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.tok-keyword': { color: '#0284c7' },
      '.tok-variableName': { color: '#1e293b' },
      '.tok-propertyName': { color: '#0f172a' },
      '.tok-string': { color: '#15803d' },
      '.tok-comment': { color: '#94a3b8' },
      '.tok-punctuation': { color: '#475569' },
    });
  }
}

function DashboardApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [scripts, setScripts] = useState<LocalScript[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [editorFontFamily, setEditorFontFamily] = useState(fontFamilyOptions[0].value);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveState, setSaveState] = useState('Loading scripts');
  const [testOutput, setTestOutput] = useState('Ready. Test runs will execute against the current editor source.');
  const [mockUrl, setMockUrl] = useState('https://github.com/burst/examples');
  const [mockTitle, setMockTitle] = useState('burst/examples: GitHub');
  const [mockSelection, setMockSelection] = useState('v0.1.0-draft');
  const [mockHtml, setMockHtml] = useState('\n<div data-icv-name="Switch branches/tags">v0.1.0-draft</div>\n');
  const importInputRef = useRef<HTMLInputElement>(null);

  // Git Registries & Updates state
  const [activeTab, setActiveTab] = useState<'editor' | 'git-updates'>('editor');
  const [gitRegistries, setGitRegistries] = useState<GitRegistry[]>([]);
  const [selectedGitView, setSelectedGitView] = useState<'updates' | string>('updates');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [availableUpdates, setAvailableUpdates] = useState<ScriptUpdate[]>([]);
  const [updateStatusText, setUpdateStatusText] = useState('Not checked yet.');
  const [hasUserScriptsPermission, setHasUserScriptsPermission] = useState(true);

  useEffect(() => {
    function checkPermission() {
      const hasWxt = typeof browser !== 'undefined' && !!browser.userScripts;
      const hasChrome = typeof chrome !== 'undefined' && !!chrome.userScripts;
      setHasUserScriptsPermission(hasWxt || hasChrome);
    }
    checkPermission();
    window.addEventListener('focus', checkPermission);
    return () => {
      window.removeEventListener('focus', checkPermission);
    };
  }, []);

  const selectedScript = scripts.find((script) => script.id === selectedId) ?? scripts[0];
  const detectedCapabilities = useMemo(() => {
    return selectedScript ? detectRequiredCapabilities(selectedScript.code) : [];
  }, [selectedScript?.code]);
  const staticAuditReport = useMemo(() => {
    if (!selectedScript) return null;
    const patterns = selectedScript.matchPattern
      ? selectedScript.matchPattern.split(',').map((p) => p.trim())
      : [];
    return analyzeScriptCode(selectedScript.code, patterns);
  }, [selectedScript?.code, selectedScript?.matchPattern]);

  const activeTheme = useMemo(() => {
    return settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : settings.theme;
  }, [settings.theme]);

  const editorTheme = useMemo(
    () => createEditorTheme(editorFontFamily, editorFontSize, activeTheme === 'dark'),
    [editorFontFamily, editorFontSize, activeTheme],
  );

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

  useEffect(() => {
    document.documentElement.className = `theme-${activeTheme}`;

    if (settings.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => {
        const nextTheme = media.matches ? 'light' : 'dark';
        document.documentElement.className = `theme-${nextTheme}`;
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [activeTheme, settings.theme]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateScripts() {
      try {
        const storedScripts = await loadLocalScripts();
        const storedRegistries = await loadGitRegistries();
        const params = new URLSearchParams(window.location.search);
        const nextScripts = params.get('mode') === 'new'
          ? [createLocalScriptDraft(), ...storedScripts]
          : storedScripts;

        if (params.get('mode') === 'new') {
          await saveLocalScripts(nextScripts);
        }

        if (cancelled) return;
        setScripts(nextScripts);
        setSelectedId(nextScripts[0]?.id);
        setGitRegistries(storedRegistries);
        setLoadState('ready');
        setSaveState(params.get('mode') === 'new' ? 'Draft saved' : 'Loaded from local storage');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setSaveState(error instanceof Error ? error.message : 'Failed to load scripts');
      }
    }

    void hydrateScripts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddRegistry(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    const parsed = parseGitUrl(newRepoUrl);
    if (!parsed) {
      setAddError('Invalid URL. Format: github.com/owner/repo or owner/repo');
      return;
    }

    const id = `git-${parsed.owner}-${parsed.repo}`;
    if (gitRegistries.some(r => r.id === id)) {
      setAddError('This registry is already added.');
      return;
    }

    setAddError('Fetching manifest...');
    try {
      const manifestUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.commands.json`;
      const fallbackUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.command.json`;

      let res = await fetch(manifestUrl);
      if (!res.ok) {
        res = await fetch(fallbackUrl);
      }
      if (!res.ok) {
        throw new Error(`Could not find burst.commands.json or burst.command.json in ${parsed.owner}/${parsed.repo}`);
      }
      const json = await res.json();
      const manifestCommands = Array.isArray(json) ? json : (json.commands || []);

      const newRegistry: GitRegistry = {
        id,
        url: `https://github.com/${parsed.owner}/${parsed.repo}`,
        name: `${parsed.owner}/${parsed.repo}`,
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        commands: manifestCommands,
      };

      const nextRegistries = [...gitRegistries, newRegistry];
      setGitRegistries(nextRegistries);
      await saveGitRegistries(nextRegistries);
      setNewRepoUrl('');
      setAddError('');
      setSelectedGitView(id);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Failed to fetch manifest');
    }
  }

  async function handleRemoveRegistry(id: string) {
    if (!window.confirm('Are you sure you want to remove this registry? (Installed scripts from it will remain installed)')) {
      return;
    }
    const nextRegistries = gitRegistries.filter(r => r.id !== id);
    setGitRegistries(nextRegistries);
    await saveGitRegistries(nextRegistries);
    setSelectedGitView('updates');
  }

  async function installGitCommand(command: BurstCommand, registry: GitRegistry) {
    const alreadyInstalled = scripts.find(s => s.originRegistryUrl === registry.url && s.originCommandId === command.id);
    
    if (alreadyInstalled) {
      if (!window.confirm(`"${command.title}" is already installed. Do you want to overwrite it with version ${command.version}?`)) {
        return;
      }
      const nextScripts = scripts.map(s => {
        if (s.id === alreadyInstalled.id) {
          return {
            ...s,
            name: command.title,
            matchPattern: command.matchPatterns[0] || '<all_urls>',
            icon: command.icon || { type: 'initials', value: command.title.substring(0, 2).toUpperCase() },
            code: command.code || '',
            version: command.version || '1.0.0',
            updatedAt: new Date().toISOString().slice(0, 10),
          };
        }
        return s;
      });
      setScripts(nextScripts);
      await persistScripts(nextScripts, `Updated local script "${command.title}"`);
      return;
    }

    const newScript: LocalScript = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: command.title,
      matchPattern: command.matchPatterns[0] || '<all_urls>',
      icon: command.icon || { type: 'initials', value: command.title.substring(0, 2).toUpperCase() },
      status: 'enabled',
      updatedAt: new Date().toISOString().slice(0, 10),
      code: command.code || '',
      originRegistryUrl: registry.url,
      originCommandId: command.id,
      version: command.version || '1.0.0',
    };

    const nextScripts = [newScript, ...scripts];
    setScripts(nextScripts);
    await persistScripts(nextScripts, `Installed local script "${command.title}"`);
  }

  async function checkUpdates() {
    setIsCheckingUpdates(true);
    setUpdateStatusText('Checking for updates...');
    const officialUpdates: ScriptUpdate[] = [];
    const gitUpdates: ScriptUpdate[] = [];

    try {
      // 1. Scan official installed registry commands
      const installedRegistryCmds = await loadInstalledRegistryCommands();
      for (const cmd of installedRegistryCmds) {
        try {
          const officialCmd = await getRegistryCommand(cmd.id);
          if (officialCmd && officialCmd.version && cmd.version && officialCmd.version !== cmd.version) {
            officialUpdates.push({
              type: 'official',
              id: cmd.id,
              name: cmd.title,
              currentVersion: cmd.version,
              latestVersion: officialCmd.version,
              code: officialCmd.code || '',
              manifestCommand: officialCmd,
            });
          }
        } catch (e) {
          console.error(`Failed to check update for official command ${cmd.id}:`, e);
        }
      }

      // 2. Scan git-based local scripts
      const gitScripts = scripts.filter(s => s.originRegistryUrl && s.originCommandId);
      const uniqueUrls = Array.from(new Set(gitScripts.map(s => s.originRegistryUrl!)));

      for (const url of uniqueUrls) {
        try {
          const parsed = parseGitUrl(url);
          if (!parsed) continue;

          let manifestData: any[] = [];
          const manifestUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.commands.json`;
          const fallbackUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/burst.command.json`;
          
          let res = await fetch(manifestUrl);
          if (!res.ok) {
            res = await fetch(fallbackUrl);
          }
          if (res.ok) {
            const json = await res.json();
            manifestData = Array.isArray(json) ? json : (json.commands || []);
          }

          const scriptsForUrl = gitScripts.filter(s => s.originRegistryUrl === url);
          for (const script of scriptsForUrl) {
            const remoteCmd = manifestData.find(c => c.id === script.originCommandId);
            if (remoteCmd && remoteCmd.version && script.version && remoteCmd.version !== script.version) {
              gitUpdates.push({
                type: 'git',
                id: script.id,
                name: script.name,
                currentVersion: script.version,
                latestVersion: remoteCmd.version,
                code: remoteCmd.code || '',
              });
            }
          }
        } catch (e) {
          console.error(`Failed to check updates for Git registry ${url}:`, e);
        }
      }

      const allUpdates = [...officialUpdates, ...gitUpdates];
      setAvailableUpdates(allUpdates);
      setUpdateStatusText(
        allUpdates.length > 0
          ? `Found ${allUpdates.length} update(s).`
          : 'All scripts are up to date.'
      );
    } catch (err) {
      setUpdateStatusText('Error checking for updates.');
      console.error(err);
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  async function handleUpdateScript(update: ScriptUpdate) {
    try {
      if (update.type === 'official') {
        const installed = await loadInstalledRegistryCommands();
        const updated = installed.map(cmd => {
          if (cmd.id === update.id && update.manifestCommand) {
            return update.manifestCommand;
          }
          return cmd;
        });
        await saveInstalledRegistryCommands(updated);
      } else {
        const nextScripts = scripts.map(s => {
          if (s.id === update.id) {
            return {
              ...s,
              code: update.code,
              version: update.latestVersion,
              updatedAt: new Date().toISOString().slice(0, 10),
            };
          }
          return s;
        });
        setScripts(nextScripts);
        await saveLocalScripts(nextScripts);
      }

      // Notify background to re-sync scripts
      if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
        await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {});
      }

      // Remove from the updates list
      setAvailableUpdates(current => current.filter(u => u.id !== update.id));
      setSaveState(`Updated ${update.name}`);
    } catch (error) {
      console.error(`Failed to update ${update.name}:`, error);
    }
  }

  async function handleUpdateAll() {
    const updatesToProcess = [...availableUpdates];
    for (const update of updatesToProcess) {
      await handleUpdateScript(update);
    }
  }

  async function createDraft() {
    const draft = createLocalScriptDraft();
    const nextScripts = [draft, ...scripts];

    setScripts(nextScripts);
    setSelectedId(draft.id);
    await persistScripts(nextScripts, 'Draft saved');
  }

  function updateSelectedScript(patch: Partial<LocalScript>) {
    if (!selectedScript) return;

    setScripts((current) =>
      current.map((script) => script.id === selectedScript.id ? { ...script, ...patch } : script),
    );
    setSaveState('Unsaved changes');
  }

  async function saveSelectedScript() {
    if (!selectedScript) return;

    const nextScripts = scripts.map((script) =>
      script.id === selectedScript.id ? prepareLocalScriptForSave(script) : script,
    );

    setScripts(nextScripts);
    await persistScripts(nextScripts, 'Saved to local storage');
  }

  async function setSelectedScriptStatus(status: LocalScript['status']) {
    if (!selectedScript) return;

    const nextScripts = scripts.map((script) =>
      script.id === selectedScript.id ? prepareLocalScriptForSave({ ...script, status }) : script,
    );

    setScripts(nextScripts);
    await persistScripts(nextScripts, status === 'enabled' ? 'Enabled and synced' : 'Status saved');
  }

  async function deleteSelectedScript() {
    if (!selectedScript || !window.confirm(`Delete "${selectedScript.name}"?`)) return;

    const selectedIndex = scripts.findIndex((script) => script.id === selectedScript.id);
    const nextScripts = scripts.filter((script) => script.id !== selectedScript.id);
    const fallbackDraft = nextScripts.length > 0 ? undefined : createLocalScriptDraft();
    const finalScripts = fallbackDraft ? [fallbackDraft] : nextScripts;
    const nextSelection = finalScripts[Math.max(0, selectedIndex - 1)] ?? finalScripts[0];

    setScripts(finalScripts);
    setSelectedId(nextSelection.id);
    await persistScripts(finalScripts, fallbackDraft ? 'Deleted script and created a draft' : 'Deleted script');
  }

  function exportScripts() {
    const backup = createLocalScriptBackup(scripts);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `burst-local-scripts-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setSaveState(`Exported ${backup.scripts.length} scripts`);
  }

  async function importScripts(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const importedScripts = parseLocalScriptBackup(parsed);
      if (importedScripts.length === 0) {
        setSaveState('Import failed: no valid scripts found');
        return;
      }

      if (!window.confirm(`Import ${importedScripts.length} scripts and replace the current local scripts?`)) {
        setSaveState('Import cancelled');
        return;
      }

      setScripts(importedScripts);
      setSelectedId(importedScripts[0].id);
      await persistScripts(importedScripts, `Imported ${importedScripts.length} scripts`);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Import failed');
    }
  }

  async function testSelectedScript() {
    if (!selectedScript) return;

    setTestOutput('Running...');

    try {
      compileLocalScript(selectedScript.code);
    } catch (error) {
      setTestOutput(`Syntax Check Failed:\n${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[LOG] ${msg}`);
      setTestOutput(logs.join('\n'));
    };
    const logError = (msg: string) => {
      logs.push(`[ERROR] ${msg}`);
      setTestOutput(logs.join('\n'));
    };

    try {
      const parser = new DOMParser();
      const mockDoc = parser.parseFromString(mockHtml, 'text/html');

      const mockPage = {
        querySelector: (selector: string) => {
          log(`page.querySelector('${selector}')`);
          const result = mockDoc.querySelector(selector);
          log(`  => ${result ? `<${result.tagName.toLowerCase()}> with text "${result.textContent?.trim()}"` : 'null'}`);
          return result;
        },
        querySelectorAll: (selector: string) => {
          log(`page.querySelectorAll('${selector}')`);
          const results = mockDoc.querySelectorAll(selector);
          log(`  => Found ${results.length} element(s)`);
          return results;
        },
      };

      let clipboardContent = '';
      const mockNavigator = {
        ...navigator,
        clipboard: {
          writeText: async (text: string) => {
            clipboardContent = text;
            log(`navigator.clipboard.writeText("${text}")`);
          },
        },
      };

      const mockConsole = {
        log: (...args: any[]) => {
          const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          log(`console.log: ${str}`);
        },
        error: (...args: any[]) => {
          const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          logError(`console.error: ${str}`);
        },
        warn: (...args: any[]) => {
          const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          log(`console.warn: ${str}`);
        },
      };

      const mockWindow = {
        ...window,
        console: mockConsole,
        getSelection: () => ({
          toString: () => mockSelection,
        }),
      };

      const mockToast = (message: any) => {
        log(`toast("${message}")`);
      };

      const context = {
        page: mockPage,
        window: mockWindow,
        location: new URL(mockUrl),
        navigator: mockNavigator,
        selection: mockSelection,
        url: mockUrl,
        title: mockTitle,
        toast: mockToast,
      };

      const functionSource = stripDefaultExport(selectedScript.code);
      const runnerSource = `
        return async function(context) {
          const { page, window, location, navigator, selection, url, title, toast } = context;
          const document = page;
          const console = window.console;

          const run = ${functionSource};
          return await run(context);
        }
      `;
      const runner = new Function(runnerSource)();

      log('Starting execution...');
      await runner(context);
      log('Execution completed successfully.');

      if (clipboardContent) {
        logs.push(`\n[Clipboard Output] "${clipboardContent}"`);
        setTestOutput(logs.join('\n'));
      }
    } catch (error) {
      logError(`Runtime Exception: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }

  async function persistScripts(nextScripts: LocalScript[], successMessage: string) {
    try {
      await saveLocalScripts(nextScripts);
      if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
        void browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => {
          // Static dashboard previews do not have an extension runtime.
        });
      }
      setSaveState(successMessage);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : 'Failed to save scripts');
    }
  }

  if (loadState === 'loading') {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <section className="text-sm font-semibold tracking-wider text-muted-foreground uppercase animate-pulse">
          Loading local scripts...
        </section>
      </main>
    );
  }

  if (loadState === 'error' || !selectedScript) {
    return (
      <main className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <section className="text-sm font-semibold text-destructive uppercase">
          {saveState}
        </section>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-[280px] shrink-0 bg-card border-r border-border flex flex-col p-4 gap-4 overflow-hidden" aria-label="Local scripts">
        <header className="flex items-center gap-3 pb-2 border-b border-border">
          <img src={logoUrl} className="w-6 h-6 shrink-0" alt="Burst Logo" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground tracking-tight leading-none">Burst</h1>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">Local scripts companion</p>
          </div>
        </header>

        {/* Tab switch segmented control */}
        <div className="flex rounded-lg bg-muted p-1 gap-1 border border-border shrink-0">
          <button
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-center ${
              activeTab === 'editor'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            type="button"
            onClick={() => setActiveTab('editor')}
          >
            Local Editor
          </button>
          <button
            className={`flex-1 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-center ${
              activeTab === 'git-updates'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            type="button"
            onClick={() => setActiveTab('git-updates')}
          >
            Git & Updates
          </button>
        </div>

        {activeTab === 'editor' ? (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            <button
              className="w-full inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
              type="button"
              onClick={createDraft}
            >
              New script
            </button>

            <div className="flex gap-2 shrink-0" aria-label="Script backup actions">
              <button
                type="button"
                onClick={exportScripts}
                className="flex-1 inline-flex items-center justify-center rounded-md text-xs font-semibold h-7 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center rounded-md text-xs font-semibold h-7 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                Import
              </button>
              <input
                ref={importInputRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={(event) => void importScripts(event)}
              />
            </div>

            {/* Script list scrollable content */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
              {scripts.map((script) => (
                <button
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                    script.id === selectedId
                      ? 'bg-accent border-border'
                      : ''
                  }`}
                  key={script.id}
                  type="button"
                  onClick={() => setSelectedId(script.id)}
                >
                  <LocalScriptIcon icon={script.icon} />
                  <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <strong className="text-xs font-semibold text-foreground truncate block">{script.name}</strong>
                    <em className="text-[10px] text-muted-foreground truncate block not-italic font-medium">
                      {script.matchPattern} · {script.status}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            <button
              className={`w-full flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                selectedGitView === 'updates' ? 'bg-accent border-border' : ''
              }`}
              type="button"
              onClick={() => setSelectedGitView('updates')}
            >
              <span className="text-xs font-semibold text-foreground">Updates Checker</span>
              {availableUpdates.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                  {availableUpdates.length}
                </span>
              )}
            </button>

            <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase pt-2 shrink-0">
              Git Registries
            </div>

            <form
              className="flex flex-col gap-2 p-2.5 rounded-lg border border-border bg-muted/40 shrink-0"
              onSubmit={(e) => void handleAddRegistry(e)}
            >
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Add GitHub Repository
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="owner/repo"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  className="flex-1 flex h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors px-2.5"
                >
                  Add
                </button>
              </div>
              {addError && <span className="text-[10px] text-destructive font-medium mt-0.5">{addError}</span>}
            </form>

            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
              {gitRegistries.map((reg) => (
                <button
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                    reg.id === selectedGitView ? 'bg-accent border-border' : ''
                  }`}
                  key={reg.id}
                  type="button"
                  onClick={() => setSelectedGitView(reg.id)}
                >
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-bold shrink-0">
                    G
                  </span>
                  <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <strong className="text-xs font-semibold text-foreground truncate block">{reg.name}</strong>
                    <em className="text-[10px] text-muted-foreground truncate block not-italic font-medium">
                      {reg.branch} · {reg.commands.length} commands
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {!hasUserScriptsPermission && (
          <div className="bg-amber-500/10 border-b border-amber-500/25 px-6 py-4 flex gap-4 shrink-0 items-start select-none">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-500 tracking-tight">
                Action Required: Enable User Scripts Permission (Manifest V3)
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                To run local scripts and execute automations on your web pages, your browser requires the User Scripts permission to be active.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-amber-500/10">
                <div>
                  <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Option A: Chrome 138+ (Recommended)</h4>
                  <ol className="list-decimal pl-4 mt-1.5 space-y-1 text-xs text-muted-foreground">
                    <li>Click the button on the right to open <strong>Burst details</strong>.</li>
                    <li>Scroll down and switch <strong>"Allow user scripts"</strong> to <strong>ON</strong>.</li>
                  </ol>
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Option B: Older Chrome / Chromium</h4>
                  <ol className="list-decimal pl-4 mt-1.5 space-y-1 text-xs text-muted-foreground">
                    <li>Go to <code className="text-[11px] bg-secondary border border-border px-1 py-0.5 rounded">chrome://extensions</code>.</li>
                    <li>Toggle <strong>Developer mode</strong> in the top-right corner to <strong>ON</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-2 self-center">
              <button
                onClick={() => {
                  if (typeof browser !== 'undefined' && browser.tabs?.create) {
                    void browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
                  }
                }}
                type="button"
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-amber-500 text-black shadow hover:bg-amber-400 cursor-pointer transition-colors"
              >
                Open Extension Details
              </button>
              <div className="text-[10px] text-center text-muted-foreground font-medium italic">
                Will auto-detect on return
              </div>
            </div>
          </div>
        )}

        {activeTab === 'editor' ? (
          <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Script editor">
          {/* Header Toolbar */}
          <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full bg-secondary border border-border font-bold">
                {selectedScript.status}
              </span>
              <h2 className="text-base font-semibold tracking-tight text-foreground truncate max-w-[300px]">
                {selectedScript.name}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {saveState && (
                <span className="text-xs text-muted-foreground animate-fade-in truncate max-w-[200px] font-medium">
                  {saveState}
                </span>
              )}
              <button
                type="button"
                onClick={testSelectedScript}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                Test
              </button>
              <button
                type="button"
                onClick={saveSelectedScript}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
              >
                Save
              </button>
            </div>
          </header>

          {/* IDE Layout Workspace (Split Columns) */}
          <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-border">
            {/* Left Workspace Panel (60%): metadata inputs and source editor */}
            <div className="flex-[3] flex flex-col min-w-0 h-full overflow-hidden bg-background">
              {/* Metadata Inputs */}
              <div className="grid grid-cols-3 gap-4 p-4 border-b border-border bg-card/20 shrink-0">
                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Name
                  <input
                    value={selectedScript.name}
                    onChange={(event) => updateSelectedScript({ name: event.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Match Pattern
                  <input
                    value={selectedScript.matchPattern}
                    onChange={(event) => updateSelectedScript({ matchPattern: event.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
                <IconSelect
                  value={selectedScript.icon}
                  onChange={(icon) => updateSelectedScript({ icon })}
                />
              </div>

              {/* Source editor workspace */}
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Source Code</span>

                  {/* Status pill group */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-muted">
                      {(['enabled', 'disabled', 'draft'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => void setSelectedScriptStatus(status)}
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                            selectedScript.status === status
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Code Editor Container */}
                <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card/20 shadow-inner code-editor">
                  <CodeMirror
                    value={selectedScript.code}
                    basicSetup={{
                      bracketMatching: true,
                      closeBrackets: true,
                      defaultKeymap: true,
                      foldGutter: false,
                      highlightActiveLine: true,
                      highlightActiveLineGutter: true,
                      lineNumbers: true,
                    }}
                    extensions={[javascript({ jsx: true, typescript: true }), editorTheme]}
                    height="100%"
                    theme={activeTheme}
                    onChange={(code) => updateSelectedScript({ code })}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel Workspace (40%): Settings, Security Audit, and Test Harness */}
            <div className="flex-[2] flex flex-col min-w-0 h-full overflow-y-auto divide-y divide-border bg-card/5">
              {/* Settings Dropdowns */}
              <section className="p-4 flex flex-col gap-3" aria-label="Editor settings">
                <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Editor Options</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Font Family
                    <select
                      value={editorFontFamily}
                      onChange={(event) => setEditorFontFamily(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {fontFamilyOptions.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Font Size
                    <select
                      value={editorFontSize}
                      onChange={(event) => setEditorFontSize(Number(event.target.value))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {fontSizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}px
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              {/* Static Security Audit */}
              {staticAuditReport && (
                <section className="p-4 flex flex-col gap-3" aria-label="Static security audit report">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Static Security Audit</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      staticAuditReport.status === 'pass'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : staticAuditReport.status === 'warning'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {staticAuditReport.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{staticAuditReport.summary}</p>
                  
                  {/* Audit details grid list */}
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex gap-3 text-xs bg-muted/30 p-2.5 rounded-md border border-border">
                      <span className={`font-bold shrink-0 ${
                        staticAuditReport.checks.hostScope.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {staticAuditReport.checks.hostScope.status === 'pass' ? '✓' : '⚠'}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-foreground font-semibold">Host Scope & Match Patterns</strong>
                        <span className="text-muted-foreground text-[11px] font-medium leading-relaxed">
                          {staticAuditReport.checks.hostScope.detail}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs bg-muted/30 p-2.5 rounded-md border border-border">
                      <span className={`font-bold shrink-0 ${
                        staticAuditReport.checks.permissions.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {staticAuditReport.checks.permissions.status === 'pass' ? '✓' : '⚠'}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-foreground font-semibold">Sensitive APIs & Permissions</strong>
                        <span className="text-muted-foreground text-[11px] font-medium leading-relaxed">
                          {staticAuditReport.checks.permissions.detail}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs bg-muted/30 p-2.5 rounded-md border border-border">
                      <span className={`font-bold shrink-0 ${
                        staticAuditReport.checks.remoteCode.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {staticAuditReport.checks.remoteCode.status === 'pass' ? '✓' : '⚠'}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-foreground font-semibold">Remote Code & Injection</strong>
                        <span className="text-muted-foreground text-[11px] font-medium leading-relaxed">
                          {staticAuditReport.checks.remoteCode.detail}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs bg-muted/30 p-2.5 rounded-md border border-border">
                      <span className={`font-bold shrink-0 ${
                        staticAuditReport.checks.networkAccess.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {staticAuditReport.checks.networkAccess.status === 'pass' ? '✓' : '⚠'}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-foreground font-semibold">Network Access</strong>
                        <span className="text-muted-foreground text-[11px] font-medium leading-relaxed">
                          {staticAuditReport.checks.networkAccess.detail}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 text-xs bg-muted/30 p-2.5 rounded-md border border-border">
                      <span className={`font-bold shrink-0 ${
                        staticAuditReport.checks.obfuscation.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {staticAuditReport.checks.obfuscation.status === 'pass' ? '✓' : '⚠'}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-foreground font-semibold">Code Quality & Obfuscation Heuristics</strong>
                        <span className="text-muted-foreground text-[11px] font-medium leading-relaxed">
                          {staticAuditReport.checks.obfuscation.detail}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Test Harness Panel */}
              <section className="p-4 flex flex-col gap-3" aria-label="Test harness">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Test Harness</h3>
                  <button
                    type="button"
                    onClick={testSelectedScript}
                    className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
                  >
                    Run Test
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-muted-foreground">
                  <span className="text-[10px] tracking-wider uppercase">Capabilities:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {detectedCapabilities.length === 0 ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">none</span>
                    ) : (
                      detectedCapabilities.map((cap) => (
                        <span key={cap} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20">
                          {cap}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Mock input page properties */}
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Mock URL
                    <input
                      type="text"
                      value={mockUrl}
                      onChange={(e) => setMockUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Mock Title
                    <input
                      type="text"
                      value={mockTitle}
                      onChange={(e) => setMockTitle(e.target.value)}
                      placeholder="Page Title"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Mock Selection
                    <input
                      type="text"
                      value={mockSelection}
                      onChange={(e) => setMockSelection(e.target.value)}
                      placeholder="Selected text"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Mock DOM HTML
                    <textarea
                      value={mockHtml}
                      onChange={(e) => setMockHtml(e.target.value)}
                      placeholder="<div>Mock page content</div>"
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none font-mono"
                    />
                  </label>
                </div>

                {/* Console Outputs */}
                <div className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">
                  Console & Execution Logs
                  <pre className="terminal-logs p-3 rounded-md bg-zinc-950 text-zinc-200 border border-zinc-800 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[160px] overflow-y-auto whitespace-pre-wrap select-text shadow-inner">
                    {testOutput || 'No execution logs.'}
                  </pre>
                </div>
              </section>

              {/* Danger Section */}
              <section className="p-4 flex flex-col gap-3" aria-label="Script deletion">
                <h3 className="text-[10px] font-bold text-destructive tracking-wider uppercase">Danger Zone</h3>
                <div className="flex items-center justify-between p-3 border border-destructive/20 bg-destructive/5 rounded-lg">
                  <div className="flex flex-col gap-0.5">
                    <strong className="text-xs text-foreground font-semibold">Delete Local Script</strong>
                    <span className="text-[10px] text-muted-foreground">This action cannot be undone.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedScript()}
                    className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 cursor-pointer transition-colors border border-destructive/20"
                  >
                    Delete
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>
      ) : selectedGitView === 'updates' ? (
        <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Update checker">
          <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card shrink-0">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">Unified Update Checker</h2>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">{updateStatusText}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors disabled:opacity-50"
                type="button"
                disabled={isCheckingUpdates}
                onClick={() => void checkUpdates()}
              >
                {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
              </button>
              {availableUpdates.length > 0 && (
                <button
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
                  type="button"
                  onClick={() => void handleUpdateAll()}
                >
                  Update All
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {availableUpdates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3 max-w-md mx-auto">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  ✓
                </div>
                <h4 className="text-sm font-semibold text-foreground">All scripts up to date</h4>
                <p className="text-xs text-muted-foreground font-medium">
                  All installed registry commands and git-based scripts are at the latest available version.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableUpdates.map((update) => (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 shadow-sm gap-4" key={update.id}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border text-[11px] font-bold shrink-0">
                        {update.type === 'official' ? 'R' : 'G'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-foreground truncate block">{update.name}</h4>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border uppercase">
                            {update.type === 'official' ? 'Official' : 'Git'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border">
                            Installed: v{update.currentVersion}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-[9px] font-bold text-sky-500 border border-sky-500/20">
                            Latest: v{update.latestVersion}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
                      type="button"
                      onClick={() => void handleUpdateScript(update)}
                    >
                      Update
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        (() => {
          const reg = gitRegistries.find(r => r.id === selectedGitView);
          if (!reg) return null;

          return (
            <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Git registry detail">
              <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card shrink-0">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-foreground truncate">{reg.name}</h2>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1 truncate">
                    Git Repository:{' '}
                    <a
                      href={reg.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {reg.url}
                    </a>{' '}
                    (branch: {reg.branch})
                  </p>
                </div>
                <button
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-destructive text-destructive-foreground border border-destructive/20 hover:bg-destructive/90 shadow-sm cursor-pointer transition-colors"
                  type="button"
                  onClick={() => void handleRemoveRegistry(reg.id)}
                >
                  Remove Registry
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {reg.commands.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-medium">No commands found in this registry's manifest.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reg.commands.map((cmd) => {
                      const isInstalled = scripts.some(
                        (s) => s.originRegistryUrl === reg.url && s.originCommandId === cmd.id
                      );
                      const installedScript = scripts.find(
                        (s) => s.originRegistryUrl === reg.url && s.originCommandId === cmd.id
                      );

                      return (
                        <div className="flex items-start justify-between p-4 rounded-xl border border-border bg-card/40 shadow-sm gap-4" key={cmd.id}>
                          <div className="flex items-start gap-3 min-w-0">
                            <LocalScriptIcon icon={cmd.icon} />
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-foreground truncate block">{cmd.title}</h4>
                              <p className="text-[11px] text-muted-foreground font-medium mt-1 line-clamp-2 leading-relaxed">
                                {cmd.description}
                              </p>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border">
                                  v{cmd.version || '1.0.0'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border">
                                  {cmd.website}
                                </span>
                                {isInstalled && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px] font-bold text-emerald-500 border border-emerald-500/20">
                                    Installed v{installedScript?.version || '1.0.0'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            className={`inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1.5 cursor-pointer transition-colors shadow-sm shrink-0 ${
                              isInstalled
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-none hover:bg-emerald-500/20'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                            type="button"
                            onClick={() => void installGitCommand(cmd, reg)}
                          >
                            {isInstalled ? 'Reinstall' : 'Install'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })()
      )}
      </div>
    </main>
  );
}

function IconSelect({ value, onChange }: { value: CommandIcon; onChange: (value: CommandIcon) => void }) {
  const [open, setOpen] = useState(false);
  const selectedOption = iconOptions.find((option) => iconsMatch(option.icon, value)) ?? iconOptions[2];

  return (
    <div className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider relative">
      Icon
      <div className="relative">
        <button
          className="flex h-9 w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm hover:bg-accent/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <LocalScriptIcon icon={selectedOption.icon} />
          <span className="min-w-0 flex-1 flex flex-col justify-center">
            <strong className="text-xs font-semibold text-foreground truncate block">{selectedOption.label}</strong>
            <em className="text-[9px] text-muted-foreground truncate block not-italic font-normal mt-0.5">{selectedOption.hint}</em>
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 select-none">▼</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 z-20 w-full min-w-[200px] max-h-[300px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="listbox">
              {iconOptions.map((option) => {
                const isSelected = iconsMatch(option.icon, value);
                return (
                  <button
                    className={`w-full flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                      isSelected ? 'bg-accent border-border' : ''
                    }`}
                    key={getIconKey(option.icon)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.icon);
                      setOpen(false);
                    }}
                  >
                    <LocalScriptIcon icon={option.icon} />
                    <span className="min-w-0 flex-1 flex flex-col justify-center">
                      <strong className="text-xs font-semibold text-foreground truncate block">{option.label}</strong>
                      <em className="text-[9px] text-muted-foreground truncate block not-italic font-normal mt-0.5">{option.hint}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function compileLocalScript(code: string) {
  if (!/^\s*export\s+default\s+(async\s+)?function\b/.test(code)) {
    throw new Error('Local scripts must use: export default function run(context) { ... }');
  }
}

function LocalScriptIcon({ icon }: { icon: CommandIcon }) {
  const iconUrl = getLocalIconUrl(icon);

  return (
    <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-bold shrink-0 overflow-hidden">
      {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" /> : getLocalIconLabel(icon)}
    </span>
  );
}

function getLocalIconLabel(icon: CommandIcon): string {
  if (icon.type === 'initials' || icon.type === 'emoji') return icon.value;
  return 'B';
}

function getLocalIconUrl(icon: CommandIcon): string | undefined {
  if (icon.type === 'url' || icon.type === 'asset') return icon.src;
  if (icon.type === 'favicon' && icon.host) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(icon.host)}&sz=64`;
  }

  return undefined;
}

function getIconKey(icon: CommandIcon): string {
  if (icon.type === 'favicon') return `favicon:${icon.host ?? ''}`;
  if (icon.type === 'url' || icon.type === 'asset') return `${icon.type}:${icon.src}`;
  return `${icon.type}:${icon.value}`;
}

function iconsMatch(left: CommandIcon, right: CommandIcon): boolean {
  return getIconKey(left) === getIconKey(right);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
