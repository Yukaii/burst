import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { LocalScript, seedLocalScripts } from '@/src/lib/localScripts';
import './style.css';

const iconOptions = [
  { value: 'GH', label: 'GitHub' },
  { value: 'CS', label: 'Capture' },
  { value: 'UL', label: 'Default' },
  { value: 'JS', label: 'Script' },
  { value: 'AI', label: 'AI' },
  { value: '+', label: 'Create' },
];

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#111827',
    color: '#dbeafe',
    fontSize: '13px',
  },
  '.cm-scroller': {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
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

function DashboardApp() {
  const initialScripts = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== 'new') return seedLocalScripts;

    return [
      {
          id: 'new-script',
          name: 'Untitled local command',
          matchPattern: '<all_urls>',
          icon: 'UL',
          status: 'draft' as const,
          updatedAt: new Date().toISOString().slice(0, 10),
          code: `export default async function run() {\n  // Write a local command here.\n}`,
      },
      ...seedLocalScripts,
    ];
  }, []);

  const [scripts, setScripts] = useState<LocalScript[]>(initialScripts);
  const [selectedId, setSelectedId] = useState(initialScripts[0].id);
  const selectedScript = scripts.find((script) => script.id === selectedId) ?? scripts[0];

  function createDraft() {
    const draft = {
      id: `draft-${Date.now()}`,
      name: 'Untitled local command',
      matchPattern: '<all_urls>',
      icon: 'UL',
      status: 'draft' as const,
      updatedAt: new Date().toISOString().slice(0, 10),
      code: `export default async function run() {\n  // Write a local command here.\n}`,
    };

    setScripts((current) => [draft, ...current]);
    setSelectedId(draft.id);
  }

  function updateSelectedScript(patch: Partial<LocalScript>) {
    setScripts((current) =>
      current.map((script) => script.id === selectedScript.id ? { ...script, ...patch } : script),
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
              <span className="script-icon">{script.icon}</span>
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
            <button type="button">Test</button>
            <button type="button">Save</button>
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
          <pre>Ready. Test runs will execute in an isolated preview context.</pre>
        </section>
      </section>
    </main>
  );
}

function IconSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="icon-select">
      Icon
      <span className="icon-control">
        <span className="icon-preview">{value}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {iconOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
