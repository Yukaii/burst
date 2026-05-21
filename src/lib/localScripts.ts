import type { BurstCommand, CommandIcon } from './commands';

const LOCAL_SCRIPT_STORAGE_KEY = 'burst.localScripts.v1';

type LocalStorageArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
};

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

let memoryScripts: LocalScript[] = [];

export type LocalScriptStatus = 'enabled' | 'disabled' | 'draft';

export type LocalScript = {
  id: string;
  name: string;
  matchPattern: string;
  icon: CommandIcon;
  status: LocalScriptStatus;
  updatedAt: string;
  code: string;
};

export const seedLocalScripts: LocalScript[] = [
  {
    id: 'local-github-copy-branch',
    name: 'Copy GitHub branch name',
    matchPattern: 'github.com/*',
    icon: { type: 'favicon', host: 'github.com' },
    status: 'enabled',
    updatedAt: '2026-05-20',
    code: `export default async function run({ page }) {
  const branch = page.querySelector('[data-hotkey="w"]')?.textContent?.trim();
  await navigator.clipboard.writeText(branch ?? location.href);
}`,
  },
  {
    id: 'local-highlight-capture',
    name: 'Capture selection',
    matchPattern: '<all_urls>',
    icon: { type: 'initials', value: 'CS' },
    status: 'draft',
    updatedAt: '2026-05-20',
    code: `export default async function run() {
  const selection = window.getSelection()?.toString() ?? '';
  console.log({ selection, url: location.href });
}`,
  },
];

export function createLocalScriptDraft(): LocalScript {
  return {
    id: `local-${Date.now()}`,
    name: 'Untitled local command',
    matchPattern: '<all_urls>',
    icon: { type: 'initials', value: 'UL' },
    status: 'draft',
    updatedAt: getTodayDate(),
    code: `export default async function run() {\n  // Write a local command here.\n}`,
  };
}

export async function loadLocalScripts(): Promise<LocalScript[]> {
  const storedScripts = await readStoredScripts();
  if (storedScripts.length > 0) return storedScripts;

  await saveLocalScripts(seedLocalScripts);
  return seedLocalScripts;
}

export async function getLocalScript(id: string): Promise<LocalScript | undefined> {
  const scripts = await loadLocalScripts();
  return scripts.find((script) => script.id === id);
}

export async function saveLocalScripts(scripts: LocalScript[]): Promise<void> {
  const nextScripts = scripts.map(normalizeLocalScript);
  const extensionStorage = getExtensionStorage();

  if (extensionStorage) {
    await extensionStorage.set({ [LOCAL_SCRIPT_STORAGE_KEY]: nextScripts });
    return;
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(LOCAL_SCRIPT_STORAGE_KEY, JSON.stringify(nextScripts));
    return;
  }

  memoryScripts = nextScripts;
}

export function prepareLocalScriptForSave(script: LocalScript): LocalScript {
  return normalizeLocalScript({
    ...script,
    updatedAt: getTodayDate(),
  });
}

export function localScriptToCommand(script: LocalScript): BurstCommand {
  return {
    id: `local-script:${script.id}`,
    title: script.name,
    description: 'Local dashboard script stored in this browser.',
    website: script.matchPattern === '<all_urls>' ? 'all sites' : script.matchPattern.replace(/\/\*$/, ''),
    matchPatterns: [script.matchPattern],
    publisher: {
      name: 'Local',
      handle: '@local',
      avatarInitials: 'L',
    },
    trustLevel: 'local',
    risk: 'medium',
    permissions: ['Page runtime after install'],
    sourceUrl: `burst://local-script/${script.id}`,
    installs: 0,
    rating: 0,
    icon: script.icon,
    pinned: true,
    action: 'run-local-script',
    localScriptId: script.id,
  };
}

async function readStoredScripts(): Promise<LocalScript[]> {
  const extensionStorage = getExtensionStorage();

  if (extensionStorage) {
    const result = await extensionStorage.get(LOCAL_SCRIPT_STORAGE_KEY);
    return parseLocalScripts(result[LOCAL_SCRIPT_STORAGE_KEY]);
  }

  const webStorage = getWebStorage();
  if (!webStorage) return memoryScripts;

  const rawValue = webStorage.getItem(LOCAL_SCRIPT_STORAGE_KEY);
  if (!rawValue) return [];

  try {
    return parseLocalScripts(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

function parseLocalScripts(value: unknown): LocalScript[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isLocalScript).map(normalizeLocalScript);
}

function normalizeLocalScript(script: LocalScript): LocalScript {
  return {
    ...script,
    name: script.name.trim() || 'Untitled local command',
    matchPattern: script.matchPattern.trim() || '<all_urls>',
    status: script.status,
    icon: normalizeIcon(script.icon),
  };
}

function normalizeIcon(icon: CommandIcon): CommandIcon {
  if (icon.type === 'favicon') return { type: 'favicon', host: icon.host?.trim() || undefined };
  if (icon.type === 'url' || icon.type === 'asset') return { type: icon.type, src: icon.src.trim() };
  return { type: icon.type, value: icon.value.trim() || 'B' };
}

function isLocalScript(value: unknown): value is LocalScript {
  if (typeof value !== 'object' || value === null) return false;

  const script = value as Partial<LocalScript>;
  return typeof script.id === 'string'
    && typeof script.name === 'string'
    && typeof script.matchPattern === 'string'
    && typeof script.updatedAt === 'string'
    && typeof script.code === 'string'
    && isLocalScriptStatus(script.status)
    && isCommandIcon(script.icon);
}

function isLocalScriptStatus(value: unknown): value is LocalScriptStatus {
  return value === 'enabled' || value === 'disabled' || value === 'draft';
}

function isCommandIcon(value: unknown): value is CommandIcon {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;

  const icon = value as Partial<CommandIcon>;
  if (icon.type === 'favicon') return !('host' in icon) || typeof icon.host === 'string';
  if (icon.type === 'url' || icon.type === 'asset') return typeof icon.src === 'string';
  if (icon.type === 'initials' || icon.type === 'emoji') return typeof icon.value === 'string';
  return false;
}

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

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
