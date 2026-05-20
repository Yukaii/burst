export type CommandTrustLevel = 'verified' | 'reviewed' | 'community' | 'local';

export type CommandRisk = 'low' | 'medium' | 'high';

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
  pinned?: boolean;
  shortcut?: string;
};

export const seedCommands: BurstCommand[] = [
  {
    id: 'github-pr-summary',
    title: 'Summarize pull request',
    description: 'Collect changed files, review comments, and CI status into a short handoff.',
    website: 'github.com',
    matchPatterns: ['github.com/*/pull/*'],
    publisher: {
      name: 'Burst Labs',
      handle: '@burst',
      avatarInitials: 'BL',
    },
    trustLevel: 'verified',
    risk: 'low',
    permissions: ['Read page DOM', 'Read selected text'],
    sourceUrl: 'https://github.com/burst-registry/github-pr-summary',
    installs: 18420,
    rating: 4.9,
    pinned: true,
    shortcut: 'G P',
  },
  {
    id: 'linear-issue-template',
    title: 'Create issue from page',
    description: 'Turn the current page, selected text, and screenshot context into a Linear issue draft.',
    website: 'linear.app',
    matchPatterns: ['linear.app/*'],
    publisher: {
      name: 'Mina Park',
      handle: '@mina',
      avatarInitials: 'MP',
    },
    trustLevel: 'reviewed',
    risk: 'medium',
    permissions: ['Read page DOM', 'Capture visible tab', 'Connect to Linear'],
    sourceUrl: 'https://github.com/minapark/linear-page-capture',
    installs: 6210,
    rating: 4.7,
    pinned: true,
    shortcut: 'L I',
  },
  {
    id: 'notion-save-highlight',
    title: 'Save highlight to Notion',
    description: 'Append selected text and source metadata to a configured Notion database.',
    website: 'all sites',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Open Usecases',
      handle: '@openuse',
      avatarInitials: 'OU',
    },
    trustLevel: 'community',
    risk: 'medium',
    permissions: ['Read selected text', 'Connect to Notion'],
    sourceUrl: 'https://github.com/openuse/notion-highlight',
    installs: 9820,
    rating: 4.5,
    shortcut: 'N S',
  },
  {
    id: 'shopify-copy-sku',
    title: 'Copy product SKU bundle',
    description: 'Extract product title, SKU, price, and variants from Shopify admin pages.',
    website: 'admin.shopify.com',
    matchPatterns: ['admin.shopify.com/store/*/products/*'],
    publisher: {
      name: 'Retail Ops Guild',
      handle: '@retailops',
      avatarInitials: 'RO',
    },
    trustLevel: 'reviewed',
    risk: 'low',
    permissions: ['Read page DOM', 'Write clipboard'],
    sourceUrl: 'https://github.com/retailops/shopify-sku-bundle',
    installs: 3380,
    rating: 4.8,
  },
  {
    id: 'gmail-clean-thread',
    title: 'Draft concise reply',
    description: 'Use the current email thread and selected notes to draft a concise response.',
    website: 'mail.google.com',
    matchPatterns: ['mail.google.com/mail/*'],
    publisher: {
      name: 'Ari Chen',
      handle: '@arichen',
      avatarInitials: 'AC',
    },
    trustLevel: 'community',
    risk: 'high',
    permissions: ['Read page DOM', 'Read private message content', 'Network request'],
    sourceUrl: 'https://github.com/arichen/gmail-clean-thread',
    installs: 1420,
    rating: 4.2,
  },
];

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
