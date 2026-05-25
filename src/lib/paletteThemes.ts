import type {
  CommandPaletteTheme,
  CommandPaletteThemeId,
  CommandPaletteThemeMeta,
} from '@/src/themes/types';

export type { CommandPaletteTheme, CommandPaletteThemeId, CommandPaletteThemeMeta } from '@/src/themes/types';

type ThemeModule = {
  default?: CommandPaletteTheme;
  [exportName: string]: unknown;
};

type ThemeRegistryEntry = CommandPaletteThemeMeta & {
  load: () => Promise<ThemeModule>;
  exportName: string;
};

export const commandPaletteThemeRegistry = [
  {
    id: 'burst-dark',
    name: 'Burst Dark',
    description: 'Default glassy dark command palette.',
    previewUrl: 'https://example.com',
    modulePath: 'src/themes/burstDark.ts',
    exportName: 'burstDarkTheme',
    load: () => import('@/src/themes/burstDark'),
  },
  {
    id: 'burst-light',
    name: 'Burst Light',
    description: 'Default light command palette.',
    previewUrl: 'https://example.com',
    modulePath: 'src/themes/burstLight.ts',
    exportName: 'burstLightTheme',
    load: () => import('@/src/themes/burstLight'),
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Neutral, compact palette for github.com.',
    matchHosts: ['github.com', '*.github.com'],
    previewUrl: 'https://github.com',
    modulePath: 'src/themes/github.ts',
    exportName: 'githubTheme',
    load: () => import('@/src/themes/github'),
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Dense graphite palette for linear.app.',
    matchHosts: ['linear.app', '*.linear.app'],
    previewUrl: 'https://linear.app',
    modulePath: 'src/themes/linear.ts',
    exportName: 'linearTheme',
    load: () => import('@/src/themes/linear'),
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Paper-like palette for notion.so.',
    matchHosts: ['notion.so', '*.notion.so'],
    previewUrl: 'https://notion.so',
    modulePath: 'src/themes/notion.ts',
    exportName: 'notionTheme',
    load: () => import('@/src/themes/notion'),
  },
] satisfies ThemeRegistryEntry[];

export const commandPaletteThemeMetadata: CommandPaletteThemeMeta[] = commandPaletteThemeRegistry.map(
  ({ load: _load, exportName: _exportName, ...meta }) => meta,
);

export const commandPaletteThemeOptions: Array<{ value: CommandPaletteThemeId; label: string }> = [
  { value: 'auto', label: 'Auto by website' },
  ...commandPaletteThemeMetadata.map((theme) => ({ value: theme.id, label: theme.name })),
];

const loadedThemes = new Map<CommandPaletteThemeMeta['id'], Promise<CommandPaletteTheme>>();

export function getCommandPaletteThemeMeta(id: CommandPaletteThemeId | undefined): CommandPaletteThemeMeta {
  if (!id || id === 'auto') return commandPaletteThemeMetadata[0];
  return commandPaletteThemeMetadata.find((theme) => theme.id === id) ?? commandPaletteThemeMetadata[0];
}

export function resolveCommandPaletteThemeMeta(
  id: CommandPaletteThemeId | undefined,
  pageUrl: string,
  fallbackTheme: 'dark' | 'light',
): CommandPaletteThemeMeta {
  if (id && id !== 'auto') return getCommandPaletteThemeMeta(id);

  const host = getUrlHost(pageUrl);
  const siteTheme = host
    ? commandPaletteThemeMetadata.find((theme) => theme.matchHosts?.some((pattern) => hostMatchesPattern(host, pattern)))
    : undefined;

  if (siteTheme) return siteTheme;
  return fallbackTheme === 'light' ? getCommandPaletteThemeMeta('burst-light') : getCommandPaletteThemeMeta('burst-dark');
}

export async function loadCommandPaletteTheme(id: CommandPaletteThemeId | undefined): Promise<CommandPaletteTheme> {
  const meta = getCommandPaletteThemeMeta(id);
  const existing = loadedThemes.get(meta.id);
  if (existing) return existing;

  const entry = commandPaletteThemeRegistry.find((theme) => theme.id === meta.id) ?? commandPaletteThemeRegistry[0];
  const promise = entry.load().then((loadedModule) => {
    const module = loadedModule as ThemeModule;
    const theme = module[entry.exportName] ?? module.default;
    if (!isCommandPaletteTheme(theme)) {
      throw new Error(`Command palette theme module ${entry.modulePath} did not export ${entry.exportName}.`);
    }
    return theme;
  });
  loadedThemes.set(meta.id, promise);
  return promise;
}

export async function resolveCommandPaletteTheme(
  id: CommandPaletteThemeId | undefined,
  pageUrl: string,
  fallbackTheme: 'dark' | 'light',
): Promise<CommandPaletteTheme> {
  const meta = resolveCommandPaletteThemeMeta(id, pageUrl, fallbackTheme);
  return loadCommandPaletteTheme(meta.id);
}

function isCommandPaletteTheme(value: unknown): value is CommandPaletteTheme {
  return Boolean(
    value
      && typeof value === 'object'
      && 'id' in value
      && 'variables' in value
      && typeof (value as Partial<CommandPaletteTheme>).id === 'string'
      && typeof (value as Partial<CommandPaletteTheme>).variables === 'object',
  );
}

function getUrlHost(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hostMatchesPattern(host: string, pattern: string): boolean {
  const normalized = pattern.toLowerCase();
  if (normalized.startsWith('*.')) {
    const root = normalized.slice(2);
    return host === root || host.endsWith(`.${root}`);
  }
  return host === normalized;
}
