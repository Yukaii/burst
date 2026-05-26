import { describe, expect, test } from 'bun:test';
import {
  commandMatchesHost,
  commandPackToCommands,
  managementCommands,
  orderPaletteCommands,
  searchCommands,
} from '../src/lib/commands.ts';
import {
  createLocalUserScriptCode,
  createSandboxedUserScriptCode,
  detectRequiredCapabilities,
  getLocalScriptEventName,
  getLocalScriptMatchPatterns,
  getLocalScriptResultEventName,
  localScriptToCommand,
} from '../src/lib/localScripts.ts';
import { sampleCommandManifests, validateCommandManifest } from '../src/lib/manifest.ts';
import {
  getRegistryCommands,
  getRegistryCommandPacks,
  getRegistryCommandPack,
  getRegistryCommandsPage,
  getRegistryCommand,
  getAuditReport,
  getPublisherProfile,
  getMockScriptCode,
} from '../src/lib/registryApi.ts';
import { createRegistryHandler } from '../apps/registry/src/registryHandler.ts';
import { createMemoryRegistryStore } from '../apps/registry/src/registryStore.ts';
import {
  getRegistryScriptRegistrationId,
  getRegistryScriptEventName,
  getRegistryScriptResultEventName,
  getRegistryScriptMatchPatterns,
  createRegistryUserScriptCode,
  installRegistryCommand,
  installRegistryCommandPack,
  isRegistryCommandEnabled,
  loadInstalledRegistryCommands,
  loadConsentGrants,
  saveConsentGrant,
  setRegistryCommandStatus,
  uninstallRegistryCommandPack,
} from '../src/lib/registryStorage.ts';
import { loadCommandPaletteTheme, resolveCommandPaletteTheme, resolveCommandPaletteThemeMeta } from '../src/lib/paletteThemes.ts';
import { formatLocalScriptCode, validateLocalScriptCode } from '../entrypoints/dashboard/components/utils.ts';

const baseCommand = {
  id: 'base-command',
  title: 'Base command',
  description: 'Base command used by tests.',
  website: 'example.com',
  matchPatterns: ['example.com/*'],
  publisher: {
    name: 'Tests',
    handle: '@tests',
    avatarInitials: 'T',
  },
  trustLevel: 'community',
  risk: 'low',
  permissions: [],
  sourceUrl: 'https://example.com/source',
  installs: 0,
  rating: 0,
  icon: { type: 'initials', value: 'T' },
};

const localScript = {
  id: 'local-copy-title',
  name: 'Copy title',
  matchPatterns: ['github.com/*'],
  icon: { type: 'initials', value: 'CT' },
  status: 'enabled',
  updatedAt: '2026-05-20',
  code: `export default async function run({ title, toast }) {
  toast(title);
}`,
};

describe('command matching', () => {
  test('matches exact and subdomain hosts', () => {
    expect(commandMatchesHost(baseCommand, 'example.com')).toBe(true);
    expect(commandMatchesHost(baseCommand, 'docs.example.com')).toBe(true);
    expect(commandMatchesHost(baseCommand, 'other.com')).toBe(false);
  });

  test('normalizes local script match patterns for userScripts registration', () => {
    expect(getLocalScriptMatchPatterns(localScript)).toEqual(['*://github.com/*']);
    expect(getLocalScriptMatchPatterns({ ...localScript, matchPatterns: ['<all_urls>'] })).toEqual(['<all_urls>']);
    expect(getLocalScriptMatchPatterns({ ...localScript, matchPatterns: ['https://github.com/*'] })).toEqual(['https://github.com/*']);
    expect(getLocalScriptMatchPatterns({ ...localScript, matchPatterns: ['github.com/*', 'docs.example.com/*'] })).toEqual([
      '*://github.com/*',
      '*://docs.example.com/*',
    ]);
  });
});

describe('command palette themes', () => {
  test('resolves website-specific themes in auto mode', () => {
    expect(resolveCommandPaletteThemeMeta('auto', 'https://github.com/openai/codex', 'light').id).toBe('github');
    expect(resolveCommandPaletteThemeMeta('auto', 'https://app.linear.app/acme', 'dark').id).toBe('linear');
  });

  test('allows explicit user override and default fallback', () => {
    expect(resolveCommandPaletteThemeMeta('notion', 'https://github.com/openai/codex', 'dark').id).toBe('notion');
    expect(resolveCommandPaletteThemeMeta('auto', 'https://github.com/openai/codex', 'dark').id).toBe('burst-dark');
    expect(resolveCommandPaletteThemeMeta('auto', 'https://example.com', 'light').id).toBe('burst-light');
  });

  test('loads full theme variables on demand', async () => {
    const theme = await resolveCommandPaletteTheme('auto', 'https://notion.so/workspace', 'light');
    expect(theme.id).toBe('notion');
    expect(theme.variables['--burst-shell-radius']).toBe('10px');
    expect((await loadCommandPaletteTheme('github')).variables['--burst-font-family']).toContain('Noto Sans');
  });
});

describe('local script registration', () => {
  test('generates a user script listener without runtime eval', () => {
    const source = createLocalUserScriptCode(localScript);

    expect(source).toContain(getLocalScriptEventName(localScript.id));
    expect(source).toContain(getLocalScriptResultEventName(localScript.id));
    expect(source).toContain('toast = (message, options = {}) =>');
    expect(source).toContain('const list = (input) =>');
    expect(source).toContain("status: 'toast'");
    expect(source).toContain("status: 'list'");
    expect(source).toContain("eventDetail.kind === 'list-action'");
    expect(source).toContain('position: typeof input.position === \'string\' ? input.position : undefined');
    expect(source).toContain("const capturedSelection = eventDetail.selection || '';");
    expect(source).toContain('selection: selectionText');
    expect(source).not.toContain('export default');
    expect(source).not.toContain('new Function');
    expect(source).not.toContain('eval(');
  });

  test('validates and formats local editor scripts', () => {
    expect(validateLocalScriptCode('export default async function run({ toast }) { toast("ok"); }').ok).toBe(true);
    const invalid = validateLocalScriptCode('export default async function run() { const items = [1, 2; }');
    expect(invalid.ok).toBe(false);
    expect(invalid.message).toContain('SyntaxError');
    expect(formatLocalScriptCode('export default async function run({ toast }) { \n toast("ok");\n}\n')).toContain('  toast("ok");');
    expect(formatLocalScriptCode('export default function run() {\nconst value = `  keep spacing`;\n}\n')).toContain('`  keep spacing`');
  });
});

describe('palette ordering and search', () => {
  test('prioritizes local script commands, then pinned commands', () => {
    const localCommand = localScriptToCommand(localScript);
    const pinnedCommand = { ...baseCommand, id: 'pinned-command', pinned: true };
    const plainCommand = { ...baseCommand, id: 'plain-command', pinned: false };

    expect(orderPaletteCommands([plainCommand, pinnedCommand, localCommand]).map((command) => command.id)).toEqual([
      localCommand.id,
      pinnedCommand.id,
      plainCommand.id,
    ]);
  });

  test('keeps management commands discoverable by use case text', () => {
    expect(searchCommands(managementCommands, 'dashboard').map((command) => command.id)).toContain('burst-open-dashboard');
    expect(searchCommands(managementCommands, 'create').map((command) => command.id)).toContain('burst-create-local-script');
  });
});

describe('command manifest validation', () => {
  test('accepts sample command pack manifests', () => {
    expect(sampleCommandManifests.map((manifest) => validateCommandManifest(manifest).ok)).toEqual([true]);
  });

  test('requires safe pack source and per-command entrypoint metadata', () => {
    const manifest = {
      ...sampleCommandManifests[0],
      source: {
        type: 'archive',
        url: 'http://example.com/command.zip',
      },
      commands: [
        {
          ...sampleCommandManifests[0].commands[0],
          runtime: {
            ...sampleCommandManifests[0].commands[0].runtime,
            entrypoint: '../src/index.css',
          },
        },
      ],
    };

    const result = validateCommandManifest(manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('source.url must use https.');
    expect(result.errors).toContain('source.integrity is required for archive packages.');
    expect(result.errors).toContain('commands[0].runtime.entrypoint must be a relative package path without parent traversal.');
    expect(result.errors).toContain('commands[0].runtime.entrypoint must point to a JavaScript or TypeScript module.');
  });

  test('rejects duplicate command ids within a pack', () => {
    const manifest = {
      ...sampleCommandManifests[0],
      commands: [
        sampleCommandManifests[0].commands[0],
        {
          ...sampleCommandManifests[0].commands[1],
          id: sampleCommandManifests[0].commands[0].id,
        },
      ],
    };

    const result = validateCommandManifest(manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('commands[1].id must be unique within the pack.');
  });
});

describe('capability detection', () => {
  test('detects page-dom, selection, clipboard, and toast capabilities', () => {
    const code = `
      export default async function run(context) {
        const title = context.title;
        const sel = context.selection;
        context.toast("Hello");
        context.list({ title: "Branches", items: [] });
        await context.fetch('/api/me');
        context.navigate.to('/dashboard');
        await context.ai.prompt("Summarize " + title);
        await context.navigator.clipboard.writeText("Copy me");
        const doc = context.page.querySelector("div");
      }
    `;
    const capabilities = detectRequiredCapabilities(code);
    expect(capabilities).toContain('page-dom');
    expect(capabilities).toContain('selection');
    expect(capabilities).toContain('clipboard-write');
    expect(capabilities).toContain('toast');
    expect(capabilities).toContain('list');
    expect(capabilities).toContain('fetch');
    expect(capabilities).toContain('navigate');
    expect(capabilities).toContain('ai');
  });

  test('detects title and url context reads as page-dom capability', () => {
    const code = `
      export default async function run({ title, url, toast }) {
        toast(\`[\${title}](\${url})\`);
      }
    `;
    expect(detectRequiredCapabilities(code)).toContain('page-dom');
  });

  test('returns empty array when no capabilities match', () => {
    const code = `
      export default async function run(context) {
        // Nothing here
      }
    `;
    expect(detectRequiredCapabilities(code)).toEqual([]);
  });
});

describe('registry API layer', () => {
  test('exposes command packs and flattens their commands for palette surfaces', async () => {
    const packs = await getRegistryCommandPacks();
    expect(packs.some(pack => pack.id === 'github-workflow-pack')).toBe(true);

    const pack = await getRegistryCommandPack('github-workflow-pack');
    expect(pack?.commands.length).toBe(2);
    expect(commandPackToCommands(pack).map(command => command.packId)).toEqual([
      'github-workflow-pack',
      'github-workflow-pack',
    ]);
  });

  test('getRegistryCommands queries lists correctly', async () => {
    const commands = await getRegistryCommands();
    expect(commands.length).toBeGreaterThan(0);

    const filtered = await getRegistryCommands('Markdown');
    expect(filtered.some(c => c.id === 'markdown-link-builder')).toBe(true);
  });

  test('getRegistryCommandsPage returns pagination metadata', async () => {
    const page = await getRegistryCommandsPage('', { offset: 0, limit: 2 });
    expect(page.commands.length).toBe(2);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(2);
    expect(page.total).toBeGreaterThan(2);
    expect(page.hasMore).toBe(true);
  });

  test('getRegistryCommandsPage filters by host before pagination', async () => {
    const page = await getRegistryCommandsPage('', { host: 'github.com', offset: 0, limit: 20 });
    expect(page.commands.some(command => command.id === 'copy-github-branch')).toBe(true);
    expect(page.commands.every(command =>
      command.matchPatterns.includes('<all_urls>') ||
      command.matchPatterns.some(pattern => pattern.includes('github.com')),
    )).toBe(true);
  });

  test('getRegistryCommand finds command details', async () => {
    const command = await getRegistryCommand('copy-github-branch');
    expect(command).toBeDefined();
    expect(command?.id).toBe('copy-github-branch');
    expect(command?.title).toBe('Copy GitHub branch name');
    expect(command?.packId).toBe('github-workflow-pack');

    const missing = await getRegistryCommand('does-not-exist');
    expect(missing).toBeUndefined();
  });

  test('getAuditReport finds reports', async () => {
    const report = await getAuditReport('copy-github-branch', '1.0.0');
    expect(report).toBeDefined();
    expect(report?.commandId).toBe('copy-github-branch');
    expect(report?.status).toBe('warning');

    const missingReport = await getAuditReport('does-not-exist', '1.0.0');
    expect(missingReport).toBeUndefined();
  });

  test('getPublisherProfile retrieves profiles', async () => {
    const profile = await getPublisherProfile('@schen');
    expect(profile).toBeDefined();
    expect(profile?.name).toBe('Sarah Chen');
    expect(profile?.verified).toBe(true);

    const missingProfile = await getPublisherProfile('@non-existent');
    expect(missingProfile).toBeUndefined();
  });
});

describe('registry permissions', () => {
  async function createPublisherSession(store, login = 'publisher-user') {
    const user = await store.upsertGitHubUser({
      id: `${login}-id`,
      login,
      name: login,
      avatar_url: `https://github.com/${login}.png`,
      html_url: `https://github.com/${login}`,
      bio: null,
    });
    const { sessionId } = await store.createSession(user.handle);
    return { user, sessionId };
  }

  test('requires admin access for the users directory', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const { sessionId } = await createPublisherSession(store);

    const guestResponse = await handler(new Request('http://registry.test/api/users'));
    expect(guestResponse.status).toBe(401);

    const publisherResponse = await handler(new Request('http://registry.test/api/users', {
      headers: { Cookie: `session_id=${sessionId}` },
    }));
    expect(publisherResponse.status).toBe(403);

    await store.updateUser('@publisher-user', { role: 'admin' });
    const adminResponse = await handler(new Request('http://registry.test/api/users', {
      headers: { Cookie: `session_id=${sessionId}` },
    }));
    expect(adminResponse.status).toBe(200);
  });

  test('prevents self-service role and verification escalation', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const { sessionId } = await createPublisherSession(store, 'self-editor');

    const response = await handler(new Request('http://registry.test/api/users/%40self-editor', {
      method: 'PATCH',
      headers: {
        Cookie: `session_id=${sessionId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Self Editor',
        role: 'admin',
        verified: true,
        verifiedSources: ['github.com/self-editor'],
      }),
    }));

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe('Self Editor');
    expect(updated.role).toBe('publisher');
    expect(updated.verified).toBe(false);
    expect(updated.verifiedSources).toEqual(['github.com/self-editor']);
  });
});

describe('registry storage and consent', () => {
  test('generates registry user script registration metadata', () => {
    const commandId = 'test-cmd';
    expect(getRegistryScriptRegistrationId(commandId)).toBe('burst-registry-script-test-cmd');
    expect(getRegistryScriptEventName(commandId)).toBe('burst:run-registry-script:test-cmd');
    expect(getRegistryScriptResultEventName(commandId)).toBe('burst:registry-script-result:test-cmd');
    expect(getRegistryScriptMatchPatterns(['github.com/*'])).toEqual(['*://github.com/*']);
  });

  test('generates registry user script code wrapper', () => {
    const commandId = 'test-cmd';
    const rawCode = `export default async function run({ page }) { console.log(page); }`;
    const wrapped = createRegistryUserScriptCode(commandId, rawCode);

    expect(wrapped).toContain('burst:run-registry-script:test-cmd');
    expect(wrapped).toContain('burst:registry-script-result:test-cmd');
    expect(wrapped).toContain('async function run({ page })');
    expect(wrapped).toContain("const capturedSelection = eventDetail.selection || '';");
    expect(wrapped).toContain('selection: selectionText');
    expect(wrapped).not.toContain('export default');
  });

  test('manages consent grants storage', async () => {
    const grants = await loadConsentGrants();
    expect(grants).toEqual([]);

    await saveConsentGrant('copy-github-branch');
    const updated = await loadConsentGrants();
    expect(updated).toContain('copy-github-branch');

    // Duplicate grant should be a no-op
    await saveConsentGrant('copy-github-branch');
    const reloaded = await loadConsentGrants();
    expect(reloaded.filter(id => id === 'copy-github-branch').length).toBe(1);
  });

  test('refreshes installed registry command code on reinstall', async () => {
    await installRegistryCommand({ ...baseCommand, id: 'refresh-test', code: 'old-code', version: '1.0.0' });
    await installRegistryCommand({ ...baseCommand, id: 'refresh-test', code: 'new-code', version: '1.0.1' });

    const installed = await loadInstalledRegistryCommands();
    const command = installed.find((item) => item.id === 'refresh-test');
    expect(command?.code).toBe('new-code');
    expect(command?.version).toBe('1.0.1');
  });

  test('tracks disabled status for installed registry commands', async () => {
    await installRegistryCommand({ ...baseCommand, id: 'toggle-test', code: 'toggle-code' });
    let installed = await loadInstalledRegistryCommands();
    let command = installed.find((item) => item.id === 'toggle-test');
    expect(isRegistryCommandEnabled(command)).toBe(true);

    await setRegistryCommandStatus('toggle-test', 'disabled');
    installed = await loadInstalledRegistryCommands();
    command = installed.find((item) => item.id === 'toggle-test');
    expect(command?.status).toBe('disabled');
    expect(isRegistryCommandEnabled(command)).toBe(false);
  });

  test('installs and uninstalls every command in a registry command pack', async () => {
    const pack = await getRegistryCommandPack('github-workflow-pack');
    await installRegistryCommandPack(pack);

    let installed = await loadInstalledRegistryCommands();
    expect(installed.filter((command) => command.packId === 'github-workflow-pack').map((command) => command.id).sort()).toEqual([
      'copy-github-branch',
      'summarize-github-pr',
    ]);

    await uninstallRegistryCommandPack('github-workflow-pack');
    installed = await loadInstalledRegistryCommands();
    expect(installed.some((command) => command.packId === 'github-workflow-pack')).toBe(false);
  });
});

import { getRegistryServerBaseUrl, loadSettings, saveSettings } from '../src/lib/settings.ts';

describe('extension settings storage', () => {
  test('loads default settings', async () => {
    const settings = await loadSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.position).toBe('top');
    expect(settings.backdropClickClose).toBe(true);
    expect(settings.showConsoleLogs).toBe(false);
    expect(settings.registryServer).toBe('local');
    expect(settings.registryServerUrl).toBe('http://localhost:5174');
    expect(settings.editorTheme).toBe('default');
    expect(settings.editorKeymap).toBe('default');
    expect(settings.editorWordWrap).toBe(true);
  });

  test('saves and loads settings correctly', async () => {
    const customSettings = {
      theme: 'light',
      position: 'center',
      backdropClickClose: false,
      showConsoleLogs: true,
      registryServer: 'custom',
      registryServerUrl: 'https://registry.example.test',
      editorFontFamily: 'Monospace',
      editorFontSize: 14,
      editorTheme: 'dracula',
      editorKeymap: 'vim',
      editorWordWrap: false,
    };
    await saveSettings(customSettings);
    const loaded = await loadSettings();
    expect(loaded).toEqual(customSettings);
  });

  test('resolves registry server base URLs', () => {
    expect(getRegistryServerBaseUrl({ registryServer: 'local', registryServerUrl: '' })).toBe('http://localhost:5174');
    expect(getRegistryServerBaseUrl({ registryServer: 'production', registryServerUrl: '' })).toBe('https://burst.yukai.dev');
    expect(getRegistryServerBaseUrl({ registryServer: 'custom', registryServerUrl: 'https://registry.example.test/' })).toBe('https://registry.example.test');
  });
});

describe('sandbox IIFE wrapping and lexical shadowing', () => {
  test('shadows global variables with IIFE parameter bindings', () => {
    const code = `
      export default async function run({ page }) {
        const div = document.querySelector('div');
      }
    `;
    const wrapped = createSandboxedUserScriptCode(code, 'run-evt', 'res-evt');
    
    // Check shadowing IIFE structure
    expect(wrapped).toContain('const userRun = (function(document, window, navigator, location, fetch)');
    expect(wrapped).toContain('})(page, wrappedWindow, wrappedNavigator, wrappedLocation, safeFetch);');
  });

  test('extracts and exposes capability restrictions in the runtime scope', () => {
    const code = `
      export default async function run(context) {
        context.toast("test");
        await context.navigator.clipboard.writeText("hello");
      }
    `;
    const wrapped = createSandboxedUserScriptCode(code, 'run-evt', 'res-evt');

    expect(wrapped).toContain('capabilities = ["clipboard-write","toast"]');
    expect(wrapped).toContain('const hasCap = (c) => capabilities.includes(c);');
    expect(wrapped).toContain('if (!hasCap(\'clipboard-write\'))');
    expect(wrapped).toContain('if (!hasCap(\'toast\'))');
  });

  test('exposes same-origin navigation through explicit helper', () => {
    const code = `
      export default async function run({ navigate }) {
        navigate.to('/?nav=overview');
      }
    `;
    const wrapped = createSandboxedUserScriptCode(code, 'run-evt', 'res-evt');

    expect(wrapped).toContain('capabilities = ["navigate"]');
    expect(wrapped).toContain('const navigate = {');
    expect(wrapped).toContain("if (!hasCap('navigate'))");
    expect(wrapped).toContain('target.origin !== location.origin');
    expect(wrapped).toContain('location.href = getSameOriginNavigationTarget(input);');
    expect(wrapped).toContain("status: 'navigate-open'");
    expect(wrapped).toContain('navigate,');
  });

  test('exposes same-origin fetch through explicit helper and global shadow', () => {
    const code = `
      export default async function run() {
        await fetch('/api/me');
      }
    `;
    const wrapped = createSandboxedUserScriptCode(code, 'run-evt', 'res-evt');

    expect(wrapped).toContain('capabilities = ["fetch"]');
    expect(wrapped).toContain('const safeFetch = async');
    expect(wrapped).toContain("if (!hasCap('fetch'))");
    expect(wrapped).toContain('target.origin !== location.origin');
    expect(wrapped).toContain('return fetch(target.href, init);');
    expect(wrapped).toContain('fetch: safeFetch');
  });

  test('markdown link registry command receives page title and url context', () => {
    const wrapped = createSandboxedUserScriptCode(getMockScriptCode('markdown-link-builder'), 'run-evt', 'res-evt');

    expect(wrapped).toContain('capabilities = ["page-dom","clipboard-write","toast"]');
    expect(wrapped).toContain('title: hasCap(\'page-dom\') ? document.title : \'\'');
    expect(wrapped).toContain('url: hasCap(\'page-dom\') ? location.href : \'\'');
  });
});
