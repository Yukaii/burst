export type ExtensionSettings = {
  theme: 'dark' | 'light' | 'system';
  position: 'top' | 'center';
  backdropClickClose: boolean;
  showConsoleLogs: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: 'dark',
  position: 'top',
  backdropClickClose: true,
  showConsoleLogs: false,
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
