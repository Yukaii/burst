import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import { emacs } from '@replit/codemirror-emacs';
import {
  dracula,
  nord,
  atomone,
  vscodeDark,
  githubLight,
  githubDark,
} from '@uiw/codemirror-themes-all';
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
import { ExtensionSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/src/lib/settings';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import logoUrl from '@/assets/logo.svg';
import * as LucideIcons from 'lucide-react';
import {
  MoreVertical,
  ChevronDown,
  Trash2,
  SlidersHorizontal,
  Plus,
  Play,
  Folder,
  Terminal,
  Download,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  Code,
  Power,
  X
} from 'lucide-react';
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
  { icon: { type: 'lucide', name: 'Code' }, label: 'Code', hint: 'Lucide Code icon' },
  { icon: { type: 'lucide', name: 'Terminal' }, label: 'Terminal', hint: 'Lucide Terminal icon' },
  { icon: { type: 'lucide', name: 'Database' }, label: 'Database', hint: 'Lucide Database icon' },
  { icon: { type: 'lucide', name: 'Shield' }, label: 'Shield', hint: 'Lucide Shield icon' },
  { icon: { type: 'lucide', name: 'Play' }, label: 'Play', hint: 'Lucide Play icon' },
  { icon: { type: 'lucide', name: 'Globe' }, label: 'Globe', hint: 'Lucide Globe icon' },
  { icon: { type: 'lucide', name: 'Sparkles' }, label: 'Sparkles', hint: 'Lucide Sparkles icon' },
  { icon: { type: 'lucide', name: 'Activity' }, label: 'Activity', hint: 'Lucide Activity icon' },
  { icon: { type: 'lucide', name: 'FileText' }, label: 'FileText', hint: 'Lucide FileText icon' },
  { icon: { type: 'favicon', host: 'github.com' }, label: 'GitHub', hint: 'github.com favicon' },
  { icon: { type: 'initials', value: 'JS' }, label: 'Script', hint: 'JS initials' },
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

const themesMap: Record<string, any> = {
  dracula,
  nord,
  atomone,
  vscodeDark,
  githubLight,
  githubDark,
};

const editorThemeOptions = [
  { value: 'default', label: 'Default Theme' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' },
  { value: 'atomone', label: 'One Dark' },
  { value: 'vscodeDark', label: 'VS Code Dark' },
  { value: 'githubLight', label: 'GitHub Light' },
  { value: 'githubDark', label: 'GitHub Dark' },
];

const editorKeymapOptions = [
  { value: 'default', label: 'Default (Standard)' },
  { value: 'vim', label: 'Vim' },
  { value: 'emacs', label: 'Emacs' },
];

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

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

function Tooltip({
  content,
  shortcut,
  align = 'center',
  children,
}: {
  content: string;
  shortcut?: string;
  align?: 'center' | 'left' | 'right';
  children: React.ReactNode;
}) {
  const alignClass =
    align === 'left'
      ? 'left-0 origin-top-left'
      : align === 'right'
      ? 'right-0 origin-top-right'
      : 'left-1/2 -translate-x-1/2 origin-top';

  return (
    <div className="relative group/tooltip inline-flex items-center">
      {children}
      <div className={`absolute hidden group-hover/tooltip:flex flex-col items-center gap-0.5 bg-zinc-950 text-zinc-100 border border-zinc-800 text-[10px] font-semibold px-2.5 py-1.5 rounded-md shadow-lg z-50 whitespace-nowrap top-full mt-1.5 pointer-events-none transition-all scale-95 group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 opacity-0 duration-100 ${alignClass}`}>
        <span>{content}</span>
        {shortcut && (
          <span className="text-[9px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 mt-0.5 font-mono">
            {shortcut}
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [scripts, setScripts] = useState<LocalScript[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [editorFontFamily, setEditorFontFamily] = useState(fontFamilyOptions[0].value);
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
  const importInputRef = useRef<HTMLInputElement>(null);
  const nameMeasureRef = useRef<HTMLSpanElement>(null);
  const [nameInputWidth, setNameInputWidth] = useState(180);

  // Column width & Toggle states
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('burst.dashboard.leftWidth');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('burst.dashboard.rightWidth');
    return saved ? parseInt(saved, 10) : 360;
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

  // Dropdown states
  const [newScriptDropdownOpen, setNewScriptDropdownOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string>();
  const [navbarMenuOpen, setNavbarMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // Modals state
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

  // Synchronize editor settings
  useEffect(() => {
    if (settings.editorFontFamily) {
      setEditorFontFamily(settings.editorFontFamily);
    }
    if (settings.editorFontSize) {
      setEditorFontSize(settings.editorFontSize);
    }
    if (settings.editorTheme) {
      setEditorTheme(settings.editorTheme);
    }
    if (settings.editorKeymap) {
      setEditorKeymap(settings.editorKeymap);
    }
    if (settings.editorWordWrap !== undefined) {
      setEditorWordWrap(settings.editorWordWrap);
    }
  }, [
    settings.editorFontFamily,
    settings.editorFontSize,
    settings.editorTheme,
    settings.editorKeymap,
    settings.editorWordWrap
  ]);

  async function updateEditorSettings(
    fontFamily: string,
    fontSize: number,
    theme: string,
    keymap: 'default' | 'vim' | 'emacs',
    wordWrap: boolean
  ) {
    setEditorFontFamily(fontFamily);
    setEditorFontSize(fontSize);
    setEditorTheme(theme);
    setEditorKeymap(keymap);
    setEditorWordWrap(wordWrap);
    const nextSettings = {
      ...settings,
      editorFontFamily: fontFamily,
      editorFontSize: fontSize,
      editorTheme: theme,
      editorKeymap: keymap,
      editorWordWrap: wordWrap,
    };
    setSettings(nextSettings);
    await saveSettings(nextSettings);
  }

  const startLeftDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
  };

  const startRightDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
  };

  useEffect(() => {
    if (!isDraggingLeft && !isDraggingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = Math.max(180, Math.min(500, e.clientX));
        setLeftWidth(newWidth);
        localStorage.setItem('burst.dashboard.leftWidth', String(newWidth));
      } else if (isDraggingRight) {
        const newWidth = Math.max(240, Math.min(600, window.innerWidth - e.clientX));
        setRightWidth(newWidth);
        localStorage.setItem('burst.dashboard.rightWidth', String(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  useEffect(() => {
    function checkPermission() {
      const hasWxt = typeof browser !== 'undefined' && !!browser.userScripts;
      const hasChrome = typeof window !== 'undefined' && 'chrome' in window && !!(window as any).chrome?.userScripts;
      setHasUserScriptsPermission(hasWxt || hasChrome);
    }
    checkPermission();
    window.addEventListener('focus', checkPermission);
    return () => {
      window.removeEventListener('focus', checkPermission);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const isSaveShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's';
      if (isSaveShortcut) {
        e.preventDefault();
        void saveSelectedScript('Saved');
        return;
      }

      if (e.key === 'Escape') {
        if (confirmModal.open) {
          e.preventDefault();
          setConfirmModal(curr => ({ ...curr, open: false }));
          return;
        }
        if (testHarnessOpen) {
          e.preventDefault();
          setTestHarnessOpen(false);
          return;
        }
        if (editorPrefModalOpen) {
          e.preventDefault();
          setEditorPrefModalOpen(false);
          return;
        }
      }

      const isToggleLeft = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === '\\';
      const isToggleRight = (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === '\\';

      if (isToggleLeft) {
        e.preventDefault();
        setLeftSidebarOpen((open) => {
          const next = !open;
          localStorage.setItem('burst.dashboard.leftSidebarOpen', String(next));
          return next;
        });
      } else if (isToggleRight) {
        e.preventDefault();
        setRightPanelOpen((open) => {
          const next = !open;
          localStorage.setItem('burst.dashboard.rightPanelOpen', String(next));
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmModal.open, editorPrefModalOpen, hasUnsavedChanges, scripts, selectedId, testHarnessOpen]);

  const selectedScript = scripts.find((script) => script.id === selectedId) ?? scripts[0];

  useEffect(() => {
    const measuredWidth = nameMeasureRef.current?.offsetWidth ?? 0;
    setNameInputWidth(Math.min(Math.max(measuredWidth + 18, 160), 520));
  }, [selectedScript?.name]);

  const detectedCapabilities = useMemo(() => {
    return selectedScript ? detectRequiredCapabilities(selectedScript.code) : [];
  }, [selectedScript?.code]);
  const staticAuditReport = useMemo(() => {
    if (!selectedScript) return null;
    return analyzeScriptCode(selectedScript.code, selectedScript.matchPatterns);
  }, [selectedScript?.code, selectedScript?.matchPatterns]);
  const selectedAuditStatus = staticAuditReport?.status ?? 'pass';

  useEffect(() => {
    if (!hasUnsavedChanges || loadState !== 'ready' || !selectedScript) return;

    const timeout = window.setTimeout(() => {
      void saveSelectedScript('Autosaved');
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [hasUnsavedChanges, loadState, scripts, selectedScript?.id]);

  const activeTheme = useMemo(() => {
    return settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : settings.theme;
  }, [settings.theme]);

  const editorThemeExtension = useMemo(
    () => createEditorTheme(editorFontFamily, editorFontSize, activeTheme === 'dark'),
    [editorFontFamily, editorFontSize, activeTheme],
  );

  const baseLayoutTheme = useMemo(() => {
    return EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${editorFontSize}px`,
      },
      '.cm-scroller': {
        fontFamily: editorFontFamily,
        lineHeight: '1.55',
      },
      '.cm-content': {
        padding: '14px 0',
      },
      '.cm-line': {
        padding: '0 14px',
        textTransform: 'none',
      }
    });
  }, [editorFontFamily, editorFontSize]);

  const selectedThemeValue = useMemo(() => {
    if (editorTheme && editorTheme !== 'default') {
      return themesMap[editorTheme] || (activeTheme === 'dark' ? 'dark' : 'light');
    }
    return activeTheme === 'dark' ? 'dark' : 'light';
  }, [editorTheme, activeTheme]);

  const editorExtensions = useMemo(() => {
    const list: any[] = [javascript({ jsx: true, typescript: true })];
    
    // Add theme layout/visuals
    if (editorTheme === 'default') {
      list.push(editorThemeExtension);
    } else {
      list.push(baseLayoutTheme);
    }
    
    // Add keymap
    if (editorKeymap === 'vim') {
      list.push(vim());
    } else if (editorKeymap === 'emacs') {
      list.push(emacs());
    }
    
    // Add word wrap
    if (editorWordWrap) {
      list.push(EditorView.lineWrapping);
    }
    
    return list;
  }, [editorTheme, editorThemeExtension, baseLayoutTheme, editorKeymap, editorWordWrap]);

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
        const shouldCreateDraft = params.get('mode') === 'new' || params.has('new');
        const nextScripts = shouldCreateDraft
          ? [createLocalScriptDraft(), ...storedScripts]
          : storedScripts;

        if (shouldCreateDraft) {
          await saveLocalScripts(nextScripts);
          params.delete('mode');
          params.delete('new');
          const nextSearch = params.toString();
          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
          );
        }

        if (cancelled) return;
        setScripts(nextScripts);
        setSelectedId(nextScripts[0]?.id);
        setGitRegistries(storedRegistries);
        setLoadState('ready');
        setSaveState(shouldCreateDraft ? 'Draft saved' : '');
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
    const reg = gitRegistries.find(r => r.id === id);
    if (!reg) return;

    setConfirmModal({
      open: true,
      title: 'Remove Git Registry',
      message: <>Are you sure you want to remove the registry <strong>"{reg.name}"</strong>? (Installed scripts from it will remain installed)</>,
      confirmText: 'Remove',
      isDestructive: true,
      onConfirm: async () => {
        const nextRegistries = gitRegistries.filter(r => r.id !== id);
        setGitRegistries(nextRegistries);
        await saveGitRegistries(nextRegistries);
        setSelectedGitView('updates');
      }
    });
  }

  async function installGitCommand(command: BurstCommand, registry: GitRegistry) {
    const alreadyInstalled = scripts.find(s => s.originRegistryUrl === registry.url && s.originCommandId === command.id);
    
    if (alreadyInstalled) {
      setConfirmModal({
        open: true,
        title: 'Overwrite Installed Script',
        message: <><strong>"{command.title}"</strong> is already installed. Do you want to overwrite it with version {command.version}?</>,
        confirmText: 'Overwrite',
        isDestructive: false,
        onConfirm: async () => {
          const nextScripts = scripts.map(s => {
            if (s.id === alreadyInstalled.id) {
              return {
                ...s,
                name: command.title,
                matchPatterns: command.matchPatterns.length > 0 ? command.matchPatterns : ['<all_urls>'],
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
        }
      });
      return;
    }

    const newScript: LocalScript = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: command.title,
      matchPatterns: command.matchPatterns.length > 0 ? command.matchPatterns : ['<all_urls>'],
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

  function handleModalOverlayClick(event: React.MouseEvent<HTMLDivElement>, close: () => void) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function updateSelectedScript(patch: Partial<LocalScript>) {
    if (!selectedScript) return;

    setScripts((current) =>
      current.map((script) => script.id === selectedScript.id ? { ...script, ...patch } : script),
    );
    setHasUnsavedChanges(true);
    setSaveState('Unsaved changes');
  }

  async function saveSelectedScript(successMessage = 'Saved') {
    if (!selectedScript) return;

    const nextScripts = scripts.map((script) =>
      script.id === selectedScript.id ? prepareLocalScriptForSave(script) : script,
    );

    setScripts(nextScripts);
    setSaveState('Saving...');
    await persistScripts(nextScripts, successMessage);
    setHasUnsavedChanges(false);
  }

  function setSelectedScriptStatus(status: LocalScript['status']) {
    if (!selectedScript) return;
    updateSelectedScript({ status });
  }

  async function deleteSelectedScript() {
    if (!selectedScript) return;

    setConfirmModal({
      open: true,
      title: 'Delete Script',
      message: <>Are you sure you want to delete script <strong>"{selectedScript.name}"</strong>? This action cannot be undone.</>,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        const selectedIndex = scripts.findIndex((script) => script.id === selectedScript.id);
        const nextScripts = scripts.filter((script) => script.id !== selectedScript.id);
        const fallbackDraft = nextScripts.length > 0 ? undefined : createLocalScriptDraft();
        const finalScripts = fallbackDraft ? [fallbackDraft] : nextScripts;
        const nextSelection = finalScripts[Math.max(0, selectedIndex - 1)] ?? finalScripts[0];

        setScripts(finalScripts);
        setSelectedId(nextSelection.id);
        await persistScripts(finalScripts, fallbackDraft ? 'Deleted script and created a draft' : 'Deleted script');
      }
    });
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

  async function setScriptStatusDirectly(script: LocalScript, status: LocalScript['status']) {
    const nextScripts = scripts.map((s) =>
      s.id === script.id ? prepareLocalScriptForSave({ ...s, status }) : s
    );
    setScripts(nextScripts);
    await persistScripts(nextScripts, 'Saved');
  }

  function exportSingleScript(script: LocalScript) {
    const backup = createLocalScriptBackup([script]);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `burst-script-${script.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
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
      if (importedScripts.length === 0) {
        setSaveState('Import failed: no valid scripts found');
        return;
      }

      setConfirmModal({
        open: true,
        title: 'Import Scripts',
        message: <>Are you sure you want to import {importedScripts.length} scripts and replace all current local scripts?</>,
        confirmText: 'Import & Replace',
        isDestructive: true,
        onConfirm: async () => {
          setScripts(importedScripts);
          setSelectedId(importedScripts[0].id);
          await persistScripts(importedScripts, `Imported ${importedScripts.length} scripts`);
        }
      });
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
      {(isDraggingLeft || isDraggingRight) && <div className="drag-overlay" />}

      {/* Left Sidebar */}
      {leftSidebarOpen && (
        <>
          <aside style={{ width: `${leftWidth}px` }} className="shrink-0 bg-card flex flex-col overflow-hidden" aria-label="Local scripts">
            <header className="h-16 px-4 bg-card border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <img src={logoUrl} className="w-6 h-6 shrink-0" alt="Burst Logo" />
                <div className="min-w-0">
                  <h1 className="text-sm font-semibold text-foreground tracking-tight leading-none">Burst</h1>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">Local scripts companion</p>
                </div>
              </div>
              <Tooltip content="Collapse Left Sidebar" shortcut={isMac ? "⌘\\" : "Ctrl+\\"} align="right">
                <button
                  onClick={() => {
                    setLeftSidebarOpen(false);
                    localStorage.setItem('burst.dashboard.leftSidebarOpen', 'false');
                  }}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  type="button"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </Tooltip>
            </header>

            <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">

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
                <div className="relative inline-flex w-full shrink-0">
                  <button
                    className="flex-1 inline-flex items-center justify-center rounded-l-md text-xs font-semibold h-8 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors border-r border-primary-foreground/10"
                    type="button"
                    onClick={createDraft}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New script
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-r-md text-xs font-semibold w-8 h-8 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
                    type="button"
                    onClick={() => setNewScriptDropdownOpen(curr => !curr)}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {newScriptDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setNewScriptDropdownOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 z-20 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in">
                        <button
                          type="button"
                          onClick={() => {
                            exportScripts();
                            setNewScriptDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                        >
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          Export scripts
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            importInputRef.current?.click();
                            setNewScriptDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                        >
                          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                          Import scripts
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={importInputRef}
                  className="hidden"
                  type="file"
                  accept="application/json"
                  onChange={(event) => void importScripts(event)}
                />

                {/* Script list scrollable content */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                  {scripts.map((script) => {
                    const auditStatus = getScriptAuditStatus(script);
                    return (
                      <div
                        className={`group w-full flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent hover:bg-accent/40 cursor-pointer ${
                          script.id === selectedId ? 'bg-accent border-border' : ''
                        }`}
                        key={script.id}
                        onClick={() => setSelectedId(script.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="relative shrink-0">
                            <LocalScriptIcon icon={script.icon} />
                            <AuditIssueDot status={auditStatus} />
                          </span>
                          <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <strong className="text-xs font-semibold text-foreground truncate block">{script.name}</strong>
                            <em className="text-[10px] text-muted-foreground truncate block not-italic font-medium">
                              {formatMatchPatterns(script.matchPatterns)} · <span className={
                                script.status === 'enabled' ? 'text-emerald-400 font-semibold' :
                                script.status === 'disabled' ? 'text-red-400 font-semibold' :
                                'text-amber-400 font-semibold'
                              }>{script.status}</span>
                            </em>
                          </span>
                        </div>

                      <div className="relative shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(curr => curr === script.id ? undefined : script.id);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/80 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          type="button"
                          title="Actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {openMenuId === script.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(undefined);
                            }} />
                            <div className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextStatus = script.status === 'enabled' ? 'disabled' : 'enabled';
                                  void setScriptStatusDirectly(script, nextStatus);
                                  setOpenMenuId(undefined);
                                }}
                                className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                              >
                                <Power className="w-3.5 h-3.5 text-muted-foreground" />
                                {script.status === 'enabled' ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  exportSingleScript(script);
                                  setOpenMenuId(undefined);
                                }}
                                className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                              >
                                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                Export
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModal({
                                    open: true,
                                    title: 'Delete Script',
                                    message: <>Are you sure you want to delete script <strong>"{script.name}"</strong>? This action cannot be undone.</>,
                                    confirmText: 'Delete',
                                    isDestructive: true,
                                    onConfirm: async () => {
                                      const targetIndex = scripts.findIndex((s) => s.id === script.id);
                                      const nextScripts = scripts.filter((s) => s.id !== script.id);
                                      const fallbackDraft = nextScripts.length > 0 ? undefined : createLocalScriptDraft();
                                      const finalScripts = fallbackDraft ? [fallbackDraft] : nextScripts;
                                      const nextSelection = (finalScripts[Math.max(0, targetIndex - 1)] ?? finalScripts[0]).id;

                                      setScripts(finalScripts);
                                      setSelectedId(nextSelection);
                                      await persistScripts(finalScripts, fallbackDraft ? 'Deleted script and created a draft' : 'Deleted script');
                                    }
                                  });
                                  setOpenMenuId(undefined);
                                }}
                                className="w-full flex items-center gap-2 p-2 rounded text-xs text-destructive hover:bg-destructive/10 cursor-pointer transition-colors text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })}
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
            </div>
          </aside>
          <div
            className={`resize-handle ${isDraggingLeft ? 'active' : ''}`}
            onMouseDown={startLeftDrag}
          />
        </>
      )}

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
          <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {!leftSidebarOpen && (
                <Tooltip content="Expand Left Sidebar" shortcut={isMac ? "⌘\\" : "Ctrl+\\"} align="left">
                  <button
                    onClick={() => {
                      setLeftSidebarOpen(true);
                      localStorage.setItem('burst.dashboard.leftSidebarOpen', 'true');
                    }}
                    className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    type="button"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((open) => !open)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${getStatusClassName(selectedScript.status)} hover:bg-accent/50`}
                  aria-haspopup="menu"
                  aria-expanded={statusMenuOpen}
                >
                  {selectedScript.status}
                  <ChevronDown className="w-3 h-3" aria-hidden="true" />
                </button>
                {statusMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 z-20 w-36 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="menu">
                      {(['enabled', 'disabled', 'draft'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selectedScript.status === status}
                          onClick={() => {
                            setSelectedScriptStatus(status);
                            setStatusMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left ${
                            selectedScript.status === status ? 'bg-accent/50 text-foreground' : ''
                          }`}
                        >
                          <span className="capitalize">{status}</span>
                          <span className={`h-2 w-2 rounded-full ${getStatusDotClassName(status)}`} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <IconSelect
                value={selectedScript.icon}
                onChange={(icon) => updateSelectedScript({ icon })}
                variant="toolbar"
              />
              <span
                ref={nameMeasureRef}
                className="pointer-events-none invisible absolute whitespace-pre text-base font-semibold tracking-tight"
                aria-hidden="true"
              >
                {selectedScript.name || 'Untitled local command'}
              </span>
              <input
                aria-label="Script name"
                value={selectedScript.name}
                onChange={(event) => updateSelectedScript({ name: event.target.value })}
                style={{ width: `${nameInputWidth}px` }}
                className="h-9 min-w-0 max-w-full bg-transparent text-base font-semibold tracking-tight text-foreground outline-none rounded-md px-1.5 focus:bg-background focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-3">
              {saveState && (
                <span className="text-xs text-muted-foreground animate-fade-in truncate max-w-[200px] font-medium">
                  {saveState}
                </span>
              )}
              <button
                type="button"
                onClick={() => setTestHarnessOpen(true)}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                Test
              </button>
              {hasUnsavedChanges ? (
                <button
                  type="button"
                  onClick={() => void saveSelectedScript('Saved')}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
                >
                  Save
                </button>
              ) : null}
              <Tooltip content="Editor Preferences">
                <button
                  type="button"
                  onClick={() => setEditorPrefModalOpen(true)}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </Tooltip>
              <div className="relative">
                <Tooltip content="More actions">
                  <button
                    type="button"
                    onClick={() => setNavbarMenuOpen((open) => !open)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    aria-haspopup="menu"
                    aria-expanded={navbarMenuOpen}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </Tooltip>
                {navbarMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNavbarMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-20 w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          void deleteSelectedScript();
                          setNavbarMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs text-destructive hover:bg-destructive/10 cursor-pointer transition-colors text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        Delete script
                      </button>
                    </div>
                  </>
                )}
              </div>
              <Tooltip
                content={rightPanelOpen ? "Collapse Right Panel" : "Expand Right Panel"}
                shortcut={isMac ? "⌘⇧\\" : "Ctrl+Shift+\\"}
                align="right"
              >
                <button
                  type="button"
                  onClick={() => {
                    setRightPanelOpen(open => {
                      const next = !open;
                      localStorage.setItem('burst.dashboard.rightPanelOpen', String(next));
                      return next;
                    });
                  }}
                  className="relative p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  <AuditIssueDot status={selectedAuditStatus} />
                </button>
              </Tooltip>
            </div>
          </header>

          {/* IDE Layout Workspace (Split Columns) */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Workspace Panel: metadata inputs and source editor */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
              {/* Metadata Inputs */}
              <div className="p-4 border-b border-border bg-card/20 shrink-0">
                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Match Patterns
                  <textarea
                    value={selectedScript.matchPatterns.join('\n')}
                    onChange={(event) => updateSelectedScript({ matchPatterns: parseMatchPatternsInput(event.target.value) })}
                    rows={3}
                    placeholder={'github.com/*\nhttps://docs.example.com/*\n<all_urls>'}
                    className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="text-[10px] normal-case tracking-normal font-medium text-muted-foreground">
                    One pattern per line. Commas are also accepted.
                  </span>
                </label>
              </div>

              {/* Source editor workspace */}
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Source Code</span>
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
                    extensions={editorExtensions}
                    height="100%"
                    theme={selectedThemeValue}
                    onChange={(code) => updateSelectedScript({ code })}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel Workspace (Conditionally Rendered) */}
            {rightPanelOpen && (
              <>
                <div
                  className={`resize-handle ${isDraggingRight ? 'active' : ''}`}
                  onMouseDown={startRightDrag}
                />
                <div style={{ width: `${rightWidth}px` }} className="shrink-0 flex flex-col h-full overflow-y-auto divide-y divide-border bg-card/5">
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
                            : 'bg-red-500/10 text-red-400 border-red-500/25'
                        }`}>
                          {staticAuditReport.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{staticAuditReport.summary}</p>
                      
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
                  <section className="p-4 flex flex-col gap-3" aria-label="Interactive sandbox">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Interactive Sandbox</h3>
                      <button
                        type="button"
                        onClick={() => setTestHarnessOpen(true)}
                        className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                      >
                        Open Sandbox
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Simulate browser environment variables, inspect DOM operations, and view custom script logs in a safe context.
                    </p>
                  </section>

                </div>
              </>
            )}
          </div>
        </section>
      ) : selectedGitView === 'updates' ? (
        <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Update checker">
          <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {!leftSidebarOpen && (
                <Tooltip content="Expand Left Sidebar" shortcut={isMac ? "⌘\\" : "Ctrl+\\"} align="left">
                  <button
                    onClick={() => {
                      setLeftSidebarOpen(true);
                      localStorage.setItem('burst.dashboard.leftSidebarOpen', 'true');
                    }}
                    className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    type="button"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">Unified Update Checker</h2>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">{updateStatusText}</p>
              </div>
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
              <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {!leftSidebarOpen && (
                    <Tooltip content="Expand Left Sidebar" shortcut={isMac ? "⌘\\" : "Ctrl+\\"} align="left">
                      <button
                        onClick={() => {
                          setLeftSidebarOpen(true);
                          localStorage.setItem('burst.dashboard.leftSidebarOpen', 'true');
                        }}
                        className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
                        type="button"
                      >
                        <PanelLeftOpen className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
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
                </div>
                <button
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-destructive text-destructive-foreground border border-destructive/20 hover:bg-destructive/90 shadow-sm cursor-pointer transition-colors shrink-0"
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

      {/* Editor Preferences Modal */}
      {editorPrefModalOpen && (
        <div
          className="fixed-modal-overlay"
          onClick={(event) => handleModalOverlayClick(event, () => setEditorPrefModalOpen(false))}
        >
          <div className="modal-content-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Editor Preferences</h3>
            
            <div className="flex flex-col gap-4 mb-6">
              <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                Font Family
                <Select
                  value={editorFontFamily}
                  onValueChange={(value) => void updateEditorSettings(value, editorFontSize, editorTheme, editorKeymap, editorWordWrap)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {fontFamilyOptions.map((option) => (
                        <SelectItem key={option.label} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              
              <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                Font Size
                <Select
                  value={String(editorFontSize)}
                  onValueChange={(value) => void updateEditorSettings(editorFontFamily, Number(value), editorTheme, editorKeymap, editorWordWrap)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {fontSizeOptions.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                Syntax Theme
                <Select
                  value={editorTheme}
                  onValueChange={(value) => void updateEditorSettings(editorFontFamily, editorFontSize, value, editorKeymap, editorWordWrap)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {editorThemeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>

              <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-left">
                Keybindings
                <Select
                  value={editorKeymap}
                  onValueChange={(value) => void updateEditorSettings(editorFontFamily, editorFontSize, editorTheme, value as 'default' | 'vim' | 'emacs', editorWordWrap)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {editorKeymapOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>

              <div className="flex items-center justify-between py-2 border-t border-border mt-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Word Wrapping</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editorWordWrap}
                    onChange={(event) => void updateEditorSettings(editorFontFamily, editorFontSize, editorTheme, editorKeymap, event.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditorPrefModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Confirm Modal */}
      {confirmModal.open && (
        <div
          className="fixed-modal-overlay"
          onClick={(event) => handleModalOverlayClick(event, () => setConfirmModal(curr => ({ ...curr, open: false })))}
        >
          <div className={`modal-content-card ${confirmModal.isDestructive ? 'border-destructive/20' : 'border-border'}`}>
            <h3 className={`text-sm font-semibold mb-2 ${confirmModal.isDestructive ? 'text-destructive' : 'text-foreground'}`}>
              {confirmModal.title}
            </h3>
            <div className="text-xs text-muted-foreground mb-6 leading-relaxed">
              {confirmModal.message}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(curr => ({ ...curr, open: false }))}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) {
                    void confirmModal.onConfirm();
                  }
                  setConfirmModal(curr => ({ ...curr, open: false }));
                }}
                className={`inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 shadow cursor-pointer transition-colors ${
                  confirmModal.isDestructive
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Harness Overlay Modal */}
      {testHarnessOpen && (
        <div
          className="fixed-modal-overlay"
          onClick={(event) => handleModalOverlayClick(event, () => setTestHarnessOpen(false))}
        >
          <div className="modal-content-card-large">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Script Test Harness</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Run and debug <strong>{selectedScript.name}</strong> inside a simulated browser sandbox.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTestHarnessOpen(false)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Split Content columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-y-auto flex-1 pr-1">
              {/* Left Column: Capabilities & Mock Settings */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-muted-foreground select-none">
                  <span className="text-[10px] tracking-wider uppercase">Detected Capabilities:</span>
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

                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Mock URL
                  <input
                    type="text"
                    value={mockUrl}
                    onChange={(e) => setMockUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Mock Title
                  <input
                    type="text"
                    value={mockTitle}
                    onChange={(e) => setMockTitle(e.target.value)}
                    placeholder="Page Title"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Mock Selection
                  <input
                    type="text"
                    value={mockSelection}
                    onChange={(e) => setMockSelection(e.target.value)}
                    placeholder="Selected text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-1 min-h-[140px]">
                  Mock DOM HTML
                  <textarea
                    value={mockHtml}
                    onChange={(e) => setMockHtml(e.target.value)}
                    placeholder="<div>Mock page content</div>"
                    className="flex w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-sm focus-visible:outline-none font-mono resize-none"
                  />
                </label>
              </div>

              {/* Right Column: Console Terminal output */}
              <div className="flex flex-col gap-3 min-h-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">Console & Execution Logs</span>
                <pre className="flex-1 p-3 rounded-md bg-zinc-950 text-zinc-200 border border-zinc-800 font-mono text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap select-text shadow-inner">
                  {testOutput || 'No execution logs.'}
                </pre>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 border-t border-border pt-4 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setTestHarnessOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-4 py-2 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={testSelectedScript}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
              >
                Run Execution
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function IconSelect({
  value,
  onChange,
  variant = 'field',
}: {
  value: CommandIcon;
  onChange: (value: CommandIcon) => void;
  variant?: 'field' | 'toolbar';
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = iconOptions.find((option) => iconsMatch(option.icon, value)) ?? iconOptions[2];
  const isToolbar = variant === 'toolbar';

  return (
    <div className={`${isToolbar ? 'shrink-0' : 'flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider'} relative`}>
      {isToolbar ? null : 'Icon'}
      <div className="relative">
        <button
          className={isToolbar
            ? 'flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm hover:bg-accent/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            : 'flex h-9 w-full items-center gap-3 rounded-md border border-input bg-background pl-3 pr-4 py-1.5 text-xs text-foreground shadow-sm hover:bg-accent/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left'}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choose script icon"
          onClick={() => setOpen((current) => !current)}
        >
          <LocalScriptIcon icon={selectedOption.icon} />
          {isToolbar ? null : (
            <>
              <span className="min-w-0 flex-1 flex flex-col justify-center">
                <strong className="text-xs font-semibold text-foreground truncate block">{selectedOption.label}</strong>
                <em className="text-[9px] text-muted-foreground truncate block not-italic font-normal mt-0.5">{selectedOption.hint}</em>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 select-none ml-1" aria-hidden="true" />
            </>
          )}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1.5 z-20 w-[220px] max-h-[300px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="listbox">
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

function parseMatchPatternsInput(value: string): string[] {
  const patterns = value
    .split(/[\n,]+/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);

  return patterns.length > 0 ? patterns : ['<all_urls>'];
}

function formatMatchPatterns(patterns: string[]): string {
  return patterns.length > 0 ? patterns.join(', ') : '<all_urls>';
}

function getStatusClassName(status: LocalScript['status']): string {
  if (status === 'enabled') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (status === 'disabled') return 'bg-red-500/10 text-red-400 border-red-500/25';
  return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
}

function getStatusDotClassName(status: LocalScript['status']): string {
  if (status === 'enabled') return 'bg-emerald-400';
  if (status === 'disabled') return 'bg-red-400';
  return 'bg-amber-400';
}

function getScriptAuditStatus(script: LocalScript): 'pass' | 'warning' | 'fail' {
  return analyzeScriptCode(script.code, script.matchPatterns).status;
}

function AuditIssueDot({ status }: { status: 'pass' | 'warning' | 'fail' }) {
  if (status === 'pass') return null;

  return (
    <span
      className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card ${
        status === 'fail' ? 'bg-red-400' : 'bg-amber-400'
      }`}
      title={status === 'fail' ? 'Audit issue found' : 'Audit warning found'}
      aria-label={status === 'fail' ? 'Audit issue found' : 'Audit warning found'}
    />
  );
}

function LocalScriptIcon({ icon }: { icon: CommandIcon }) {
  if (icon.type === 'lucide') {
    const IconComponent = (LucideIcons as any)[icon.name];
    return (
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border shrink-0 overflow-hidden">
        {IconComponent ? <IconComponent className="w-4 h-4 text-foreground" /> : <LucideIcons.Code className="w-4 h-4 text-foreground" />}
      </span>
    );
  }

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
  if (icon.type === 'lucide') return `lucide:${icon.name}`;
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
