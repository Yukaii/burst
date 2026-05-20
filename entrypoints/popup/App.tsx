import { seedCommands } from '@/src/lib/commands';
import './App.css';

const auditedCount = seedCommands.filter((command) =>
  command.trustLevel === 'verified' || command.trustLevel === 'reviewed',
).length;

function App() {
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
          <strong>{seedCommands.length} commands</strong>
        </div>
        <div className="popup-row">
          <span>Audited</span>
          <strong>{auditedCount}</strong>
        </div>
        <div className="popup-row">
          <span>Account</span>
          <strong>Signed out</strong>
        </div>
      </section>

      <footer className="popup-actions">
        <button type="button">Open registry</button>
        <button type="button">Options</button>
      </footer>
    </main>
  );
}

export default App;
