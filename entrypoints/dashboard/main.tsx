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

function createEditorTheme(fontFamily: string, fontSize: number) {
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
}

function DashboardApp() {
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
  const editorTheme = useMemo(
    () => createEditorTheme(editorFontFamily, editorFontSize),
    [editorFontFamily, editorFontSize],
  );

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
      <main className="dashboard-shell is-loading">
        <section className="empty-dashboard">Loading local scripts</section>
      </main>
    );
  }

  if (loadState === 'error' || !selectedScript) {
    return (
      <main className="dashboard-shell is-loading">
        <section className="empty-dashboard">{saveState}</section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="script-list" aria-label="Local scripts">
        <header>
          <img className="brand-mark" src={logoUrl} alt="Burst Logo" style={{ background: 'transparent' }} />
          <div>
            <h1>Burst</h1>
            <p>Local scripts</p>
          </div>
        </header>

        <div className="dashboard-tabs">
          <button
            className={`tab-btn ${activeTab === 'editor' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('editor')}
          >
            Local Editor
          </button>
          <button
            className={`tab-btn ${activeTab === 'git-updates' ? 'is-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('git-updates')}
          >
            Git & Updates
          </button>
        </div>

        {activeTab === 'editor' ? (
          <>
            <button className="new-script-button" type="button" onClick={createDraft}>
              New script
            </button>

            <div className="script-list-actions" aria-label="Script backup actions">
              <button type="button" onClick={exportScripts}>
                Export
              </button>
              <button type="button" onClick={() => importInputRef.current?.click()}>
                Import
              </button>
              <input
                ref={importInputRef}
                className="script-import-input"
                type="file"
                accept="application/json"
                onChange={(event) => void importScripts(event)}
              />
            </div>

            <div className="script-rows">
              {scripts.map((script) => (
                <button
                  className={`script-row ${script.id === selectedId ? 'is-active' : ''}`}
                  key={script.id}
                  type="button"
                  onClick={() => setSelectedId(script.id)}
                >
                  <LocalScriptIcon icon={script.icon} />
                  <span className="script-copy">
                    <strong>{script.name}</strong>
                    <em>{script.matchPattern} · {script.status}</em>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              className={`updates-row ${selectedGitView === 'updates' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setSelectedGitView('updates')}
            >
              <strong>Updates Checker</strong>
              {availableUpdates.length > 0 && (
                <span className="updates-badge">{availableUpdates.length}</span>
              )}
            </button>

            <div className="sidebar-section-title">Git Registries</div>

            <form className="add-registry-form" onSubmit={(e) => void handleAddRegistry(e)}>
              <label>Add GitHub Repository</label>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="owner/repo"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                />
                <button type="submit">Add</button>
              </div>
              {addError && <span className="add-registry-error">{addError}</span>}
            </form>

            <div className="script-rows">
              {gitRegistries.map((reg) => (
                <button
                  className={`script-row ${reg.id === selectedGitView ? 'is-active' : ''}`}
                  key={reg.id}
                  type="button"
                  onClick={() => setSelectedGitView(reg.id)}
                >
                  <span className="script-icon">G</span>
                  <span className="script-copy">
                    <strong>{reg.name}</strong>
                    <em>{reg.branch} · {reg.commands.length} commands</em>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      {activeTab === 'editor' ? (
        <section className="editor-panel" aria-label="Script editor">
          <header className="editor-header">
            <div>
              <span>{selectedScript.status}</span>
              <h2>{selectedScript.name}</h2>
            </div>
            <div className="editor-actions">
              <span className="save-state">{saveState}</span>
              <button type="button" onClick={testSelectedScript}>Test</button>
              <button type="button" onClick={saveSelectedScript}>Save</button>
            </div>
          </header>

          <div className="meta-grid">
            <label>
              Name
              <input
                value={selectedScript.name}
                onChange={(event) => updateSelectedScript({ name: event.target.value })}
              />
            </label>
            <label>
              Match
              <input
                value={selectedScript.matchPattern}
                onChange={(event) => updateSelectedScript({ matchPattern: event.target.value })}
              />
            </label>
            <IconSelect
              value={selectedScript.icon}
              onChange={(icon) => updateSelectedScript({ icon })}
            />
          </div>

          <section className="script-controls" aria-label="Script controls">
            <div>
              <span>Status</span>
              <div className="status-toggle" role="group" aria-label="Script status">
                {(['enabled', 'disabled', 'draft'] as const).map((status) => (
                  <button
                    className={selectedScript.status === status ? 'is-active' : ''}
                    key={status}
                    type="button"
                    onClick={() => void setSelectedScriptStatus(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
            <button className="danger-button" type="button" onClick={() => void deleteSelectedScript()}>
              Delete
            </button>
          </section>

          <section className="editor-settings" aria-label="Editor settings">
            <label>
              Font
              <select value={editorFontFamily} onChange={(event) => setEditorFontFamily(event.target.value)}>
                {fontFamilyOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Size
              <select value={editorFontSize} onChange={(event) => setEditorFontSize(Number(event.target.value))}>
                {fontSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
          </section>

          <label className="code-editor">
            Source
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
              theme="dark"
              onChange={(code) => updateSelectedScript({ code })}
            />
          </label>

          {staticAuditReport && (
            <section className="static-audit-panel" aria-label="Static security audit report">
              <div className="audit-header">
                <h3>Static Security Audit</h3>
                <span className={`audit-badge is-${staticAuditReport.status}`}>
                  {staticAuditReport.status}
                </span>
              </div>
              <p className="audit-summary">{staticAuditReport.summary}</p>
              <div className="audit-checks-grid">
                <div className="audit-check-item">
                  <span className={`check-icon is-${staticAuditReport.checks.hostScope.status}`}>
                    {staticAuditReport.checks.hostScope.status === 'pass' ? '✓' : staticAuditReport.checks.hostScope.status === 'warning' ? '⚠' : '✗'}
                  </span>
                  <div className="check-details">
                    <strong>Host Scope & Match Patterns</strong>
                    <span>{staticAuditReport.checks.hostScope.detail}</span>
                  </div>
                </div>
                <div className="audit-check-item">
                  <span className={`check-icon is-${staticAuditReport.checks.permissions.status}`}>
                    {staticAuditReport.checks.permissions.status === 'pass' ? '✓' : staticAuditReport.checks.permissions.status === 'warning' ? '⚠' : '✗'}
                  </span>
                  <div className="check-details">
                    <strong>Sensitive APIs & Permissions</strong>
                    <span>{staticAuditReport.checks.permissions.detail}</span>
                  </div>
                </div>
                <div className="audit-check-item">
                  <span className={`check-icon is-${staticAuditReport.checks.remoteCode.status}`}>
                    {staticAuditReport.checks.remoteCode.status === 'pass' ? '✓' : staticAuditReport.checks.remoteCode.status === 'warning' ? '⚠' : '✗'}
                  </span>
                  <div className="check-details">
                    <strong>Remote Code & Injection</strong>
                    <span>{staticAuditReport.checks.remoteCode.detail}</span>
                  </div>
                </div>
                <div className="audit-check-item">
                  <span className={`check-icon is-${staticAuditReport.checks.networkAccess.status}`}>
                    {staticAuditReport.checks.networkAccess.status === 'pass' ? '✓' : staticAuditReport.checks.networkAccess.status === 'warning' ? '⚠' : '✗'}
                  </span>
                  <div className="check-details">
                    <strong>Network Access</strong>
                    <span>{staticAuditReport.checks.networkAccess.detail}</span>
                  </div>
                </div>
                <div className="audit-check-item">
                  <span className={`check-icon is-${staticAuditReport.checks.obfuscation.status}`}>
                    {staticAuditReport.checks.obfuscation.status === 'pass' ? '✓' : staticAuditReport.checks.obfuscation.status === 'warning' ? '⚠' : '✗'}
                  </span>
                  <div className="check-details">
                    <strong>Code Quality & Obfuscation Heuristics</strong>
                    <span>{staticAuditReport.checks.obfuscation.detail}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="test-harness" aria-label="Test harness">
            <div className="harness-header">
              <h3>Test Harness</h3>
              <div className="harness-capabilities">
                <span>Capabilities:</span>
                <div className="capability-list">
                  {detectedCapabilities.length === 0 ? (
                    <span className="capability-tag none">none</span>
                  ) : (
                    detectedCapabilities.map((cap) => (
                      <span key={cap} className="capability-tag">{cap}</span>
                    ))
                  )}
                </div>
              </div>
              <button className="run-harness-button" type="button" onClick={testSelectedScript}>Run Test</button>
            </div>

            <div className="harness-grid">
              <label>
                Mock URL
                <input
                  type="text"
                  value={mockUrl}
                  onChange={(e) => setMockUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </label>
              <label>
                Mock Title
                <input
                  type="text"
                  value={mockTitle}
                  onChange={(e) => setMockTitle(e.target.value)}
                  placeholder="Page Title"
                />
              </label>
              <label>
                Mock Selection
                <input
                  type="text"
                  value={mockSelection}
                  onChange={(e) => setMockSelection(e.target.value)}
                  placeholder="Selected text"
                />
              </label>
            </div>

            <div className="harness-dom-log">
              <label className="harness-html-label">
                Mock DOM HTML
                <textarea
                  value={mockHtml}
                  onChange={(e) => setMockHtml(e.target.value)}
                  placeholder="<div>Mock page content</div>"
                />
              </label>
              <label className="harness-log-label">
                Console & Execution Logs
                <pre className="terminal-logs">{testOutput}</pre>
              </label>
            </div>
          </section>
        </section>
      ) : selectedGitView === 'updates' ? (
        <section className="update-checker-panel" aria-label="Update checker">
          <header className="update-checker-header">
            <div className="update-checker-info">
              <h2>Unified Update Checker</h2>
              <p>{updateStatusText}</p>
            </div>
            <div className="update-controls">
              <button
                className="check-updates-btn"
                type="button"
                disabled={isCheckingUpdates}
                onClick={() => void checkUpdates()}
              >
                {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
              </button>
              {availableUpdates.length > 0 && (
                <button
                  className="update-all-btn"
                  type="button"
                  onClick={() => void handleUpdateAll()}
                >
                  Update All
                </button>
              )}
            </div>
          </header>

          {availableUpdates.length === 0 ? (
            <div className="no-updates-panel">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h4>All scripts up to date</h4>
              <p>Click "Check for Updates" to scan official registry and git-based local scripts.</p>
            </div>
          ) : (
            <div className="updates-grid">
              {availableUpdates.map((update) => (
                <div className="update-card" key={update.id}>
                  <div className="card-icon">
                    {update.type === 'official' ? 'R' : 'G'}
                  </div>
                  <div className="card-copy">
                    <h4>{update.name}</h4>
                    <div className="card-meta">
                      <span className="card-badge">
                        {update.type === 'official' ? 'Official Registry' : 'Git Registry'}
                      </span>
                      <span className="card-badge version-badge">
                        Current: v{update.currentVersion}
                      </span>
                      <span className="card-badge update-version-badge">
                        Latest: v{update.latestVersion}
                      </span>
                    </div>
                  </div>
                  <button
                    className="update-btn"
                    type="button"
                    onClick={() => void handleUpdateScript(update)}
                  >
                    Update
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        (() => {
          const reg = gitRegistries.find(r => r.id === selectedGitView);
          if (!reg) return null;

          return (
            <section className="git-registry-detail" aria-label="Git registry detail">
              <header className="registry-detail-header">
                <div className="registry-detail-info">
                  <h2>{reg.name}</h2>
                  <p>
                    Git Repository: <a href={reg.url} target="_blank" rel="noopener noreferrer">{reg.url}</a> (branch: {reg.branch})
                  </p>
                </div>
                <button
                  className="remove-registry-btn"
                  type="button"
                  onClick={() => void handleRemoveRegistry(reg.id)}
                >
                  Remove Registry
                </button>
              </header>

              <div className="registry-command-grid">
                {reg.commands.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '13px' }}>No commands found in this registry's manifest.</p>
                ) : (
                  reg.commands.map((cmd) => {
                    const isInstalled = scripts.some(s => s.originRegistryUrl === reg.url && s.originCommandId === cmd.id);
                    const installedScript = scripts.find(s => s.originRegistryUrl === reg.url && s.originCommandId === cmd.id);

                    return (
                      <div className="registry-command-card" key={cmd.id}>
                        <LocalScriptIcon icon={cmd.icon} />
                        <div className="card-copy">
                          <h4>{cmd.title}</h4>
                          <p>{cmd.description}</p>
                          <div className="card-meta">
                            <span className="card-badge version-badge">v{cmd.version || '1.0.0'}</span>
                            <span className="card-badge">{cmd.website}</span>
                            {isInstalled && (
                              <span className="card-badge" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
                                Installed v{installedScript?.version || '1.0.0'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className={`install-btn ${isInstalled ? 'is-installed' : ''}`}
                          type="button"
                          onClick={() => void installGitCommand(cmd, reg)}
                        >
                          {isInstalled ? 'Reinstall' : 'Install'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })()
      )}
    </main>
  );
}

function IconSelect({ value, onChange }: { value: CommandIcon; onChange: (value: CommandIcon) => void }) {
  const [open, setOpen] = useState(false);
  const selectedOption = iconOptions.find((option) => iconsMatch(option.icon, value)) ?? iconOptions[2];

  return (
    <label className="icon-select">
      Icon
      <span className="icon-menu">
        <button
          className="icon-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <LocalScriptIcon icon={selectedOption.icon} />
          <span>
            <strong>{selectedOption.label}</strong>
            <em>{selectedOption.hint}</em>
          </span>
        </button>
        {open ? (
          <span className="icon-options" role="listbox">
          {iconOptions.map((option) => (
            <button
              className={iconsMatch(option.icon, value) ? 'is-selected' : ''}
              key={getIconKey(option.icon)}
              type="button"
              role="option"
              aria-selected={iconsMatch(option.icon, value)}
              onClick={() => {
                onChange(option.icon);
                setOpen(false);
              }}
            >
              <LocalScriptIcon icon={option.icon} />
              <span>
                <strong>{option.label}</strong>
                <em>{option.hint}</em>
              </span>
            </button>
          ))}
          </span>
        ) : null}
      </span>
    </label>
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
    <span className="script-icon">
      {iconUrl ? <img src={iconUrl} alt="" /> : getLocalIconLabel(icon)}
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
