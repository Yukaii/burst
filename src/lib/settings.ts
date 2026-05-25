export type ExtensionSettings = {
  theme: 'dark' | 'light' | 'system';
  commandPaletteTheme: import('./paletteThemes').CommandPaletteThemeId;
  position: 'top' | 'center';
  backdropClickClose: boolean;
  showConsoleLogs: boolean;
  registryServer: 'production' | 'local' | 'custom';
  registryServerUrl: string;
  editorFontFamily?: string;
  editorFontSize?: number;
  editorTheme?: string;
  editorKeymap?: 'default' | 'vim' | 'emacs';
  editorWordWrap?: boolean;
  aiGenerationProvider?: 'browser' | 'registry-fallback' | 'registry';
  registryApiToken?: string;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: 'dark',
  commandPaletteTheme: 'auto',
  position: 'top',
  backdropClickClose: true,
  showConsoleLogs: false,
  registryServer: 'local',
  registryServerUrl: 'http://localhost:5174',
  editorFontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  editorFontSize: 13,
  editorTheme: 'default',
  editorKeymap: 'default',
  editorWordWrap: true,
  aiGenerationProvider: 'registry-fallback',
  registryApiToken: '',
};

const SETTINGS_STORAGE_KEY = 'burst.settings.v1';

type LocalStorageArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
};

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getExtensionStorage(): LocalStorageArea | undefined {
  const runtime = globalThis as typeof globalThis & {
    browser?: {
      storage?: {
        local?: LocalStorageArea;
      };
    };
  };
  return runtime.browser?.storage?.local;
}

function getWebStorage(): WebStorage | undefined {
  const runtime = globalThis as typeof globalThis & {
    localStorage?: WebStorage;
  };
  return runtime.localStorage;
}

let memorySettings: ExtensionSettings | undefined = undefined;

export async function loadSettings(): Promise<ExtensionSettings> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    try {
      const result = await extensionStorage.get(SETTINGS_STORAGE_KEY);
      const val = result[SETTINGS_STORAGE_KEY];
      if (val && typeof val === 'object') {
        return { ...DEFAULT_SETTINGS, ...val };
      }
    } catch {
      // Fallback
    }
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    const val = webStorage.getItem(SETTINGS_STORAGE_KEY);
    if (val) {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      } catch {
        // Fallback
      }
    }
  }

  return memorySettings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    await extensionStorage.set({ [SETTINGS_STORAGE_KEY]: settings });
    return;
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return;
  }

  memorySettings = settings;
}

export function getRegistryServerBaseUrl(settings: Pick<ExtensionSettings, 'registryServer' | 'registryServerUrl'>): string {
  if (settings.registryServer === 'production') return 'https://burst-registry.pages.dev';
  if (settings.registryServer === 'custom') return normalizeRegistryServerUrl(settings.registryServerUrl);
  return 'http://localhost:5174';
}

function normalizeRegistryServerUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'http://localhost:5174';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'http://localhost:5174';
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:5174';
  }
}
