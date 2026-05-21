import type { BurstCommand } from './commands';
import { analyzeScriptCode } from './staticAnalysis';

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
    signature: { status: 'pass' | 'warning' | 'fail'; detail: string };
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
      signature: { status: 'pass', detail: 'Cryptographic signature verified against verified publisher @burst-examples key. Manifest integrity matches package source.' },
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
      signature: { status: 'pass', detail: 'Cryptographic signature verified against verified publisher @schen key. Manifest integrity matches package source.' },
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
      signature: { status: 'warning', detail: 'Community package signature is self-signed/unverified. Review manifest content before installing.' },
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
      signature: { status: 'warning', detail: 'Self-signed package signature. Code integrity verified against git commit hash.' },
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
      signature: { status: 'pass', detail: 'Cryptographic signature verified against verified publisher @schen key. Manifest integrity matches package source.' },
    },
    summary: 'A completely local formatter command. Passes all security checks.',
  },
};

export const mockPublisherProfiles: Record<string, PublisherProfile> = {
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

export const publishedScriptCodes = new Map<string, string>();

export function getMockScriptCode(commandId: string): string {
  if (publishedScriptCodes.has(commandId)) {
    return publishedScriptCodes.get(commandId)!;
  }
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
  // Send data to summary service
  await fetch('https://api.burst.dev/summarize', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
  toast('HN Thread Summary: ' + text.substring(0, 50) + '...');
}`;
    case 'tailwind-css-exporter':
      return `export default async function run({ toast }) {
  // Obfuscated/minified layout helper simulation
  const _0x1a2b = ["\x54\x61\x69\x6c\x77\x69\x6e\x64", "\x65\x78\x70\x6f\x72\x74"];
  toast('Exported ' + _0x1a2b[0] + ' ' + _0x1a2b[1]);
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

// Detect CLI environment
const isCliTest = typeof window === 'undefined' || (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.TEST === 'true'));

// In non-CLI browser contexts (like extension dashboard running at chrome-extension://... or similar),
// API requests must target the local registry website running on http://localhost:5174.
const isRegistryHost = typeof window !== 'undefined' && (window.location.host === 'localhost:5174' || window.location.host === 'localhost:5175');
const API_BASE = isRegistryHost ? '' : 'http://localhost:5174';

export async function getRegistryCommands(query = ''): Promise<BurstCommand[]> {
  if (isCliTest) {
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
  const origin = API_BASE || window.location.origin;
  const url = new URL('/api/commands', origin);
  if (query) {
    url.searchParams.set('q', query);
  }
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch registry commands');
  return response.json();
}

export async function getRegistryCommand(id: string): Promise<BurstCommand | undefined> {
  if (isCliTest) {
    return registryCommandsData.find((command) => command.id === id);
  }
  const response = await fetch(`${API_BASE}/api/commands/${encodeURIComponent(id)}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Failed to fetch registry command');
  return response.json();
}

export async function getAuditReport(id: string, version: string): Promise<AuditReport | undefined> {
  if (isCliTest) {
    const cmd = registryCommandsData.find((c) => c.id === id);
    if (!cmd) return undefined;

    const code = getMockScriptCode(id);
    const report = analyzeScriptCode(code, cmd.matchPatterns);

    const publisherProfile = mockPublisherProfiles[cmd.publisher.handle];
    const isVerified = publisherProfile?.verified ?? false;

    return {
      commandId: id,
      version,
      auditedAt: '2026-05-20',
      status: report.status,
      checks: {
        ...report.checks,
        signature: {
          status: isVerified ? 'pass' : 'warning',
          detail: isVerified
            ? `Cryptographic signature verified against verified publisher ${cmd.publisher.handle} key. Manifest integrity matches package source.`
            : `Community package signature is self-signed/unverified. Review manifest content before installing.`,
        },
      },
      summary: report.summary,
    };
  }
  const response = await fetch(`${API_BASE}/api/commands/${encodeURIComponent(id)}/audit?v=${encodeURIComponent(version)}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Failed to fetch audit report');
  return response.json();
}

export async function getPublisherProfile(handle: string): Promise<PublisherProfile | undefined> {
  if (isCliTest) {
    return mockPublisherProfiles[handle];
  }
  const response = await fetch(`${API_BASE}/api/publishers/${encodeURIComponent(handle)}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Failed to fetch publisher profile');
  return response.json();
}

export async function getCurrentUser(): Promise<{ handle: string; name: string; avatarInitials: string }> {
  if (isCliTest) {
    return mockProfiles[0];
  }
  const response = await fetch(`${API_BASE}/api/auth/me`);
  if (!response.ok) throw new Error('Failed to fetch current user');
  return response.json();
}

export async function loginSimulatedUser(handle: string): Promise<{ ok: boolean; user: { handle: string; name: string; avatarInitials: string } }> {
  if (isCliTest) {
    const profile = mockProfiles.find((p) => p.handle === handle) || mockProfiles[0];
    return { ok: true, user: profile };
  }
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  });
  if (!response.ok) throw new Error('Failed to login');
  return response.json();
}

export async function logout(): Promise<{ ok: boolean }> {
  if (isCliTest) {
    return { ok: true };
  }
  const response = await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to logout');
  return response.json();
}

export async function publishCommand(payload: any): Promise<BurstCommand> {
  if (isCliTest) {
    const newCmd = {
      ...payload,
      installs: 0,
      rating: 5.0,
      icon: payload.icon || { type: 'initials', value: payload.title.substring(0, 2).toUpperCase() },
    };
    return newCmd;
  }
  const response = await fetch(`${API_BASE}/api/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to publish command' }));
    throw new Error(err.error || 'Failed to publish command');
  }
  return response.json();
}
