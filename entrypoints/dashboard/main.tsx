import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import type { CommandIcon } from '@/src/lib/commands';
import {
  createLocalScriptDraft,
  loadLocalScripts,
  LocalScript,
  prepareLocalScriptForSave,
  saveLocalScripts,
} from '@/src/lib/localScripts';
import './style.css';

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
  const selectedScript = scripts.find((script) => script.id === selectedId) ?? scripts[0];
  const editorTheme = useMemo(
    () => createEditorTheme(editorFontFamily, editorFontSize),
    [editorFontFamily, editorFontSize],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateScripts() {
      try {
        const storedScripts = await loadLocalScripts();
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

  function testSelectedScript() {
    if (!selectedScript) return;

    try {
      // Compilation-only test for now. Runtime isolation is tracked separately.
      compileLocalScript(selectedScript.code);
      setTestOutput(`Syntax check passed for ${selectedScript.name}.`);
    } catch (error) {
      setTestOutput(error instanceof Error ? error.message : 'Syntax check failed.');
    }
  }

  async function persistScripts(nextScripts: LocalScript[], successMessage: string) {
    try {
      await saveLocalScripts(nextScripts);
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
          <div className="brand-mark">B</div>
          <div>
            <h1>Burst</h1>
            <p>Local scripts</p>
          </div>
        </header>

        <button className="new-script-button" type="button" onClick={createDraft}>
          New script
        </button>

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
      </aside>

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

        <section className="test-console" aria-label="Test output">
          <span>Test output</span>
          <pre>{testOutput}</pre>
        </section>
      </section>
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
  const moduleBody = code.replace(/^\s*export\s+default\s+/, '');
  new Function(`return (${moduleBody});`);
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
