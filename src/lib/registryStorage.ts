import type { BurstCommand } from './commands';
import { createSandboxedUserScriptCode } from './localScripts';

const INSTALLED_COMMANDS_KEY = 'burst.installedRegistryCommands.v1';
const PINNED_COMMANDS_KEY = 'burst.pinnedRegistryCommands.v1';
const CONSENT_GRANTS_KEY = 'burst.consentGrants.v1';

type LocalStorageArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
};

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

let memoryInstalled: BurstCommand[] = [];
let memoryPinned: string[] = [];
let memoryGrants: string[] = [];

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

export async function loadInstalledRegistryCommands(): Promise<BurstCommand[]> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    const result = await extensionStorage.get(INSTALLED_COMMANDS_KEY);
    const val = result[INSTALLED_COMMANDS_KEY];
    return Array.isArray(val) ? (val as BurstCommand[]) : [];
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    const val = webStorage.getItem(INSTALLED_COMMANDS_KEY);
    if (val) {
      try {
        return JSON.parse(val) as BurstCommand[];
      } catch {
        return [];
      }
    }
  }

  return memoryInstalled;
}

export async function saveInstalledRegistryCommands(commands: BurstCommand[]): Promise<void> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    await extensionStorage.set({ [INSTALLED_COMMANDS_KEY]: commands });
    return;
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(INSTALLED_COMMANDS_KEY, JSON.stringify(commands));
    return;
  }

  memoryInstalled = commands;
}

export async function loadPinnedRegistryCommandIds(): Promise<string[]> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    const result = await extensionStorage.get(PINNED_COMMANDS_KEY);
    const val = result[PINNED_COMMANDS_KEY];
    return Array.isArray(val) ? (val as string[]) : [];
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    const val = webStorage.getItem(PINNED_COMMANDS_KEY);
    if (val) {
      try {
        return JSON.parse(val) as string[];
      } catch {
        return [];
      }
    }
  }

  return memoryPinned;
}

export async function savePinnedRegistryCommandIds(ids: string[]): Promise<void> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    await extensionStorage.set({ [PINNED_COMMANDS_KEY]: ids });
    return;
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(PINNED_COMMANDS_KEY, JSON.stringify(ids));
    return;
  }

  memoryPinned = ids;
}

export async function loadConsentGrants(): Promise<string[]> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    const result = await extensionStorage.get(CONSENT_GRANTS_KEY);
    const val = result[CONSENT_GRANTS_KEY];
    return Array.isArray(val) ? (val as string[]) : [];
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    const val = webStorage.getItem(CONSENT_GRANTS_KEY);
    if (val) {
      try {
        return JSON.parse(val) as string[];
      } catch {
        return [];
      }
    }
  }

  return memoryGrants;
}

export async function saveConsentGrant(commandId: string): Promise<void> {
  const grants = await loadConsentGrants();
  if (!grants.includes(commandId)) {
    grants.push(commandId);
    
    const extensionStorage = getExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.set({ [CONSENT_GRANTS_KEY]: grants });
      return;
    }

    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(CONSENT_GRANTS_KEY, JSON.stringify(grants));
      return;
    }

    memoryGrants = grants;
  }
}

export async function installRegistryCommand(command: BurstCommand): Promise<void> {
  const installed = await loadInstalledRegistryCommands();
  const existingIndex = installed.findIndex((c) => c.id === command.id);
  if (existingIndex >= 0) {
    installed[existingIndex] = {
      ...installed[existingIndex],
      ...command,
    };
  } else {
    installed.push(command);
  }
  await saveInstalledRegistryCommands(installed);
}

export async function uninstallRegistryCommand(commandId: string): Promise<void> {
  const installed = await loadInstalledRegistryCommands();
  const nextInstalled = installed.filter((c) => c.id !== commandId);
  await saveInstalledRegistryCommands(nextInstalled);

  const pinned = await loadPinnedRegistryCommandIds();
  const nextPinned = pinned.filter((id) => id !== commandId);
  await savePinnedRegistryCommandIds(nextPinned);
}

export async function pinRegistryCommand(commandId: string): Promise<void> {
  const pinned = await loadPinnedRegistryCommandIds();
  if (!pinned.includes(commandId)) {
    pinned.push(commandId);
    await savePinnedRegistryCommandIds(pinned);
  }
}

export async function unpinRegistryCommand(commandId: string): Promise<void> {
  const pinned = await loadPinnedRegistryCommandIds();
  const nextPinned = pinned.filter((id) => id !== commandId);
  await savePinnedRegistryCommandIds(nextPinned);
}

export function getRegistryScriptRegistrationId(commandId: string): string {
  return `burst-registry-script-${commandId}`;
}

export function getRegistryScriptEventName(commandId: string): string {
  return `burst:run-registry-script:${commandId}`;
}

export function getRegistryScriptResultEventName(commandId: string): string {
  return `burst:registry-script-result:${commandId}`;
}

export function getRegistryScriptMatchPatterns(patterns: string[]): string[] {
  return patterns.map((pattern) => {
    const p = pattern.trim();
    if (p === '<all_urls>') return '<all_urls>';
    if (p.includes('://')) return p;
    if (!p.includes('/')) return `*://${p}/*`;
    return `*://${p}`;
  });
}

export function createRegistryUserScriptCode(commandId: string, code: string): string {
  const eventName = getRegistryScriptEventName(commandId);
  const resultEventName = getRegistryScriptResultEventName(commandId);
  return createSandboxedUserScriptCode(code, eventName, resultEventName);
}

export async function clearConsentGrants(): Promise<void> {
  const extensionStorage = getExtensionStorage();
  if (extensionStorage) {
    await extensionStorage.set({ [CONSENT_GRANTS_KEY]: [] });
    return;
  }

  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.setItem(CONSENT_GRANTS_KEY, JSON.stringify([]));
    return;
  }

  memoryGrants = [];
}
