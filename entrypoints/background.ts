import {
  createLocalUserScriptCode,
  getLocalScriptMatchPatterns,
  getLocalScriptRegistrationId,
  loadLocalScripts,
  LocalScript,
} from '@/src/lib/localScripts';
import {
  loadInstalledRegistryCommands,
  loadPinnedRegistryCommandIds,
  installRegistryCommand,
  isRegistryCommandEnabled,
  uninstallRegistryCommand,
  pinRegistryCommand,
  unpinRegistryCommand,
  getRegistryScriptRegistrationId,
  getRegistryScriptMatchPatterns,
  createRegistryUserScriptCode,
} from '@/src/lib/registryStorage';
import { getMockScriptCode, getRegistryCommand, getRegistryCommandsPage } from '@/src/lib/registryApi';
import { getRegistryServerBaseUrl, loadSettings, type ExtensionSettings } from '@/src/lib/settings';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) return;
    const { type } = message as { type?: string };

    if (type === 'burst:sync-local-scripts') {
      const promise = registerEnabledLocalScripts();
      return promise;
    }

    if (type === 'burst:get-installed-commands') {
      const promise = (async () => {
        const installed = await loadInstalledRegistryCommands();
        const pinned = await loadPinnedRegistryCommandIds();
        return {
          installedIds: installed.map((c) => c.id),
          pinnedIds: pinned,
        };
      })();
      return promise;
    }

    if (type === 'burst:search-registry-commands') {
      const { query = '', host = '', offset = 0, limit = 20 } = message as { query?: string; host?: string; offset?: number; limit?: number };
      const promise = (async () => {
        const registryBaseUrl = await getConfiguredRegistryBaseUrl();
        const installed = await loadInstalledRegistryCommands();
        const installedIds = new Set(installed.map((command) => command.id));
        const page = await getRegistryCommandsPage(query, { baseOverride: registryBaseUrl, offset, limit, host });

        return {
          commands: page.commands,
          installedIds: [...installedIds],
          total: page.total,
          offset: page.offset,
          limit: page.limit,
          hasMore: page.hasMore,
          nextOffset: page.offset + page.commands.length,
        };
      })();
      return promise;
    }

    if (type === 'burst:install-command') {
      const { command } = message as { command: any };
      const promise = (async () => {
        const registryBaseUrl = await getConfiguredRegistryBaseUrl();
        const registryCommand = typeof command?.id === 'string'
          ? await getRegistryCommand(command.id, registryBaseUrl).catch(() => undefined)
          : undefined;
        await installRegistryCommand(registryCommand ?? command);
        await registerEnabledLocalScripts();
        const installed = await loadInstalledRegistryCommands();
        const pinned = await loadPinnedRegistryCommandIds();
        return {
          installedIds: installed.map((c) => c.id),
          pinnedIds: pinned,
        };
      })();
      return promise;
    }

    if (type === 'burst:install-registry-command') {
      const { commandId } = message as { commandId: string };
      const promise = (async () => {
        const registryBaseUrl = await getConfiguredRegistryBaseUrl();
        const command = await getRegistryCommand(commandId, registryBaseUrl);
        if (!command) {
          return {
            ok: false,
            message: 'Registry command was not found.',
            installedIds: (await loadInstalledRegistryCommands()).map((c) => c.id),
            pinnedIds: await loadPinnedRegistryCommandIds(),
          };
        }

        await installRegistryCommand(command);
        const syncResult = await registerEnabledLocalScripts();
        const installed = await loadInstalledRegistryCommands();
        const pinned = await loadPinnedRegistryCommandIds();
        return {
          ok: true,
          syncOk: syncResult.ok,
          message: syncResult.message,
          command,
          installedIds: installed.map((c) => c.id),
          pinnedIds: pinned,
        };
      })();
      return promise;
    }

    if (type === 'burst:uninstall-command') {
      const { commandId } = message as { commandId: string };
      const promise = (async () => {
        await uninstallRegistryCommand(commandId);
        await registerEnabledLocalScripts();
        const installed = await loadInstalledRegistryCommands();
        const pinned = await loadPinnedRegistryCommandIds();
        return {
          installedIds: installed.map((c) => c.id),
          pinnedIds: pinned,
        };
      })();
      return promise;
    }

    if (type === 'burst:pin-command') {
      const { commandId } = message as { commandId: string };
      const promise = (async () => {
        await pinRegistryCommand(commandId);
        const installed = await loadInstalledRegistryCommands();
        const pinned = await loadPinnedRegistryCommandIds();
        return {
          installedIds: installed.map((c) => c.id),
          pinnedIds: pinned,
        };
      })();
      return promise;
    }

    if (type === 'burst:unpin-command') {
      const { commandId } = message as { commandId: string };
      const promise = (async () => {
        await unpinRegistryCommand(commandId);
        const installed = await loadInstalledRegistryCommands();
        const pinned = await loadPinnedRegistryCommandIds();
        return {
          installedIds: installed.map((c) => c.id),
          pinnedIds: pinned,
        };
      })();
      return promise;
    }

    if (isManagementMessage(message)) {
      const path = message.action === 'create-local-script'
        ? '/dashboard.html?mode=new'
        : '/dashboard.html';

      void browser.tabs.create({ url: browser.runtime.getURL(path) });
      return;
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-palette') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    await browser.tabs.sendMessage(tab.id, { type: 'burst:toggle-palette' }).catch(() => {
      // Some browser pages cannot receive content-script messages.
    });
  });

  browser.runtime.onInstalled.addListener(() => {
    void registerEnabledLocalScripts();
  });

  browser.runtime.onStartup.addListener(() => {
    void registerEnabledLocalScripts();
  });

  void registerEnabledLocalScripts();
});

function isManagementMessage(
  message: unknown,
): message is { type: 'burst:run-management-command'; action: 'open-dashboard' | 'open-installed' | 'create-local-script' } {
  return typeof message === 'object'
    && message !== null
    && 'type' in message
    && message.type === 'burst:run-management-command'
    && 'action' in message
    && ['open-dashboard', 'open-installed', 'create-local-script'].includes(String(message.action));
}

type UserScriptsApi = {
  getScripts: () => Promise<Array<{ id?: string }>>;
  register: (scripts: UserScriptRegistration[]) => Promise<void>;
  unregister: (filter?: { ids?: string[] }) => Promise<void>;
};

type UserScriptRegistration = {
  id: string;
  matches: string[];
  js: Array<{ code: string }>;
  runAt: 'document_idle';
};

type LocalScriptRegistrationResult = {
  ok: boolean;
  count: number;
  message?: string;
};

async function registerEnabledLocalScripts() {
  const userScripts = getUserScriptsApi();
  if (!userScripts) {
    const message = 'Chrome userScripts API is unavailable. Enable the browser user scripts toggle, then reload the extension.';
    console.warn(`[Burst] ${message}`);
    return { ok: false, count: 0, message };
  }

  try {
    const existingScripts = await userScripts.getScripts();
    const existingIds = existingScripts
      .map((script) => script.id)
      .filter((id): id is string => Boolean(id?.startsWith('burst-local-script-') || id?.startsWith('burst-registry-script-')));

    if (existingIds.length > 0) {
      await userScripts.unregister({ ids: existingIds });
    }

    let count = 0;

    const scripts = await loadLocalScripts();
    const enabledScripts = scripts.filter((item) => item.status === 'enabled');
    for (const script of enabledScripts) {
      await registerLocalScript(userScripts, script);
      count++;
    }

    const registryCommands = (await loadInstalledRegistryCommands()).filter(isRegistryCommandEnabled);
    for (const command of registryCommands) {
      const code = command.code || getMockScriptCode(command.id);
      await userScripts.register([
        {
          id: getRegistryScriptRegistrationId(command.id),
          matches: getRegistryScriptMatchPatterns(command.matchPatterns),
          js: [{ code: createRegistryUserScriptCode(command.id, code) }],
          runAt: 'document_idle',
        },
      ]);
      count++;
    }

    return { ok: true, count } satisfies LocalScriptRegistrationResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register scripts.';
    console.error('[Burst] Failed to sync scripts', error);
    return { ok: false, count: 0, message } satisfies LocalScriptRegistrationResult;
  }
}


async function registerLocalScript(userScripts: UserScriptsApi, script: LocalScript) {
  try {
    await userScripts.register([
      {
        id: getLocalScriptRegistrationId(script.id),
        matches: getLocalScriptMatchPatterns(script),
        js: [{ code: createLocalUserScriptCode(script) }],
        runAt: 'document_idle',
      },
    ]);
  } catch (error) {
    console.error(`[Burst] Failed to register local script ${script.id}`, error);
  }
}

function getUserScriptsApi(): UserScriptsApi | undefined {
  const runtime = globalThis as typeof globalThis & {
    browser?: {
      userScripts?: UserScriptsApi;
    };
  };

  return runtime.browser?.userScripts;
}

async function getConfiguredRegistryBaseUrl(): Promise<string> {
  const settings = await loadSettings().catch((): ExtensionSettings | undefined => undefined);
  if (!settings) return 'http://localhost:5174';
  return getRegistryServerBaseUrl(settings);
}
