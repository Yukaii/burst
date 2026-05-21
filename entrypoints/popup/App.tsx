import { useState } from 'react';
import './App.css';

function App() {
  const [showRegistryNotice, setShowRegistryNotice] = useState(false);

  function openOptionsPage() {
    if (typeof browser === 'undefined' || !browser.runtime?.openOptionsPage) {
      window.location.href = '/options.html';
      return;
    }

    void browser.runtime.openOptionsPage();
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <span className="brand-mark">B</span>
        <div>
          <h1>Burst</h1>
          <p>Command palette</p>
        </div>
      </header>

      <section className="popup-search" aria-label="Shortcut">
        <span>Shortcut</span>
        <strong>Command Shift K</strong>
      </section>

      <section className="popup-list" aria-label="Burst status">
        <div className="popup-row">
          <span>Registry</span>
          <strong>Coming soon</strong>
        </div>
        <div className="popup-row">
          <span>Audited</span>
          <strong>Pending</strong>
        </div>
        <div className="popup-row">
          <span>Account</span>
          <strong>Signed out</strong>
        </div>
      </section>

      <footer className="popup-actions">
        <span
          className="popup-action-popover"
          onMouseEnter={() => setShowRegistryNotice(true)}
          onMouseLeave={() => setShowRegistryNotice(false)}
          onFocus={() => setShowRegistryNotice(true)}
          onBlur={() => setShowRegistryNotice(false)}
        >
          <button
            type="button"
            aria-describedby={showRegistryNotice ? 'registry-coming-soon' : undefined}
            data-disabled="true"
            onClick={() => setShowRegistryNotice(true)}
          >
            Registry
          </button>
          {showRegistryNotice ? (
            <span id="registry-coming-soon" className="coming-soon-popover" role="status">
              Coming soon
            </span>
          ) : null}
        </span>
        <button type="button" onClick={openOptionsPage}>Options</button>
      </footer>
    </main>
  );
}

export default App;
