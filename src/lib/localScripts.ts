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

export type LocalScriptBackup = {
  version: 1;
  exportedAt: string;
  scripts: LocalScript[];
};

export const seedLocalScripts: LocalScript[] = [
  {
    id: 'local-github-copy-branch',
    name: 'Copy GitHub branch name',
    matchPattern: 'github.com/*',
    icon: { type: 'favicon', host: 'github.com' },
    status: 'enabled',
    updatedAt: '2026-05-20',
    code: `export default async function run({ page, toast }) {
  const branch = page.querySelector('[data-icv-name="Switch branches/tags"]')?.textContent?.trim();
  await navigator.clipboard.writeText(branch ?? location.href);
  toast(branch ? \`Copied \${branch}\` : 'Copied page URL');
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
    code: `export default async function run({ toast }) {\n  toast('Command finished');\n}`,
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

export function createLocalScriptBackup(scripts: LocalScript[]): LocalScriptBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scripts: scripts.map(normalizeLocalScript),
  };
}

export function parseLocalScriptBackup(value: unknown): LocalScript[] {
  if (Array.isArray(value)) return parseLocalScripts(value);
  if (!isLocalScriptBackup(value)) return [];

  return parseLocalScripts(value.scripts);
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

export function getLocalScriptEventName(scriptId: string): string {
  return `burst:run-local-script:${scriptId}`;
}

export function getLocalScriptResultEventName(scriptId: string): string {
  return `burst:local-script-result:${scriptId}`;
}

export function getLocalScriptRegistrationId(scriptId: string): string {
  return `burst-local-script-${scriptId}`;
}

export function getLocalScriptMatchPatterns(script: LocalScript): string[] {
  const pattern = script.matchPattern.trim();
  if (pattern === '<all_urls>') return ['<all_urls>'];
  if (pattern.includes('://')) return [pattern];
  if (!pattern.includes('/')) return [`*://${pattern}/*`];
  return [`*://${pattern}`];
}

export function createLocalUserScriptCode(script: LocalScript): string {
  const functionSource = stripDefaultExport(script.code);
  const eventName = getLocalScriptEventName(script.id);
  const resultEventName = getLocalScriptResultEventName(script.id);

  return `(() => {
  const run = ${functionSource};
  document.addEventListener(${JSON.stringify(eventName)}, async () => {
    const emit = (detail) => document.dispatchEvent(new CustomEvent(${JSON.stringify(resultEventName)}, { detail }));
    try {
      emit({ status: 'started' });
      await run({
        page: document,
        window,
        location,
        navigator,
        selection: window.getSelection()?.toString() ?? '',
        url: location.href,
        title: document.title,
        toast: (message) => emit({ status: 'toast', message: String(message) })
      });
      emit({ status: 'complete' });
    } catch (error) {
      console.error('[Burst] Local script failed', error);
      emit({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  });
})();`;
}

export function stripDefaultExport(code: string): string {
  return code.replace(/^\s*export\s+default\s+/, '');
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

function isLocalScriptBackup(value: unknown): value is LocalScriptBackup {
  if (typeof value !== 'object' || value === null) return false;

  const backup = value as Partial<LocalScriptBackup>;
  return backup.version === 1 && Array.isArray(backup.scripts);
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

export function detectRequiredCapabilities(code: string): Array<'page-dom' | 'selection' | 'clipboard-write' | 'toast'> {
  const capabilities: Array<'page-dom' | 'selection' | 'clipboard-write' | 'toast'> = [];

  if (/page\b|document\b|querySelector|querySelectorAll|createElement/i.test(code)) {
    capabilities.push('page-dom');
  }
  if (/selection\b|getSelection/i.test(code)) {
    capabilities.push('selection');
  }
  if (/clipboard\b|writeText/i.test(code)) {
    capabilities.push('clipboard-write');
  }
  if (/toast\b/i.test(code)) {
    capabilities.push('toast');
  }

  return capabilities;
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
