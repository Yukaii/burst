import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { seedLocalScripts } from '@/src/lib/localScripts';
import './style.css';

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

  const [scripts, setScripts] = useState(initialScripts);
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

      <section className="editor-panel" key={selectedScript.id} aria-label="Script editor">
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
            <input defaultValue={selectedScript.name} />
          </label>
          <label>
            Match
            <input defaultValue={selectedScript.matchPattern} />
          </label>
          <label>
            Icon
            <input defaultValue={selectedScript.icon} />
          </label>
        </div>

        <label className="code-editor">
          Source
          <textarea defaultValue={selectedScript.code} spellCheck={false} />
        </label>

        <section className="test-console" aria-label="Test output">
          <span>Test output</span>
          <pre>Ready. Test runs will execute in an isolated preview context.</pre>
        </section>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
