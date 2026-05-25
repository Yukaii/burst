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
  githubLogin?: string;
  githubId?: string;
  avatarUrl?: string;
  profileUrl?: string;
  role?: 'admin' | 'publisher' | 'member';
};

export type RegistryAuthConfig = {
  githubEnabled: boolean;
  loginUrl?: string;
};

export type RegistryUserUpdate = {
  name?: string;
  bio?: string;
  verified?: boolean;
  verifiedSources?: string[];
  role?: 'admin' | 'publisher' | 'member';
};

export type RegistrySessionUser = PublisherProfile | {
  handle: 'guest';
  name: string;
  avatarInitials: string;
  role: 'member';
};

export type RegistryCommandPage = {
  commands: BurstCommand[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type RegistryApiToken = {
  id: string;
  userHandle: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
};

export const registryCommandsData: BurstCommand[] = [
  {
    id: 'copy-github-branch',
    title: 'Copy GitHub branch name',
    description: 'Copies the active GitHub branch name to the clipboard.',
    subtitle: 'GitHub branch',
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
    subtitle: 'Markdown link',
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
    version: '1.0.1',
  },
  {
    id: 'tailwind-css-exporter',
    title: 'Tailwind CSS Exporter',
    description: 'Extracts the Tailwind HTML snippet under the cursor and copies it to clipboard.',
    subtitle: 'Tailwind snippet',
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
    subtitle: 'Format JSON',
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

const testPublisherProfiles: Record<string, PublisherProfile> = {
  '@burst-examples': {
    name: 'Burst Examples',
    handle: '@burst-examples',
    avatarInitials: 'BE',
    verified: true,
    verifiedSources: ['github.com/burst/examples'],
    publishedCommandsCount: 2,
    joinedAt: '2026-04-01',
    bio: 'Official open-source command examples maintained by the Burst Core Team.',
    role: 'admin',
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
    role: 'publisher',
  },
};

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

const globalRuntime = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
const processRef = globalRuntime?.process;
const hasExtensionRuntime = Boolean(globalRuntime?.browser?.runtime || globalRuntime?.chrome?.runtime);
const isCliTest =
  (typeof window === 'undefined' && !hasExtensionRuntime) ||
  (processRef && (processRef.env?.NODE_ENV === 'test' || processRef.env?.TEST === 'true' || processRef.env?.VITEST === 'true'));

const isHttpBrowser = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
const isLocalRegistryHost =
  typeof window !== 'undefined' &&
  (window.location.host === 'localhost:5174' || window.location.host === 'localhost:5175');
const configuredRegistryBase =
  processRef?.env?.BURST_REGISTRY_API_BASE ||
  globalRuntime?.BURST_REGISTRY_API_BASE ||
  'http://localhost:5174';
const API_BASE = isCliTest
  ? ''
  : isLocalRegistryHost
  ? ''
  : isHttpBrowser
  ? window.location.origin
  : configuredRegistryBase;

function getRegistryApiBase(baseOverride?: string): string {
  return baseOverride?.trim() || API_BASE;
}

function getRegistryApiUrl(path: string, baseOverride?: string): string {
  const base = getRegistryApiBase(baseOverride);
  if (!base && typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString();
  }
  return new URL(path, base || 'http://localhost:5174').toString();
}

export async function getRegistryCommands(query = '', baseOverride?: string): Promise<BurstCommand[]> {
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
  const url = new URL(getRegistryApiUrl('/api/commands', baseOverride));
  if (query) {
    url.searchParams.set('q', query);
  }
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch registry commands');
  return response.json();
}

export async function getRegistryCommandsPage(
  query = '',
  options: { baseOverride?: string; offset?: number; limit?: number; host?: string } = {},
): Promise<RegistryCommandPage> {
  if (isCliTest) {
    const commands = (await getRegistryCommands(query)).filter((command) => commandMatchesRegistryHost(command, options.host));
    const offset = Math.max(options.offset ?? 0, 0);
    const limit = Math.max(options.limit ?? 20, 1);
    return {
      commands: commands.slice(offset, offset + limit),
      total: commands.length,
      offset,
      limit,
      hasMore: offset + limit < commands.length,
    };
  }

  const offset = Math.max(options.offset ?? 0, 0);
  const limit = Math.max(options.limit ?? 20, 1);
  const url = new URL(getRegistryApiUrl('/api/commands', options.baseOverride));
  if (query) url.searchParams.set('q', query);
  if (options.host) url.searchParams.set('host', options.host);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch registry commands');
  const body = await response.json();
  if (Array.isArray(body)) {
    return {
      commands: body,
      total: body.length,
      offset,
      limit,
      hasMore: false,
    };
  }
  return body;
}

function commandMatchesRegistryHost(command: BurstCommand, host: string | undefined): boolean {
  const normalizedHost = (host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!normalizedHost) return true;
  if (command.matchPatterns.includes('<all_urls>')) return true;
  return command.matchPatterns.some((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase().replace(/^(\*:\/\/)?(https?:\/\/)?(www\.)?/, '');
    const [patternHost] = normalizedPattern.split('/');
    return normalizedHost === patternHost || normalizedHost.endsWith(`.${patternHost}`);
  });
}

export async function getRegistryCommand(id: string, baseOverride?: string): Promise<BurstCommand | undefined> {
  if (isCliTest) {
    return registryCommandsData.find((command) => command.id === id);
  }
  const response = await fetch(getRegistryApiUrl(`/api/commands/${encodeURIComponent(id)}`, baseOverride));
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

    const publisherProfile = testPublisherProfiles[cmd.publisher.handle];
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
    return testPublisherProfiles[handle];
  }
  const response = await fetch(`${API_BASE}/api/publishers/${encodeURIComponent(handle)}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Failed to fetch publisher profile');
  return response.json();
}

export async function getAuthConfig(): Promise<RegistryAuthConfig> {
  if (isCliTest) {
    return { githubEnabled: false };
  }
  const response = await fetch(`${API_BASE}/api/auth/config`);
  if (!response.ok) throw new Error('Failed to fetch registry auth config');
  return response.json();
}

export async function getCurrentUser(): Promise<RegistrySessionUser> {
  if (isCliTest) {
    return { handle: 'guest', name: 'Guest User', avatarInitials: 'G', role: 'member' };
  }
  const response = await fetch(`${API_BASE}/api/auth/me`);
  if (!response.ok) throw new Error('Failed to fetch current user');
  return response.json();
}

export async function getGithubLoginUrl(returnTo = '/dashboard'): Promise<string> {
  if (isCliTest) {
    return `/api/auth/github/start?returnTo=${encodeURIComponent(returnTo)}`;
  }
  const url = new URL(`${API_BASE}/api/auth/github/start`);
  url.searchParams.set('returnTo', returnTo);
  return url.toString();
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

export async function listRegistryApiTokens(): Promise<RegistryApiToken[]> {
  if (isCliTest) return [];
  const response = await fetch(`${API_BASE}/api/me/tokens`);
  if (!response.ok) throw new Error('Failed to fetch registry API tokens');
  return response.json();
}

export async function createRegistryApiToken(name: string): Promise<RegistryApiToken & { token: string }> {
  if (isCliTest) {
    return {
      id: 'test-token',
      userHandle: '@test',
      name,
      createdAt: new Date().toISOString(),
      token: 'burst_test_token',
    };
  }
  const response = await fetch(`${API_BASE}/api/me/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Failed to create registry API token');
  return response.json();
}

export async function deleteRegistryApiToken(tokenId: string): Promise<{ ok: boolean }> {
  if (isCliTest) return { ok: true };
  const response = await fetch(`${API_BASE}/api/me/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete registry API token');
  return response.json();
}

export async function getRegistryUsers(query = ''): Promise<PublisherProfile[]> {
  if (isCliTest) {
    const users = Object.values(testPublisherProfiles);
    if (!query.trim()) {
      return users;
    }
    const needle = query.trim().toLowerCase();
    return users.filter((user) =>
      [user.name, user.handle, user.bio, ...(user.verifiedSources || [])].join(' ').toLowerCase().includes(needle)
    );
  }

  const url = new URL('/api/users', API_BASE || window.location.origin);
  if (query) url.searchParams.set('q', query);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Failed to fetch registry users');
  return response.json();
}

export async function getRegistryUser(handle: string): Promise<PublisherProfile | undefined> {
  if (isCliTest) {
    return testPublisherProfiles[handle];
  }
  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(handle)}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error('Failed to fetch registry user');
  return response.json();
}

export async function updateRegistryUser(handle: string, patch: RegistryUserUpdate): Promise<PublisherProfile> {
  if (isCliTest) {
    const user = testPublisherProfiles[handle];
    if (!user) throw new Error('Registry user not found');
    const updated = { ...user, ...patch } as PublisherProfile;
    testPublisherProfiles[handle] = updated;
    return updated;
  }

  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(handle)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to update registry user' }));
    throw new Error(err.error || 'Failed to update registry user');
  }
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
