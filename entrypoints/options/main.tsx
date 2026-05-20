import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

function OptionsApp() {
  return (
    <main className="options-shell">
      <section className="options-panel">
        <div className="brand-row">
          <span>B</span>
          <div>
            <h1>Burst</h1>
            <p>Command palette settings</p>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <h2>Keyboard shortcut</h2>
            <p>
              Burst uses Chrome extension shortcuts. The default is <kbd>Command</kbd> <kbd>Shift</kbd> <kbd>K</kbd> on macOS and <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>K</kbd> elsewhere.
            </p>
          </div>
          <a href="chrome://extensions/shortcuts">Open shortcuts</a>
        </div>

        <div className="setting-row">
          <div>
            <h2>Overlay behavior</h2>
            <p>The page stays untouched until the shortcut opens the palette. Burst does not inject a floating launcher button.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
