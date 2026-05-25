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
  matchPatterns: string[];
  icon: CommandIcon;
  status: LocalScriptStatus;
  updatedAt: string;
  code: string;
  originRegistryUrl?: string;
  originCommandId?: string;
  originRegistryKind?: 'official' | 'git';
  upstreamCodeAtFork?: string;
  version?: string;
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
    matchPatterns: ['github.com/*'],
    icon: { type: 'favicon', host: 'github.com' },
    status: 'enabled',
    updatedAt: '2026-05-20',
    code: `export default async function run({ page, toast }) {
  const branch = page.querySelector('[data-icv-name="Switch branches/tags"]')?.textContent?.trim();
  await navigator.clipboard.writeText(branch ?? location.href);
  toast(branch ? \`Copied \${branch}\` : 'Copied page URL');
}`,
    version: '1.0.0',
  },
  {
    id: 'local-highlight-capture',
    name: 'Capture selection',
    matchPatterns: ['<all_urls>'],
    icon: { type: 'initials', value: 'CS' },
    status: 'draft',
    updatedAt: '2026-05-20',
    code: `export default async function run() {
  const selection = window.getSelection()?.toString() ?? '';
  console.log({ selection, url: location.href });
}`,
    version: '1.0.0',
  },
  {
    id: 'local-list-page-links',
    name: 'List page links',
    matchPatterns: ['<all_urls>'],
    icon: { type: 'lucide', name: 'List' },
    status: 'draft',
    updatedAt: '2026-05-22',
    code: `export default async function run({ page, clipboard, toast, list }) {
  const links = page.querySelectorAll('a')
    .slice(0, 25)
    .map((link, index) => {
      const rawHref = link.getAttribute('href') || '';
      const href = new URL(rawHref, location.href).href;
      const title = link.innerText?.trim() || href;

      return {
        id: String(index),
        title,
        subtitle: href,
        accessories: [new URL(href).host],
        keywords: [href],
        actions: [
          {
            id: 'copy-url',
            title: 'Copy URL',
            async onAction() {
              await clipboard.writeText(href);
              toast({ title: 'Copied URL', message: title, variant: 'success' });
            },
          },
        ],
      };
    });

  list({
    id: 'page-links',
    title: 'Page links',
    searchPlaceholder: 'Search links',
    emptyState: 'No links found.',
    items: links,
  });
}`,
    version: '1.0.0',
  },
];

export function createLocalScriptDraft(): LocalScript {
  return {
    id: `local-${Date.now()}`,
    name: 'Untitled local command',
    matchPatterns: ['<all_urls>'],
    icon: { type: 'initials', value: 'UL' },
    status: 'draft',
    updatedAt: getTodayDate(),
    code: `export default async function run({ toast }) {\n  toast('Command finished');\n}`,
    version: '1.0.0',
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
  const matchPatterns = getLocalScriptMatchPatterns(script);
  return {
    id: `local-script:${script.id}`,
    title: script.name,
    description: 'Local dashboard script stored in this browser.',
    subtitle: 'Local script',
    website: matchPatterns.includes('<all_urls>')
      ? 'all sites'
      : matchPatterns.map((pattern) => pattern.replace(/^\*:\/\/|\/\*$/g, '')).join(', '),
    matchPatterns,
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
    code: script.code,
    version: script.version,
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
  const patterns = script.matchPatterns.map(normalizeLocalScriptMatchPattern);
  return patterns.length > 0 ? patterns : ['<all_urls>'];
}

function normalizeLocalScriptMatchPattern(pattern: string): string {
  if (pattern === '<all_urls>') return '<all_urls>';
  if (pattern.includes('://')) return pattern;
  if (!pattern.includes('/')) return `*://${pattern}/*`;
  return `*://${pattern}`;
}

export function createSandboxedUserScriptCode(code: string, eventName: string, resultEventName: string): string {
  const functionSource = stripDefaultExport(code);
  const capabilities = detectRequiredCapabilities(code);

  return `(() => {
  const capabilities = ${JSON.stringify(capabilities)};
  const hasCap = (c) => capabilities.includes(c);
  const listActionHandlers = new Map();

  document.addEventListener(${JSON.stringify(eventName)}, async (event) => {
    const emit = (detail) => document.dispatchEvent(new CustomEvent(${JSON.stringify(resultEventName)}, { detail }));
    
    try {
      const eventDetail = (event && event.detail) || {};
      if (eventDetail.kind === 'list-action') {
        const actionKey = [eventDetail.listId, eventDetail.itemId, eventDetail.actionId].join(':');
        const handler = listActionHandlers.get(actionKey);
        if (!handler) {
          throw new Error('List action is no longer available.');
        }
        await handler();
        emit({ status: 'action-complete' });
        return;
      }

      emit({ status: 'started' });
      const capturedSelection = eventDetail.selection || '';

      // 1. Wrapped Page DOM reads
      const page = {
        querySelector(selector) {
          if (!hasCap('page-dom')) {
            throw new Error("SecurityError: Script lacks 'page-dom' capability to read the DOM.");
          }
          const el = document.querySelector(selector);
          return el ? wrapElement(el) : null;
        },
        querySelectorAll(selector) {
          if (!hasCap('page-dom')) {
            throw new Error("SecurityError: Script lacks 'page-dom' capability to read the DOM.");
          }
          const nodes = document.querySelectorAll(selector);
          return Array.from(nodes).map(wrapElement);
        },
        get title() {
          if (!hasCap('page-dom')) return '';
          return document.title;
        }
      };

      function wrapElement(el) {
        return {
          get textContent() { return el.textContent; },
          get innerText() { return el.innerText; },
          get value() { return el.value; },
          getAttribute(name) { return el.getAttribute(name); },
          hasAttribute(name) { return el.hasAttribute(name); },
          querySelector(selector) {
            const sub = el.querySelector(selector);
            return sub ? wrapElement(sub) : null;
          },
          querySelectorAll(selector) {
            const subs = el.querySelectorAll(selector);
            return Array.from(subs).map(wrapElement);
          }
        };
      }

      // 2. Clipboard writes
      const clipboard = {
        async writeText(text) {
          if (!hasCap('clipboard-write')) {
            throw new Error("SecurityError: Script lacks 'clipboard-write' capability.");
          }
          return navigator.clipboard.writeText(text);
        }
      };

      // 3. Selection API
      const getSelection = () => {
        if (!hasCap('selection')) {
          throw new Error("SecurityError: Script lacks 'selection' capability.");
        }
        return {
          toString() {
            return capturedSelection || (window.getSelection()?.toString() ?? '');
          }
        };
      };

      // 4. Chrome built-in AI APIs
      const getAiConstructor = (name) => {
        const value = globalThis[name];
        return value && typeof value === 'object' ? value : undefined;
      };

      const createBuiltInAiSession = async (name, options) => {
        if (!hasCap('ai')) {
          throw new Error("SecurityError: Script lacks 'ai' capability.");
        }
        const api = getAiConstructor(name);
        if (!api || typeof api.create !== 'function') {
          throw new Error('AIError: Chrome built-in ' + name + ' API is unavailable in this browser.');
        }
        return api.create(options || {});
      };

      const runSessionMethod = async (session, methodNames, input, options) => {
        const methodName = methodNames.find((name) => typeof session?.[name] === 'function');
        if (!methodName) {
          throw new Error('AIError: Built-in AI session does not expose a supported run method.');
        }
        try {
          return await session[methodName](input, options || {});
        } finally {
          if (typeof session?.destroy === 'function') session.destroy();
        }
      };

      const ai = {
        async availability(kind = 'prompt', options = {}) {
          if (!hasCap('ai')) {
            throw new Error("SecurityError: Script lacks 'ai' capability.");
          }
          const apiName = {
            prompt: 'LanguageModel',
            languageModel: 'LanguageModel',
            summarizer: 'Summarizer',
            summary: 'Summarizer',
            translator: 'Translator',
            translate: 'Translator',
            languageDetector: 'LanguageDetector',
            detector: 'LanguageDetector',
            writer: 'Writer',
            rewriter: 'Rewriter',
            proofreader: 'Proofreader'
          }[kind] || String(kind);
          const api = getAiConstructor(apiName);
          if (!api) return 'unavailable';
          if (typeof api.availability === 'function') return api.availability(options);
          if (typeof api.available === 'function') return api.available(options);
          return typeof api.create === 'function' ? 'available' : 'unavailable';
        },
        async prompt(input, options = {}) {
          const session = await createBuiltInAiSession('LanguageModel', options);
          return runSessionMethod(session, ['prompt'], String(input), options);
        },
        async summarize(text, options = {}) {
          const session = await createBuiltInAiSession('Summarizer', options);
          return runSessionMethod(session, ['summarize'], String(text), options);
        },
        async detectLanguage(text, options = {}) {
          const session = await createBuiltInAiSession('LanguageDetector', options);
          const result = await runSessionMethod(session, ['detect'], String(text), options);
          return Array.isArray(result) ? result[0] : result;
        },
        async translate(text, options = {}) {
          const createOptions = { ...options };
          if (createOptions.sourceLanguage === 'auto') delete createOptions.sourceLanguage;
          const session = await createBuiltInAiSession('Translator', createOptions);
          return runSessionMethod(session, ['translate'], String(text), options);
        },
        async write(prompt, options = {}) {
          const session = await createBuiltInAiSession('Writer', options);
          return runSessionMethod(session, ['write'], String(prompt), options);
        },
        async rewrite(text, options = {}) {
          const session = await createBuiltInAiSession('Rewriter', options);
          return runSessionMethod(session, ['rewrite'], String(text), options);
        },
        async proofread(text, options = {}) {
          const session = await createBuiltInAiSession('Proofreader', options);
          return runSessionMethod(session, ['proofread', 'correct'], String(text), options);
        }
      };

      // 5. Toast API
      const toast = (message, options = {}) => {
        if (!hasCap('toast')) {
          throw new Error("SecurityError: Script lacks 'toast' capability.");
        }
        const input = message && typeof message === 'object' && !Array.isArray(message)
          ? message
          : { ...options, message: String(message) };
        emit({
          status: 'toast',
          message: String(input.message || input.description || ''),
          toast: {
            title: typeof input.title === 'string' ? input.title : undefined,
            message: String(input.message || input.description || ''),
            description: typeof input.description === 'string' ? input.description : undefined,
            variant: typeof input.variant === 'string' ? input.variant : undefined,
            position: typeof input.position === 'string' ? input.position : undefined,
            animation: typeof input.animation === 'string' ? input.animation : undefined,
            duration: typeof input.duration === 'number' || input.duration === false ? input.duration : undefined,
            dismissible: typeof input.dismissible === 'boolean' ? input.dismissible : undefined,
            closeButton: typeof input.closeButton === 'boolean' ? input.closeButton : undefined,
            showProgress: typeof input.showProgress === 'boolean' ? input.showProgress : undefined,
            progress: typeof input.progress === 'boolean' ? input.progress : undefined
          }
        });
      };

      const list = (input) => {
        if (!hasCap('list')) {
          throw new Error("SecurityError: Script lacks 'list' capability.");
        }
        if (!input || typeof input !== 'object') {
          throw new Error('ListError: list() requires a list definition object.');
        }

        const listId = String(input.id || 'list');
        const items = Array.isArray(input.items) ? input.items : [];
        const safeItems = items.map((item, itemIndex) => {
          const itemId = String(item && item.id ? item.id : itemIndex);
          const actions = Array.isArray(item && item.actions) ? item.actions : [];
          const safeActions = actions.map((action, actionIndex) => {
            const actionId = String(action && action.id ? action.id : actionIndex);
            if (typeof action?.onAction === 'function') {
              listActionHandlers.set([listId, itemId, actionId].join(':'), () => action.onAction(item));
            }
            return {
              id: actionId,
              title: String(action && action.title ? action.title : 'Run action'),
              subtitle: typeof action?.subtitle === 'string' ? action.subtitle : undefined,
              icon: action?.icon,
              style: action?.style === 'destructive' ? 'destructive' : 'default'
            };
          });

          return {
            id: itemId,
            title: String(item && item.title ? item.title : 'Untitled item'),
            subtitle: typeof item?.subtitle === 'string' ? item.subtitle : undefined,
            accessories: Array.isArray(item?.accessories) ? item.accessories.map(String) : undefined,
            keywords: Array.isArray(item?.keywords) ? item.keywords.map(String) : undefined,
            icon: item?.icon,
            actions: safeActions
          };
        });

        emit({
          status: 'list',
          list: {
            id: listId,
            title: String(input.title || 'List'),
            subtitle: typeof input.subtitle === 'string' ? input.subtitle : undefined,
            searchPlaceholder: typeof input.searchPlaceholder === 'string' ? input.searchPlaceholder : undefined,
            emptyState: typeof input.emptyState === 'string' ? input.emptyState : undefined,
            items: safeItems
          }
        });
      };

      // Wrapped location & navigator
      const wrappedLocation = {
        get href() {
          if (!hasCap('page-dom')) return '';
          return location.href;
        },
        get host() {
          if (!hasCap('page-dom')) return '';
          return location.host;
        },
        get hostname() {
          if (!hasCap('page-dom')) return '';
          return location.hostname;
        },
        get origin() {
          if (!hasCap('page-dom')) return '';
          return location.origin;
        },
        get pathname() {
          if (!hasCap('page-dom')) return '';
          return location.pathname;
        },
        toString() {
          if (!hasCap('page-dom')) return '';
          return location.href;
        }
      };

      const wrappedNavigator = {
        get clipboard() { return clipboard; },
        get userAgent() { return navigator.userAgent; },
        get language() { return navigator.language; }
      };

      const wrappedWindow = {
        getSelection,
        get location() { return wrappedLocation; },
        get navigator() { return wrappedNavigator; },
        document: page
      };

      const selectionText = hasCap('selection')
        ? (capturedSelection || (window.getSelection()?.toString() ?? ''))
        : '';

      const context = {
        page,
        window: wrappedWindow,
        location: wrappedLocation,
        navigator: wrappedNavigator,
        selection: selectionText,
        clipboard,
        url: hasCap('page-dom') ? location.href : '',
        title: hasCap('page-dom') ? document.title : '',
        toast,
        list,
        ai
      };

      // Shadow the globals by wrapping the user script in an IIFE parameter binding
      const userRun = (function(document, window, navigator, location) {
        return ${functionSource};
      })(page, wrappedWindow, wrappedNavigator, wrappedLocation);

      await userRun(context);
      emit({ status: 'complete' });
    } catch (error) {
      console.error('[Burst] Script failed', error);
      emit({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  });
})();`;
}

export function createLocalUserScriptCode(script: LocalScript): string {
  const eventName = getLocalScriptEventName(script.id);
  const resultEventName = getLocalScriptResultEventName(script.id);
  return createSandboxedUserScriptCode(script.code, eventName, resultEventName);
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
  const matchPatterns = script.matchPatterns.map((pattern) => pattern.trim()).filter(Boolean);
  return {
    ...script,
    name: script.name.trim() || 'Untitled local command',
    matchPatterns: matchPatterns.length > 0 ? matchPatterns : ['<all_urls>'],
    status: script.status,
    icon: normalizeIcon(script.icon),
    originRegistryUrl: script.originRegistryUrl?.trim() || undefined,
    originCommandId: script.originCommandId?.trim() || undefined,
    originRegistryKind: script.originRegistryKind === 'official' || script.originRegistryKind === 'git' ? script.originRegistryKind : undefined,
    upstreamCodeAtFork: script.upstreamCodeAtFork,
    version: script.version?.trim() || undefined,
  };
}

function normalizeIcon(icon: CommandIcon): CommandIcon {
  if (icon.type === 'favicon') return { type: 'favicon', host: icon.host?.trim() || undefined };
  if (icon.type === 'url' || icon.type === 'asset') return { type: icon.type, src: icon.src.trim() };
  if (icon.type === 'lucide') return { type: 'lucide', name: icon.name.trim() };
  return { type: icon.type, value: icon.value.trim() || 'B' };
}

function isLocalScript(value: unknown): value is LocalScript {
  if (typeof value !== 'object' || value === null) return false;

  const script = value as Partial<LocalScript>;
  return typeof script.id === 'string'
    && typeof script.name === 'string'
    && Array.isArray(script.matchPatterns)
    && script.matchPatterns.every((pattern) => typeof pattern === 'string')
    && typeof script.updatedAt === 'string'
    && typeof script.code === 'string'
    && isLocalScriptStatus(script.status)
    && isCommandIcon(script.icon)
    && (script.originRegistryUrl === undefined || typeof script.originRegistryUrl === 'string')
    && (script.originCommandId === undefined || typeof script.originCommandId === 'string')
    && (script.originRegistryKind === undefined || script.originRegistryKind === 'official' || script.originRegistryKind === 'git')
    && (script.upstreamCodeAtFork === undefined || typeof script.upstreamCodeAtFork === 'string')
    && (script.version === undefined || typeof script.version === 'string');
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
  if (icon.type === 'lucide') return typeof icon.name === 'string';
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

export type LocalScriptCapability = 'page-dom' | 'selection' | 'clipboard-write' | 'toast' | 'list' | 'ai';

export function detectRequiredCapabilities(code: string): LocalScriptCapability[] {
  const capabilities: LocalScriptCapability[] = [];

  if (/page\b|document\b|querySelector|querySelectorAll|createElement|\btitle\b|\burl\b|\blocation\b/i.test(code)) {
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
  if (/\blist\b|createList|showList/i.test(code)) {
    capabilities.push('list');
  }
  if (/\bai\b|LanguageModel|Summarizer|Translator|LanguageDetector|Writer|Rewriter|Proofreader/i.test(code)) {
    capabilities.push('ai');
  }

  return capabilities;
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
