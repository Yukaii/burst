import { describe, expect, test } from 'bun:test';
import {
  commandMatchesHost,
  managementCommands,
  orderPaletteCommands,
  searchCommands,
} from '../src/lib/commands.ts';
import {
  createLocalUserScriptCode,
  getLocalScriptEventName,
  getLocalScriptMatchPatterns,
  getLocalScriptResultEventName,
  localScriptToCommand,
} from '../src/lib/localScripts.ts';
import { sampleCommandManifests, validateCommandManifest } from '../src/lib/manifest.ts';

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
    expect(source).toContain('toast: (message) => emit');
    expect(source).toContain('selection: window.getSelection()?.toString() ??');
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
