import { seedCommands } from '@/src/lib/commands';
import './App.css';

const reviewedCount = seedCommands.filter((command) =>
  ['verified', 'reviewed'].includes(command.trustLevel),
).length;

const pinnedCount = seedCommands.filter((command) => command.pinned).length;

function App() {
  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand-mark">B</div>
        <div>
          <h1>Burst</h1>
          <p>Commands for every webpage</p>
        </div>
      </header>

      <section className="signin-panel">
        <div>
          <span>Signed out</span>
          <h2>Publish and sync commands with a Burst account.</h2>
        </div>
        <button type="button">Sign in</button>
      </section>

      <section className="stats-grid" aria-label="Registry stats">
        <div>
          <strong>{seedCommands.length}</strong>
          <span>Seed commands</span>
        </div>
        <div>
          <strong>{reviewedCount}</strong>
          <span>Audited</span>
        </div>
        <div>
          <strong>{pinnedCount}</strong>
          <span>Pinned</span>
        </div>
      </section>

      <section className="registry-panel">
        <div className="section-heading">
          <h2>Registry posture</h2>
          <span>Local preview</span>
        </div>
        <ul>
          <li>
            <strong>Discovery first</strong>
            <span>Commands are filtered by current website and query.</span>
          </li>
          <li>
            <strong>Review before trust</strong>
            <span>Every command shows source, publisher, risk, and permissions.</span>
          </li>
          <li>
            <strong>User-owned execution</strong>
            <span>Publishing and command runtime are explicit future contracts.</span>
          </li>
        </ul>
      </section>

      <footer className="popup-actions">
        <button type="button">Open registry</button>
        <button type="button">Publish use case</button>
      </footer>
    </main>
  );
}

export default App;
