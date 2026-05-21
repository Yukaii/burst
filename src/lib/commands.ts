export type CommandTrustLevel = 'verified' | 'reviewed' | 'community' | 'local';

export type CommandRisk = 'low' | 'medium' | 'high';

export type CommandIcon =
  | { type: 'favicon'; host?: string }
  | { type: 'initials'; value: string }
  | { type: 'emoji'; value: string }
  | { type: 'url'; src: string }
  | { type: 'asset'; src: string };

export type BurstCommand = {
  id: string;
  title: string;
  description: string;
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
  pinned?: boolean;
  shortcut?: string;
  action?: 'open-dashboard' | 'open-installed' | 'create-local-script' | 'run-local-script';
  localScriptId?: string;
};

export const registryCommands: BurstCommand[] = [];

export const managementCommands: BurstCommand[] = [
  {
    id: 'burst-install-script',
    title: 'Install script from registry',
    description: 'Open the local install manager.',
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
    icon: { type: 'emoji', value: '↓' },
    shortcut: 'B I',
    action: 'open-dashboard',
  },
  {
    id: 'burst-open-dashboard',
    title: 'Manage installed scripts',
    description: 'Open the local Burst dashboard.',
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
    icon: { type: 'initials', value: 'B' },
    shortcut: 'B M',
    action: 'open-dashboard',
  },
  {
    id: 'burst-create-local-script',
    title: 'Create local script',
    description: 'Open the editor with a new local command.',
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
    icon: { type: 'emoji', value: '+' },
    shortcut: 'B N',
    action: 'create-local-script',
  },
  {
    id: 'burst-list-installed',
    title: 'List installed scripts',
    description: 'Review enabled scripts and their website matches.',
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
    icon: { type: 'emoji', value: '≡' },
    shortcut: 'B L',
    action: 'open-installed',
  },
];

export function getCommandIconLabel(command: BurstCommand): string {
  if (command.icon.type === 'initials' || command.icon.type === 'emoji') return command.icon.value;
  return command.publisher.avatarInitials;
}

export function getCommandIconUrl(command: BurstCommand): string | undefined {
  if (command.icon.type === 'url' || command.icon.type === 'asset') return command.icon.src;
  if (command.icon.type === 'favicon') {
    const host = command.icon.host ?? command.website;
    if (host === 'all sites' || host === 'Burst') return undefined;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  }

  return undefined;
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

export function orderPaletteCommands(commands: BurstCommand[]): BurstCommand[] {
  return [...commands].sort((a, b) => {
    const localScriptDelta = Number(Boolean(b.localScriptId)) - Number(Boolean(a.localScriptId));
    if (localScriptDelta !== 0) return localScriptDelta;
    return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  });
}
