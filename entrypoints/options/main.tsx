import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import logoUrl from '@/assets/logo.svg';
import { ExtensionSettings, loadSettings, saveSettings } from '@/src/lib/settings';
import { clearConsentGrants } from '@/src/lib/registryStorage';
import './style.css';

function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'info'>('info');

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hasUserScriptsPermission, setHasUserScriptsPermission] = useState<boolean>(true);

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
    async function init() {
      const loaded = await loadSettings();
      setSettings(loaded);
    }
    void init();
  }, []);

  useEffect(() => {
    if (!settings) return;

    function applyTheme() {
      if (!settings) return;
      const activeTheme = settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : settings.theme;
      
      document.documentElement.className = `theme-${activeTheme}`;
    }

    applyTheme();

    if (settings.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [settings?.theme]);

  if (!settings) {
    return (
      <div className="options-loading">
        <p>Loading settings...</p>
      </div>
    );
  }

  async function updateSetting<K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings(next);
    showFeedback('Settings saved successfully', 'success');
  }

  function showFeedback(msg: string, type: 'success' | 'info' = 'info') {
    setStatusMessage(msg);
    setStatusType(type);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatusMessage(null), 3000);
  }

  async function handleClearConsent() {
    await clearConsentGrants();
    showFeedback('Cleared all security permission grants', 'success');
  }

  return (
    <main className="options-shell">
      <section className="options-panel">
        <div className="brand-header">
          <img src={logoUrl} alt="Burst Logo" className="brand-logo" />
          <div>
            <h1>Burst Settings</h1>
            <p>Customize the behavior and appearance of the command palette.</p>
          </div>
        </div>

        {statusMessage && (
          <div className={`status-banner type-${statusType}`}>
            <span className="status-icon">{statusType === 'success' ? '✓' : 'ℹ'}</span>
            <p>{statusMessage}</p>
          </div>
        )}

        {!hasUserScriptsPermission && (
          <div className="warning-card">
            <div className="warning-header">
              <span className="warning-badge-icon">⚠️</span>
              <div>
                <h2>Action Required: Enable User Scripts Permission</h2>
                <p>
                  Burst requires Chrome's Manifest V3 User Scripts developer feature to be enabled. Without this, custom user scripts and keybind triggers cannot run.
                </p>
              </div>
            </div>
            <div className="warning-instructions">
              <div className="instruction-step">
                <h3>Option 1: Chrome 138+ (Recommended)</h3>
                <p>Click "Open Extension Settings" below, scroll down, and switch "Allow user scripts" to ON.</p>
              </div>
              <div className="instruction-step">
                <h3>Option 2: Older Chrome</h3>
                <p>Open <code>chrome://extensions</code> and switch "Developer mode" in the top right to ON.</p>
              </div>
            </div>
            <div className="warning-actions">
              <button
                type="button"
                onClick={() => {
                  if (typeof browser !== 'undefined' && browser.tabs?.create) {
                    void browser.tabs.create({ url: 'chrome://extensions/?id=' + browser.runtime.id });
                  }
                }}
                className="btn-warning-action"
              >
                Open Extension Settings
              </button>
              <span className="auto-detect-hint">Will auto-detect on return</span>
            </div>
          </div>
        )}

        <div className="settings-container">
          {/* Theme Settings */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Appearance Theme</h2>
              <p>Set the color scheme for the command palette overlay.</p>
            </div>
            <div className="setting-control">
              <select
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value as any)}
                className="select-control"
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
                <option value="system">System Theme</option>
              </select>
            </div>
          </div>

          {/* Position Settings */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Palette Alignment</h2>
              <p>Choose where the command palette overlay positions itself on screen.</p>
            </div>
            <div className="setting-control">
              <select
                value={settings.position}
                onChange={(e) => updateSetting('position', e.target.value as any)}
                className="select-control"
              >
                <option value="top">Top (Fixed 14vh)</option>
                <option value="center">Centered (Middle of Page)</option>
              </select>
            </div>
          </div>

          {/* Backdrop Dismiss Settings */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Click Backdrop to Close</h2>
              <p>Dismiss the palette instantly by clicking outside the search panel overlay.</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch" htmlFor="backdrop-toggle">
                <input
                  id="backdrop-toggle"
                  type="checkbox"
                  checked={settings.backdropClickClose}
                  onChange={(e) => updateSetting('backdropClickClose', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Logging Settings */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Developer Logging</h2>
              <p>Print real-time script start and completion parameters to the browser console.</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch" htmlFor="logging-toggle">
                <input
                  id="logging-toggle"
                  type="checkbox"
                  checked={settings.showConsoleLogs}
                  onChange={(e) => updateSetting('showConsoleLogs', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Keyboard Shortcuts Notice */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Keyboard Shortcuts</h2>
              <p>
                Burst uses Chrome's native command shortcuts. Customize the global activation key combination inside browser settings.
              </p>
            </div>
            <div className="setting-control">
              <button
                onClick={() => {
                  if (typeof browser !== 'undefined' && browser.tabs?.create) {
                    void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
                  } else {
                    window.open('chrome://extensions/shortcuts', '_blank');
                  }
                }}
                type="button"
                className="btn-link"
              >
                Configure Keybinds
              </button>
            </div>
          </div>

          {/* Clear permission grants */}
          <div className="setting-card danger-card">
            <div className="setting-info">
              <h2>Reset Permission Consent</h2>
              <p>Revoke all security consent grants for registry scripts. Subsequent launches will re-prompt verification.</p>
            </div>
            <div className="setting-control">
              <button onClick={handleClearConsent} type="button" className="btn-danger">
                Clear Grants
              </button>
            </div>
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
