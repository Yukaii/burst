import type { BurstCommand } from './commands';

export type AuditReport = {
  commandId: string;
  version: string;
  auditedAt: string;
  status: 'pass' | 'warning' | 'fail';
  checks: {
    hostScope: { status: 'pass' | 'warning' | 'fail'; detail: string };
    permissions: { status: 'pass' | 'warning' | 'fail'; detail: string };
    remoteCode: { status: 'pass' | 'warning' | 'fail'; detail: string };
    networkAccess: { status: 'pass' | 'warning' | 'fail'; detail: string };
    obfuscation: { status: 'pass' | 'warning' | 'fail'; detail: string };
  };
  summary: string;
};

export type PublisherProfile = {
  name: string;
  handle: string;
  avatarInitials: string;
  verified: boolean;
  verifiedSources: string[];
  publishedCommandsCount: number;
  joinedAt: string;
  bio: string;
};

export const registryCommandsData: BurstCommand[] = [
  {
    id: 'copy-github-branch',
    title: 'Copy GitHub branch name',
    description: 'Copies the active GitHub branch name to the clipboard.',
    website: 'github.com',
    matchPatterns: ['github.com/*'],
    publisher: {
      name: 'Burst Examples',
      handle: '@burst-examples',
      avatarInitials: 'BE',
    },
    trustLevel: 'verified',
    risk: 'medium',
    permissions: ['Read page DOM', 'Write clipboard'],
    sourceUrl: 'https://github.com/burst/examples/tree/main/copy-github-branch',
    installs: 1450,
    rating: 4.8,
    icon: { type: 'favicon', host: 'github.com' },
  },
  {
    id: 'markdown-link-builder',
    title: 'Copy as Markdown link',
    description: 'Copies the current page title and URL as a formatted Markdown link.',
    website: 'all sites',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Sarah Chen',
      handle: '@schen',
      avatarInitials: 'SC',
    },
    trustLevel: 'verified',
    risk: 'low',
    permissions: ['Read page DOM', 'Write clipboard'],
    sourceUrl: 'https://github.com/schen/burst-plugins/tree/main/markdown-link',
    installs: 4230,
    rating: 4.9,
    icon: { type: 'emoji', value: '🔗' },
  },
  {
    id: 'hn-comments-summarizer',
    title: 'Summarize Hacker News thread',
    description: 'Fetches comments from the active Hacker News thread and builds a summary.',
    website: 'news.ycombinator.com',
    matchPatterns: ['news.ycombinator.com/item*'],
    publisher: {
      name: 'HN PowerUser',
      handle: '@hn-power',
      avatarInitials: 'HN',
    },
    trustLevel: 'reviewed',
    risk: 'medium',
    permissions: ['Read page DOM', 'Write clipboard', 'Network access to api.burst.dev'],
    sourceUrl: 'https://github.com/hn-power/burst-tools/tree/main/hn-summarizer',
    installs: 890,
    rating: 4.5,
    icon: { type: 'favicon', host: 'news.ycombinator.com' },
  },
  {
    id: 'tailwind-css-exporter',
    title: 'Tailwind CSS Exporter',
    description: 'Extracts the Tailwind HTML snippet under the cursor and copies it to clipboard.',
    website: 'tailwindplay.com',
    matchPatterns: ['play.tailwindcss.com/*'],
    publisher: {
      name: 'Burst Examples',
      handle: '@burst-examples',
      avatarInitials: 'BE',
    },
    trustLevel: 'community',
    risk: 'medium',
    permissions: ['Read page DOM', 'Write clipboard'],
    sourceUrl: 'https://github.com/burst/examples/tree/main/tailwind-exporter',
    installs: 320,
    rating: 4.2,
    icon: { type: 'initials', value: 'TW' },
  },
  {
    id: 'json-formatter-toast',
    title: 'Format Selected JSON',
    description: 'Parses the selected text as JSON, formats it, and displays a formatted snippet in a toast.',
    website: 'all sites',
    matchPatterns: ['<all_urls>'],
    publisher: {
      name: 'Sarah Chen',
      handle: '@schen',
      avatarInitials: 'SC',
    },
    trustLevel: 'verified',
    risk: 'low',
    permissions: ['Read selection', 'Toast alerts'],
    sourceUrl: 'https://github.com/schen/burst-plugins/tree/main/json-formatter',
    installs: 1540,
    rating: 4.7,
    icon: { type: 'emoji', value: '📄' },
  },
];

const mockAuditReports: Record<string, AuditReport> = {
  'copy-github-branch': {
    commandId: 'copy-github-branch',
    version: '0.1.0',
    auditedAt: '2026-05-18',
    status: 'pass',
    checks: {
      hostScope: { status: 'pass', detail: 'Matches only github.com/*, matching the declared functionality.' },
      permissions: { status: 'pass', detail: 'Requests Read page DOM and Write clipboard, which align with branch copying.' },
      remoteCode: { status: 'pass', detail: 'Zero external script dependencies. All source execution is local.' },
      networkAccess: { status: 'pass', detail: 'No external HTTP request or tracking calls detected.' },
      obfuscation: { status: 'pass', detail: 'Bundle is readable and variables are non-obfuscated.' },
    },
    summary: 'This command passes all static analysis rules. The host scope is narrow, permissions are justified, and code is fully transparent.',
  },
  'markdown-link-builder': {
    commandId: 'markdown-link-builder',
    version: '1.0.2',
    auditedAt: '2026-05-19',
    status: 'pass',
    checks: {
      hostScope: { status: 'pass', detail: 'Properly declares global utility scope <all_urls> for generating links.' },
      permissions: { status: 'pass', detail: 'Requests standard document details and navigator clipboard writes.' },
      remoteCode: { status: 'pass', detail: 'Static code build contains zero remote script loading.' },
      networkAccess: { status: 'pass', detail: 'No network request calls are present in the package source.' },
      obfuscation: { status: 'pass', detail: 'Plain text bundle with clean module exports.' },
    },
    summary: 'A clean global utility command. Fully audited and recommended for general use.',
  },
  'hn-comments-summarizer': {
    commandId: 'hn-comments-summarizer',
    version: '0.5.1',
    auditedAt: '2026-05-15',
    status: 'warning',
    checks: {
      hostScope: { status: 'pass', detail: 'Properly restricted to news.ycombinator.com/item* thread view.' },
      permissions: { status: 'warning', detail: 'Requests Network Access to api.burst.dev to summarize comments. Use with caution.' },
      remoteCode: { status: 'pass', detail: 'Source code does not use eval() or load any third-party external scripts.' },
      networkAccess: { status: 'warning', detail: 'Makes POST requests to api.burst.dev containing thread contents.' },
      obfuscation: { status: 'pass', detail: 'Webpack build is cleanly formatted; verified main logic is clear.' },
    },
    summary: 'Matches host scope but performs outgoing network requests to pass comment data to a summary backend. Verify backend data processing privacy before using.',
  },
  'tailwind-css-exporter': {
    commandId: 'tailwind-css-exporter',
    version: '0.2.0',
    auditedAt: '2026-05-12',
    status: 'warning',
    checks: {
      hostScope: { status: 'pass', detail: 'Scoped strictly to play.tailwindcss.com/*.' },
      permissions: { status: 'pass', detail: 'Requests page DOM reading and clipboard write permissions.' },
      remoteCode: { status: 'pass', detail: 'No dynamic imports or eval structures.' },
      networkAccess: { status: 'pass', detail: 'No network calls present.' },
      obfuscation: { status: 'warning', detail: 'Source uses minified internal DOM helper libraries. Recommended review of git source.' },
    },
    summary: 'Main code is clean, but relies on a minified selector utility helper. Recommended to inspect original GitHub source code before running.',
  },
  'json-formatter-toast': {
    commandId: 'json-formatter-toast',
    version: '1.2.0',
    auditedAt: '2026-05-20',
    status: 'pass',
    checks: {
      hostScope: { status: 'pass', detail: 'Requires global <all_urls> to format selected snippets anywhere.' },
      permissions: { status: 'pass', detail: 'Requires selected text and toast displays. No DOM write capability.' },
      remoteCode: { status: 'pass', detail: 'No remote libraries or dynamic code blocks.' },
      networkAccess: { status: 'pass', detail: 'No external connections.' },
      obfuscation: { status: 'pass', detail: 'Source is completely non-obfuscated.' },
    },
    summary: 'A completely local formatter command. Passes all security checks.',
  },
};

const mockPublisherProfiles: Record<string, PublisherProfile> = {
  '@burst-examples': {
    name: 'Burst Examples',
    handle: '@burst-examples',
    avatarInitials: 'BE',
    verified: true,
    verifiedSources: ['github.com/burst/examples'],
    publishedCommandsCount: 2,
    joinedAt: '2026-04-01',
    bio: 'Official open-source command examples maintained by the Burst Core Team.',
  },
  '@schen': {
    name: 'Sarah Chen',
    handle: '@schen',
    avatarInitials: 'SC',
    verified: true,
    verifiedSources: ['github.com/schen', 'sarahchen.dev'],
    publishedCommandsCount: 2,
    joinedAt: '2026-04-10',
    bio: 'Frontend engineer & developer experience enthusiast. Building productivity scripts for web workflows.',
  },
  '@hn-power': {
    name: 'HN PowerUser',
    handle: '@hn-power',
    avatarInitials: 'HN',
    verified: false,
    verifiedSources: [],
    publishedCommandsCount: 1,
    joinedAt: '2026-05-02',
    bio: 'Avid Hacker News reader. Automating social news interfaces and thread reading.',
  },
};

export const mockProfiles = [
  { handle: 'guest', name: 'Guest User', avatarInitials: 'G' },
  { handle: '@schen', name: 'Sarah Chen', avatarInitials: 'SC' },
  { handle: '@hn-power', name: 'HN PowerUser', avatarInitials: 'HN' },
];

export function getMockScriptCode(commandId: string): string {
  switch (commandId) {
    case 'copy-github-branch':
      return `export default async function run({ page, toast }) {
  const branch = page.querySelector('[data-icv-name="Switch branches/tags"]')?.textContent?.trim() || 'main';
  await navigator.clipboard.writeText(branch);
  toast('Copied branch: ' + branch);
}`;
    case 'markdown-link-builder':
      return `export default async function run({ title, url, toast }) {
  const link = \`[\${title}](\${url})\`;
  await navigator.clipboard.writeText(link);
  toast('Copied Markdown link: ' + link);
}`;
    case 'hn-comments-summarizer':
      return `export default async function run({ page, toast }) {
  const commentNode = page.querySelector('.comment');
  const text = commentNode?.textContent?.trim() || 'No comments found';
  toast('HN Thread Summary: ' + text.substring(0, 50) + '...');
}`;
    case 'tailwind-css-exporter':
      return `export default async function run({ toast }) {
  toast('Exported Tailwind CSS elements');
}`;
    case 'json-formatter-toast':
      return `export default async function run({ selection, toast }) {
  try {
    const formatted = JSON.stringify(JSON.parse(selection), null, 2);
    toast('JSON: ' + formatted.substring(0, 40) + '...');
  } catch (e) {
    toast('Select valid JSON text first');
  }
}`;
    default:
      return `export default async function run({ toast }) {
  toast('Running command ' + ${JSON.stringify(commandId)});
}`;
  }
}

// Simulated network delay helper
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export async function getRegistryCommands(query = ''): Promise<BurstCommand[]> {
  await delay(150);
  const normalized = query.trim().toLowerCase();
  if (!normalized) return registryCommandsData;

  return registryCommandsData.filter((command) => {
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

export async function getRegistryCommand(id: string): Promise<BurstCommand | undefined> {
  await delay(100);
  return registryCommandsData.find((command) => command.id === id);
}

export async function getAuditReport(id: string, version: string): Promise<AuditReport | undefined> {
  await delay(120);
  const report = mockAuditReports[id];
  if (report) {
    return { ...report, version };
  }
  return undefined;
}

export async function getPublisherProfile(handle: string): Promise<PublisherProfile | undefined> {
  await delay(100);
  return mockPublisherProfiles[handle];
}
