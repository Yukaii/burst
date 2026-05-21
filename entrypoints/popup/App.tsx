import { useEffect, useState } from 'react';
import logoUrl from '@/assets/logo.svg';
import { loadLocalScripts } from '@/src/lib/localScripts';
import { getCurrentUser } from '@/src/lib/registryApi';
import { loadSettings } from '@/src/lib/settings';
import './App.css';

const GIT_REGISTRIES_STORAGE_KEY = 'burst.gitRegistries.v1';

async function getGitRegistriesCount(): Promise<number> {
  const extensionStorage = typeof browser !== 'undefined' && browser.storage?.local;
  if (extensionStorage) {
    const result = await extensionStorage.get(GIT_REGISTRIES_STORAGE_KEY);
    const list = result[GIT_REGISTRIES_STORAGE_KEY];
    return Array.isArray(list) ? list.length : 0;
  }
  const raw = localStorage.getItem(GIT_REGISTRIES_STORAGE_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function App() {
  const [username, setUsername] = useState<string>('Guest');
  const [activeScriptsCount, setActiveScriptsCount] = useState<number>(0);
  const [gitCount, setGitCount] = useState<number>(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [hasUserScriptsPermission, setHasUserScriptsPermission] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        const hasWxt = typeof browser !== 'undefined' && !!browser.userScripts;
        const hasChrome = typeof chrome !== 'undefined' && !!chrome.userScripts;
        setHasUserScriptsPermission(hasWxt || hasChrome);

        const local = await loadLocalScripts();
        const enabled = local.filter((s) => s.status === 'enabled').length;
        setActiveScriptsCount(enabled);

        const git = await getGitRegistriesCount();
        setGitCount(git);

        const user = await getCurrentUser();
        if (user) {
          setUsername(user.name);
        } else {
          setUsername('Guest');
        }

        const settings = await loadSettings();
        const activeTheme = settings.theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
          : settings.theme;
        setTheme(activeTheme);
      } catch (e) {
        console.error('Failed to load popup status:', e);
      }
    }
    void loadData();
  }, []);

  function openOptionsPage() {
    if (typeof browser === 'undefined' || !browser.runtime?.openOptionsPage) {
      window.location.href = '/options.html';
      return;
    }
    void browser.runtime.openOptionsPage();
  }

  function openRegistryPage() {
    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      void browser.tabs.create({ url: 'http://localhost:5174' });
      return;
    }
    window.open('http://localhost:5174', '_blank');
  }

  return (
    <main className={`popup-shell theme-${theme}`}>
      <header className="popup-header">
        <img className="brand-mark" src={logoUrl} alt="Burst Logo" style={{ background: 'transparent' }} />
        <div>
          <h1>Burst</h1>
          <p>Command palette companion</p>
        </div>
      </header>

      <section className="popup-search" aria-label="Shortcut">
        <span>Launcher Shortcut</span>
        <div className="popup-shortcut-wrapper">
          <kbd>⌥</kbd>
          <kbd>⇧</kbd>
          <kbd>K</kbd>
        </div>
      </section>

      {!hasUserScriptsPermission && (
        <section className="popup-warning" aria-label="Permission alert">
          <div className="popup-warning-content">
            <span className="warning-icon">⚠️</span>
            <div>
              <h3>User Scripts Disabled</h3>
              <p>Setup action required to run automations.</p>
            </div>
          </div>
          <button type="button" className="btn-warning-action-sm" onClick={openOptionsPage}>
            Fix Setup
          </button>
        </section>
      )}

      <section className="popup-list" aria-label="Burst status">
        <div className="popup-row">
          <span>Active Scripts</span>
          <strong>{activeScriptsCount} script{activeScriptsCount === 1 ? '' : 's'}</strong>
        </div>
        <div className="popup-row">
          <span>Git Registries</span>
          <strong>{gitCount} registry{gitCount === 1 ? '' : 'ies'}</strong>
        </div>
        <div className="popup-row">
          <span>Registry Publisher</span>
          <strong>{username}</strong>
        </div>
      </section>

      <footer className="popup-actions">
        <button type="button" className="btn-secondary" onClick={openRegistryPage}>
          Marketplace
        </button>
        <button type="button" className="btn-primary" onClick={openOptionsPage}>
          Options
        </button>
      </footer>
    </main>
  );
}

export default App;
