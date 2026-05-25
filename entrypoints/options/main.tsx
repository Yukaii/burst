import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import logoUrl from '@/assets/logo.svg';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { ExtensionSettings, getRegistryServerBaseUrl, loadSettings, saveSettings } from '@/src/lib/settings';
import {
  commandPaletteThemeMetadata,
  commandPaletteThemeOptions,
  getCommandPaletteThemeMeta,
  loadCommandPaletteTheme,
  type CommandPaletteTheme,
} from '@/src/lib/paletteThemes';
import { clearConsentGrants } from '@/src/lib/registryStorage';
import './style.css';

const THEME_OPTIONS: Array<{
  value: ExtensionSettings['theme'];
  label: string;
}> = [
  { value: 'dark', label: 'Dark Theme' },
  { value: 'light', label: 'Light Theme' },
  { value: 'system', label: 'System Theme' },
];

const POSITION_OPTIONS: Array<{
  value: ExtensionSettings['position'];
  label: string;
}> = [
  { value: 'top', label: 'Top (Fixed 14vh)' },
  { value: 'center', label: 'Centered (Middle of Page)' },
];

const REGISTRY_SERVER_OPTIONS: Array<{
  value: ExtensionSettings['registryServer'];
  label: string;
}> = [
  { value: 'local', label: 'Local Dev (localhost:5174)' },
  { value: 'production', label: 'Production Registry' },
  { value: 'custom', label: 'Custom Server' },
];

const AI_PROVIDER_OPTIONS: Array<{
  value: NonNullable<ExtensionSettings['aiGenerationProvider']>;
  label: string;
}> = [
  { value: 'registry-fallback', label: 'Browser AI, then registry fallback' },
  { value: 'browser', label: 'Browser built-in AI only' },
  { value: 'registry', label: 'Registry hosted AI only' },
];

function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [previewTheme, setPreviewTheme] = useState<CommandPaletteTheme | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'info'>('info');

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hasUserScriptsPermission, setHasUserScriptsPermission] = useState<boolean>(true);

  const checkUserScriptsPermission = useCallback(() => {
    const hasWxt = typeof browser !== 'undefined' && !!browser.userScripts;
    const hasChrome = typeof window !== 'undefined' && 'chrome' in window && !!(window as any).chrome?.userScripts;
    const hasPermission = hasWxt || hasChrome;
    setHasUserScriptsPermission(hasPermission);
    return hasPermission;
  }, []);

  useEffect(() => {
    function refreshPermissionState() {
      const hasPermission = checkUserScriptsPermission();
      const shouldReloadAfterReturn = window.sessionStorage.getItem('burst-user-scripts-settings-opened') === 'true';

      if (!hasPermission && shouldReloadAfterReturn && document.visibilityState === 'visible') {
        window.sessionStorage.removeItem('burst-user-scripts-settings-opened');
        window.location.reload();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshPermissionState();
      }
    }

    refreshPermissionState();
    window.addEventListener('focus', refreshPermissionState);
    window.addEventListener('pageshow', refreshPermissionState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshPermissionState);
      window.removeEventListener('pageshow', refreshPermissionState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkUserScriptsPermission]);

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

  useEffect(() => {
    if (!settings) return;
    let active = true;
    void loadCommandPaletteTheme(settings.commandPaletteTheme).then((theme) => {
      if (active) setPreviewTheme(theme);
    });
    return () => {
      active = false;
    };
  }, [settings?.commandPaletteTheme]);

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

  async function updateRegistryServer(value: ExtensionSettings['registryServer']) {
    if (!settings) return;
    const next = {
      ...settings,
      registryServer: value,
      registryServerUrl: value === 'production'
        ? 'https://burst-registry.pages.dev'
        : value === 'local'
        ? 'http://localhost:5174'
        : settings.registryServerUrl || 'http://localhost:5174',
    };
    setSettings(next);
    await saveSettings(next);
    showFeedback('Registry server saved successfully', 'success');
  }

  const selectedPaletteTheme = getCommandPaletteThemeMeta(settings.commandPaletteTheme);
  const activePreviewTheme = previewTheme?.id === selectedPaletteTheme.id ? previewTheme : null;
  const selectedThemePath = selectedPaletteTheme.modulePath;
  const registryThemeContributionUrl = `${getRegistryServerBaseUrl(settings)}/#/settings`;

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

  async function handleOpenExtensionSettings() {
    window.sessionStorage.setItem('burst-user-scripts-settings-opened', 'true');

    const permissionApi = typeof browser !== 'undefined' ? browser.permissions : undefined;
    if (permissionApi?.request) {
      try {
        const granted = await permissionApi.request({ permissions: ['userScripts'] });
        if (granted) {
          const hasPermission = checkUserScriptsPermission();
          await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => undefined);
          showFeedback(hasPermission ? 'User Scripts permission enabled.' : 'Permission granted. Reload Burst if scripts do not start immediately.', 'success');
          return;
        }
      } catch {
        // Chrome exposes userScripts as an install-time permission, so fall through to its settings page.
      }
    }

    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      void browser.tabs.create({ url: 'chrome://extensions/?id=' + browser.runtime.id });
    }
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
                  Burst requires the browser User Scripts permission. Firefox asks for this as an optional permission; Chrome requires the extension details toggle.
                </p>
              </div>
            </div>
            <div className="warning-instructions">
              <div className="instruction-step">
                <h3>Firefox</h3>
                <p>Click the button below and approve the User Scripts permission prompt.</p>
              </div>
              <div className="instruction-step">
                <h3>Chrome / Chromium</h3>
                <p>Open extension settings, then switch "Allow user scripts" to ON. Older versions may require Developer mode.</p>
              </div>
            </div>
            <div className="warning-actions">
              <button
                type="button"
                onClick={handleOpenExtensionSettings}
                className="btn-warning-action"
              >
                Enable User Scripts
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
              <Select
                value={settings.theme}
                onValueChange={(value) => updateSetting('theme', value as ExtensionSettings['theme'])}
              >
                <SelectTrigger className="w-full sm:w-[220px]" aria-label="Appearance theme">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {THEME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="setting-card palette-theme-card">
            <div className="setting-info">
              <h2>Command Palette Theme</h2>
              <p>Choose the registered palette look. Auto uses website matches first, then the default appearance theme.</p>
            </div>
            <div className="setting-control palette-theme-control">
              <Select
                value={settings.commandPaletteTheme}
                onValueChange={(value) => updateSetting('commandPaletteTheme', value as ExtensionSettings['commandPaletteTheme'])}
              >
                <SelectTrigger className="w-full sm:w-[220px]" aria-label="Command palette theme">
                  <SelectValue placeholder="Select palette theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {commandPaletteThemeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div
                className="palette-preview"
                style={(activePreviewTheme?.variables ?? {}) as React.CSSProperties}
                aria-label={`${selectedPaletteTheme.name} preview`}
              >
                <div className="palette-preview-shell">
                  <div className="palette-preview-search">
                    <span>{selectedPaletteTheme.previewUrl.replace(/^https?:\/\//, '')}</span>
                    <strong>Search commands</strong>
                  </div>
                  <div className="palette-preview-command active">
                    <span>⌘</span>
                    <div>
                      <strong>{selectedPaletteTheme.name}</strong>
                      <small>{selectedPaletteTheme.description}</small>
                    </div>
                  </div>
                  <div className="palette-preview-command">
                    <span>↵</span>
                    <div>
                      <strong>Open command</strong>
                      <small>{selectedPaletteTheme.matchHosts?.join(', ') ?? 'Default fallback'}</small>
                    </div>
                  </div>
                </div>
              </div>
              <p className="palette-registry-note">
                Registry: {commandPaletteThemeMetadata.length} contributed themes are available for matching and preview.
                Add a file like <code>src/themes/notion.ts</code>, set <code>matchHosts</code>, then register it in <code>src/lib/paletteThemes.ts</code>.
                Current config: <code>{selectedThemePath}</code>
              </p>
              <div className="palette-contribution-links" aria-label="Theme contribution links">
                <a href={registryThemeContributionUrl} target="_blank" rel="noreferrer">
                  Open Registry
                </a>
                <a href="https://github.com/Yukaii/burst/tree/main/src/themes" target="_blank" rel="noreferrer">
                  GitHub Themes
                </a>
              </div>
            </div>
          </div>

          {/* Position Settings */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Palette Alignment</h2>
              <p>Choose where the command palette overlay positions itself on screen.</p>
            </div>
            <div className="setting-control">
              <Select
                value={settings.position}
                onValueChange={(value) => updateSetting('position', value as ExtensionSettings['position'])}
              >
                <SelectTrigger className="w-full sm:w-[220px]" aria-label="Palette alignment">
                  <SelectValue placeholder="Select alignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {POSITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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

          {/* Registry server */}
          <div className="setting-card">
            <div className="setting-info">
              <h2>Registry Server</h2>
              <p>Choose which registry API the extension uses for store search, install, and update checks.</p>
            </div>
            <div className="setting-control registry-server-control">
              <Select
                value={settings.registryServer}
                onValueChange={(value) => updateRegistryServer(value as ExtensionSettings['registryServer'])}
              >
                <SelectTrigger className="w-full sm:w-[240px]" aria-label="Registry server">
                  <SelectValue placeholder="Select registry server" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {REGISTRY_SERVER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <input
                className="registry-url-input"
                type="url"
                value={settings.registryServerUrl}
                disabled={settings.registryServer !== 'custom'}
                placeholder="http://localhost:5174"
                onChange={(event) => updateSetting('registryServerUrl', event.target.value)}
                aria-label="Custom registry server URL"
              />
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-info">
              <h2>AI Script Generation</h2>
              <p>Choose how the dashboard assistant generates local command scripts. Registry fallback requires a token from the registry Settings page.</p>
            </div>
            <div className="setting-control registry-server-control">
              <Select
                value={settings.aiGenerationProvider || 'registry-fallback'}
                onValueChange={(value) => updateSetting('aiGenerationProvider', value as ExtensionSettings['aiGenerationProvider'])}
              >
                <SelectTrigger className="w-full sm:w-[260px]" aria-label="AI generation provider">
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AI_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <input
                className="registry-url-input"
                type="password"
                value={settings.registryApiToken || ''}
                placeholder="burst_..."
                onChange={(event) => updateSetting('registryApiToken', event.target.value)}
                aria-label="Registry API token"
              />
              <a className="btn-link" href={`${getRegistryServerBaseUrl(settings)}/#/settings`} target="_blank" rel="noreferrer">
                Generate Registry Token
              </a>
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

const optionsRootEl = document.getElementById('root');

if (!optionsRootEl) {
  throw new Error('Root element not found');
}

const optionsWindow = window as Window & {
  __burstOptionsRoot?: ReturnType<typeof ReactDOM.createRoot>;
};

const optionsRoot = optionsWindow.__burstOptionsRoot ?? ReactDOM.createRoot(optionsRootEl);
optionsWindow.__burstOptionsRoot = optionsRoot;
optionsRoot.render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
