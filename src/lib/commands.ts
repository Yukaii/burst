export type CommandTrustLevel = 'verified' | 'reviewed' | 'community' | 'local';

export type CommandRisk = 'low' | 'medium' | 'high';

export type CommandIcon =
  | { type: 'favicon'; host?: string }
  | { type: 'initials'; value: string }
  | { type: 'emoji'; value: string }
  | { type: 'url'; src: string }
  | { type: 'asset'; src: string }
  | { type: 'lucide'; name: string };

export type BurstListAction = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: CommandIcon;
  style?: 'default' | 'destructive';
};

export type BurstListItem = {
  id: string;
  title: string;
  subtitle?: string;
  accessories?: string[];
  keywords?: string[];
  icon?: CommandIcon;
  actions?: BurstListAction[];
};

export type BurstCustomList = {
  id: string;
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  emptyState?: string;
  items: BurstListItem[];
};

export type BurstCommand = {
  id: string;
  title: string;
  description: string;
  subtitle?: string;
  website: string;
  matchPatterns: string[];
  publisher: {
    name: string;
    handle: string;
    avatarInitials: string;
  };
  trustLevel: CommandTrustLevel;
  risk: CommandRisk;
  permissions: string[];
  sourceUrl: string;
  installs: number;
  rating: number;
  icon: CommandIcon;
  code?: string;
  version?: string;
  status?: 'enabled' | 'disabled';
  pinned?: boolean;
  registryInstalled?: boolean;
  shortcut?: string;
  action?: 'open-dashboard' | 'open-installed' | 'create-local-script' | 'open-registry-store' | 'run-local-script' | 'run-registry-script' | 'install-registry-command';
  localScriptId?: string;
  registryCommandId?: string;
};

import { registryCommandsData } from './registryApi';

export const registryCommands: BurstCommand[] = registryCommandsData;

export const managementCommands: BurstCommand[] = [
  {
    id: 'burst-install-script',
    title: 'Install script from registry',
    description: 'Search installable commands from the Burst registry.',
    subtitle: 'Store',
    website: 'Burst',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Burst',
      handle: '@local',
      avatarInitials: 'B',
    },
    trustLevel: 'local',
    risk: 'medium',
    permissions: ['Extension storage'],
    sourceUrl: 'burst://dashboard/install',
    installs: 0,
    rating: 0,
    icon: { type: 'lucide', name: 'Search' },
    action: 'open-registry-store',
  },
  {
    id: 'burst-open-dashboard',
    title: 'Manage installed scripts',
    description: 'Open the local Burst dashboard.',
    subtitle: 'Dashboard',
    website: 'Burst',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Burst',
      handle: '@local',
      avatarInitials: 'B',
    },
    trustLevel: 'local',
    risk: 'low',
    permissions: ['Extension page'],
    sourceUrl: 'burst://dashboard',
    installs: 0,
    rating: 0,
    icon: { type: 'lucide', name: 'SlidersHorizontal' },
    action: 'open-dashboard',
  },
  {
    id: 'burst-create-local-script',
    title: 'Create local script',
    description: 'Open the editor with a new local command.',
    subtitle: 'New command',
    website: 'Burst',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Burst',
      handle: '@local',
      avatarInitials: 'B',
    },
    trustLevel: 'local',
    risk: 'medium',
    permissions: ['Extension storage', 'Page runtime after install'],
    sourceUrl: 'burst://dashboard/new',
    installs: 0,
    rating: 0,
    icon: { type: 'lucide', name: 'Plus' },
    action: 'create-local-script',
  },
  {
    id: 'burst-list-installed',
    title: 'List installed scripts',
    description: 'Review enabled scripts and their website matches.',
    subtitle: 'Installed scripts',
    website: 'Burst',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Burst',
      handle: '@local',
      avatarInitials: 'B',
    },
    trustLevel: 'local',
    risk: 'low',
    permissions: ['Extension storage'],
    sourceUrl: 'burst://dashboard/installed',
    installs: 0,
    rating: 0,
    icon: { type: 'lucide', name: 'Folder' },
    action: 'open-installed',
  },
];

export function getCommandIconLabel(command: BurstCommand): string {
  if (command.icon.type === 'initials' || command.icon.type === 'emoji') return command.icon.value;
  if (command.icon.type === 'lucide') return command.icon.name.slice(0, 2).toUpperCase();
  return command.publisher.avatarInitials;
}

export function getCommandIconUrl(command: BurstCommand): string | undefined {
  if (command.icon.type === 'url' || command.icon.type === 'asset') return command.icon.src;
  if (command.icon.type === 'favicon') {
    const host = command.icon.host ?? command.website;
    if (host === 'all sites' || host === 'Burst') return undefined;
    return getFaviconUrl(host);
  }

  return undefined;
}

export function getFaviconUrl(host: string): string | undefined {
  const normalizedHost = host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!normalizedHost || normalizedHost === 'all sites' || normalizedHost === 'Burst') return undefined;
  return `https://${normalizedHost}/favicon.ico`;
}

export function getHostFromUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'this site';
  }
}

export function commandMatchesHost(command: BurstCommand, host: string): boolean {
  if (command.matchPatterns.includes('<all_urls>')) return true;
  return command.matchPatterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/^(\*:\/\/)?(www\.)?/, '');
    const [patternHost] = normalizedPattern.split('/');
    return host === patternHost || host.endsWith(`.${patternHost}`);
  });
}

export function searchCommands(commands: BurstCommand[], query: string): BurstCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands;

  return commands.filter((command) => {
    const searchable = [
      command.title,
      command.description,
      command.subtitle,
      command.website,
      command.publisher.name,
      command.publisher.handle,
      command.trustLevel,
      command.risk,
      ...command.permissions,
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(normalized);
  });
}

export function searchListItems(items: BurstListItem[], query: string): BurstListItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) => {
    const searchable = [
      item.title,
      item.subtitle,
      ...(item.accessories ?? []),
      ...(item.keywords ?? []),
      ...(item.actions ?? []).flatMap((action) => [action.title, action.subtitle]),
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(normalized);
  });
}

export function orderPaletteCommands(commands: BurstCommand[]): BurstCommand[] {
  return [...commands].sort((a, b) => {
    const localScriptDelta = Number(Boolean(b.localScriptId)) - Number(Boolean(a.localScriptId));
    if (localScriptDelta !== 0) return localScriptDelta;
    return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  });
}
