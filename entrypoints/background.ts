import {
  createLocalUserScriptCode,
  getLocalScriptMatchPatterns,
  getLocalScriptRegistrationId,
  loadLocalScripts,
  LocalScript,
} from '@/src/lib/localScripts';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isSyncLocalScriptsMessage(message)) {
      return registerEnabledLocalScripts();
    }

    if (!isManagementMessage(message)) return;

    const path = message.action === 'create-local-script'
      ? '/dashboard.html?mode=new'
      : '/dashboard.html';

    void browser.tabs.create({ url: browser.runtime.getURL(path) });
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

function isSyncLocalScriptsMessage(
  message: unknown,
): message is { type: 'burst:sync-local-scripts' } {
  return typeof message === 'object'
    && message !== null
    && 'type' in message
    && message.type === 'burst:sync-local-scripts';
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
      .filter((id): id is string => Boolean(id?.startsWith('burst-local-script-')));

    if (existingIds.length > 0) {
      await userScripts.unregister({ ids: existingIds });
    }

    const scripts = await loadLocalScripts();
    const enabledScripts = scripts.filter((item) => item.status === 'enabled');
    for (const script of enabledScripts) {
      await registerLocalScript(userScripts, script);
    }

    return { ok: true, count: enabledScripts.length } satisfies LocalScriptRegistrationResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register local scripts.';
    console.error('[Burst] Failed to sync local scripts', error);
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
