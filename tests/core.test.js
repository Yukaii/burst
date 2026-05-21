import { describe, expect, test } from 'bun:test';
import {
  commandMatchesHost,
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
  getRegistryCommand,
  getAuditReport,
  getPublisherProfile,
} from '../src/lib/registryApi.ts';
import {
  getRegistryScriptRegistrationId,
  getRegistryScriptEventName,
  getRegistryScriptResultEventName,
  getRegistryScriptMatchPatterns,
  createRegistryUserScriptCode,
  loadConsentGrants,
  saveConsentGrant,
} from '../src/lib/registryStorage.ts';

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
  matchPattern: 'github.com/*',
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
    expect(getLocalScriptMatchPatterns({ ...localScript, matchPattern: '<all_urls>' })).toEqual(['<all_urls>']);
    expect(getLocalScriptMatchPatterns({ ...localScript, matchPattern: 'https://github.com/*' })).toEqual(['https://github.com/*']);
  });
});

describe('local script registration', () => {
  test('generates a user script listener without runtime eval', () => {
    const source = createLocalUserScriptCode(localScript);

    expect(source).toContain(getLocalScriptEventName(localScript.id));
    expect(source).toContain(getLocalScriptResultEventName(localScript.id));
    expect(source).toContain('toast = (message) =>');
    expect(source).toContain('const capturedSelection = (event && event.detail && event.detail.selection) || \'\';');
    expect(source).toContain('selection: selectionText');
    expect(source).not.toContain('export default');
    expect(source).not.toContain('new Function');
    expect(source).not.toContain('eval(');
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
  test('accepts sample command manifests', () => {
    expect(sampleCommandManifests.map((manifest) => validateCommandManifest(manifest).ok)).toEqual([true]);
  });

  test('requires safe package source and entrypoint metadata', () => {
    const manifest = {
      ...sampleCommandManifests[0],
      source: {
        type: 'archive',
        url: 'http://example.com/command.zip',
      },
      runtime: {
        ...sampleCommandManifests[0].runtime,
        entrypoint: '../src/index.css',
      },
    };

    const result = validateCommandManifest(manifest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('source.url must use https.');
    expect(result.errors).toContain('source.integrity is required for archive packages.');
    expect(result.errors).toContain('runtime.entrypoint must be a relative package path without parent traversal.');
    expect(result.errors).toContain('runtime.entrypoint must point to a JavaScript or TypeScript module.');
  });
});

describe('capability detection', () => {
  test('detects page-dom, selection, clipboard, and toast capabilities', () => {
    const code = `
      export default async function run(context) {
        const title = context.title;
        const sel = context.selection;
        context.toast("Hello");
        await context.navigator.clipboard.writeText("Copy me");
        const doc = context.page.querySelector("div");
      }
    `;
    const capabilities = detectRequiredCapabilities(code);
    expect(capabilities).toContain('page-dom');
    expect(capabilities).toContain('selection');
    expect(capabilities).toContain('clipboard-write');
    expect(capabilities).toContain('toast');
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
  test('getRegistryCommands queries lists correctly', async () => {
    const commands = await getRegistryCommands();
    expect(commands.length).toBeGreaterThan(0);

    const filtered = await getRegistryCommands('Markdown');
    expect(filtered.some(c => c.id === 'markdown-link-builder')).toBe(true);
  });

  test('getRegistryCommand finds command details', async () => {
    const command = await getRegistryCommand('copy-github-branch');
    expect(command).toBeDefined();
    expect(command?.id).toBe('copy-github-branch');
    expect(command?.title).toBe('Copy GitHub branch name');

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
    expect(wrapped).toContain('const capturedSelection = (event && event.detail && event.detail.selection) || \'\';');
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
});

import { loadSettings, saveSettings } from '../src/lib/settings.ts';

describe('extension settings storage', () => {
  test('loads default settings', async () => {
    const settings = await loadSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.position).toBe('top');
    expect(settings.backdropClickClose).toBe(true);
    expect(settings.showConsoleLogs).toBe(false);
  });

  test('saves and loads settings correctly', async () => {
    const customSettings = {
      theme: 'light',
      position: 'center',
      backdropClickClose: false,
      showConsoleLogs: true,
    };
    await saveSettings(customSettings);
    const loaded = await loadSettings();
    expect(loaded).toEqual(customSettings);
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
    expect(wrapped).toContain('const userRun = (function(document, window, navigator, location)');
    expect(wrapped).toContain('})(page, wrappedWindow, wrappedNavigator, wrappedLocation);');
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
});
