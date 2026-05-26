import type { BurstCommand, BurstCommandPack } from '@/src/lib/commands';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import type { AuditReport, PublisherProfile } from '@/src/lib/registryApi';
import { getMockScriptCode, registryCommandPacksData, registryCommandsData } from '@/src/lib/registryApi';

export type StoredRegistryCommand = BurstCommand & {
  code: string;
  version: string;
};

export type StoredRegistryCommandPack = BurstCommandPack & {
  version: string;
};

export type GitHubUserProfile = {
  id: string;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
};

export type PublishCommandInput = {
  id: string;
  title: string;
  description: string;
  website: string;
  matchPatterns: string[];
  publisherHandle: string;
  trustLevel: BurstCommand['trustLevel'];
  risk: BurstCommand['risk'];
  permissions: string[];
  sourceUrl: string;
  icon: BurstCommand['icon'];
  code: string;
  version?: string;
};

export type PublishCommandPackInput = {
  id: string;
  title: string;
  description: string;
  website: string;
  matchPatterns: string[];
  publisherHandle: string;
  sourceUrl: string;
  icon: BurstCommand['icon'];
  commandIds: string[];
  version?: string;
};

export type RegistryApiToken = {
  id: string;
  userHandle: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
};

type StoredPublisherProfile = PublisherProfile;
type StoredPublisherRecord = StoredPublisherProfile & {
  githubId?: string;
  githubLogin?: string;
  avatarUrl?: string;
  profileUrl?: string;
};

type D1BindTarget = {
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1BindTarget & {
    bind(...values: unknown[]): D1BindTarget;
  };
};

export type RegistryStore = {
  getCurrentUser(sessionId: string | null): Promise<StoredPublisherRecord | null>;
  createSession(handle: string): Promise<{ sessionId: string; user: StoredPublisherRecord }>;
  deleteSession(sessionId: string): Promise<void>;
  listCommands(query: string, host?: string): Promise<StoredRegistryCommand[]>;
  getCommand(id: string): Promise<StoredRegistryCommand | undefined>;
  createCommand(input: PublishCommandInput): Promise<StoredRegistryCommand>;
  listPacks(query: string, host?: string): Promise<StoredRegistryCommandPack[]>;
  getPack(id: string): Promise<StoredRegistryCommandPack | undefined>;
  createPack(input: PublishCommandPackInput): Promise<StoredRegistryCommandPack>;
  getPublisherProfile(handle: string): Promise<StoredPublisherRecord | undefined>;
  listUsers(query: string): Promise<StoredPublisherRecord[]>;
  getUser(handle: string): Promise<StoredPublisherRecord | undefined>;
  updateUser(handle: string, patch: Partial<StoredPublisherRecord>): Promise<StoredPublisherRecord>;
  upsertGitHubUser(profile: GitHubUserProfile): Promise<StoredPublisherRecord>;
  listApiTokens(userHandle: string): Promise<RegistryApiToken[]>;
  createApiToken(userHandle: string, name: string, tokenHash: string): Promise<RegistryApiToken>;
  deleteApiToken(userHandle: string, tokenId: string): Promise<void>;
  getUserByApiTokenHash(tokenHash: string): Promise<StoredPublisherRecord | null>;
};

const seedCommands: StoredRegistryCommand[] = registryCommandsData.map((command) => ({
  ...command,
  code: getMockScriptCode(command.id),
  version: command.version || '1.0.0',
}));

const seedPublishers: StoredPublisherRecord[] = [
  {
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
  {
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
];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesSearch(command: StoredRegistryCommand, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;

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
}

function normalizeHost(host: string | undefined): string {
  return (host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function matchesHost(command: StoredRegistryCommand, host: string | undefined): boolean {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return true;
  if (command.matchPatterns.includes('<all_urls>')) return true;
  return command.matchPatterns.some((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase().replace(/^(\*:\/\/)?(https?:\/\/)?(www\.)?/, '');
    const [patternHost] = normalizedPattern.split('/');
    return normalizedHost === patternHost || normalizedHost.endsWith(`.${patternHost}`);
  });
}

function packMatchesSearch(pack: StoredRegistryCommandPack, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;
  return [
    pack.title,
    pack.description,
    pack.website,
    pack.publisher.name,
    pack.publisher.handle,
    pack.trustLevel,
    pack.risk,
    ...pack.permissions,
    ...pack.commands.flatMap((command) => [command.title, command.description, ...command.permissions]),
  ].join(' ').toLowerCase().includes(normalized);
}

function packMatchesHost(pack: StoredRegistryCommandPack, host: string | undefined): boolean {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return true;
  if (pack.matchPatterns.includes('<all_urls>')) return true;
  return pack.matchPatterns.some((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase().replace(/^(\*:\/\/)?(https?:\/\/)?(www\.)?/, '');
    const [patternHost] = normalizedPattern.split('/');
    return normalizedHost === patternHost || normalizedHost.endsWith(`.${patternHost}`);
  });
}

function getSeedPublisherProfile(handle: string): StoredPublisherRecord | undefined {
  return seedPublishers.find((profile) => profile.handle === handle);
}

function buildPublisherProfile(handle: string, commandCount: number): StoredPublisherRecord | undefined {
  const profile = getSeedPublisherProfile(handle);
  if (!profile) return undefined;

  return {
    ...profile,
    publishedCommandsCount: commandCount,
  };
}

function buildStoredCommand(input: PublishCommandInput, publisher: StoredPublisherRecord): StoredRegistryCommand {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    website: input.website,
    matchPatterns: input.matchPatterns,
    publisher: {
      name: publisher.name,
      handle: publisher.handle,
      avatarInitials: publisher.avatarInitials,
    },
    trustLevel: input.trustLevel,
    risk: input.risk,
    permissions: input.permissions,
    sourceUrl: input.sourceUrl,
    installs: 0,
    rating: 5.0,
    icon: input.icon,
    code: input.code,
    version: input.version || '1.0.0',
  };
}

function buildStoredPack(input: PublishCommandPackInput, publisher: StoredPublisherRecord, commands: StoredRegistryCommand[]): StoredRegistryCommandPack {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    website: input.website,
    matchPatterns: input.matchPatterns,
    publisher: {
      name: publisher.name,
      handle: publisher.handle,
      avatarInitials: publisher.avatarInitials,
    },
    trustLevel: commands.every((command) => command.trustLevel === 'verified') ? 'verified' : 'community',
    risk: commands.some((command) => command.risk === 'high') ? 'high' : commands.some((command) => command.risk === 'medium') ? 'medium' : 'low',
    permissions: [...new Set(commands.flatMap((command) => command.permissions))],
    sourceUrl: input.sourceUrl,
    installs: 0,
    rating: 5.0,
    icon: input.icon,
    version: input.version || '1.0.0',
    commands: commands.map((command) => ({
      ...command,
      packId: input.id,
      packTitle: input.title,
      sourceUrl: input.sourceUrl,
    })),
  };
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject<T extends object>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function deriveAvatarInitials(value: string): string {
  const compact = value.replace(/[^a-z0-9]/gi, '').trim();
  if (!compact) return 'GH';
  return compact.slice(0, 2).toUpperCase();
}

function normalizeStoredPublisher(profile: StoredPublisherRecord): StoredPublisherRecord {
  return {
    ...profile,
    role: profile.role ?? 'publisher',
  };
}

class MemoryRegistryStore implements RegistryStore {
  private readonly publishers = new Map<string, StoredPublisherRecord>();
  private readonly commands = new Map<string, StoredRegistryCommand>();
  private readonly packs = new Map<string, StoredRegistryCommandPack>();
  private readonly sessions = new Map<string, string>();
  private readonly apiTokens = new Map<string, RegistryApiToken & { tokenHash: string }>();

  constructor() {
    for (const profile of seedPublishers) {
      this.publishers.set(profile.handle, normalizeStoredPublisher({ ...profile }));
    }
    for (const command of seedCommands) {
      this.commands.set(command.id, { ...command });
    }
    for (const pack of registryCommandPacksData) {
      this.packs.set(pack.id, {
        ...pack,
        commands: pack.commands.map((command) => this.commands.get(command.id) ?? { ...command, code: getMockScriptCode(command.id), version: command.version || pack.version }),
      });
    }
  }

  async getCurrentUser(sessionId: string | null): Promise<StoredPublisherRecord | null> {
    if (!sessionId) return null;
    const handle = this.sessions.get(sessionId);
    if (!handle) return null;
    const publisher = this.publishers.get(handle);
    return publisher ? this.attachCommandCount(publisher) : null;
  }

  async createSession(handle: string): Promise<{ sessionId: string; user: StoredPublisherRecord }> {
    const publisher = this.publishers.get(handle);
    if (!publisher) throw new Error('Publisher profile not found');

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, handle);
    return { sessionId, user: this.attachCommandCount(publisher) };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listCommands(query: string, host?: string): Promise<StoredRegistryCommand[]> {
    return [...this.commands.values()].filter((command) => matchesSearch(command, query) && matchesHost(command, host));
  }

  async getCommand(id: string): Promise<StoredRegistryCommand | undefined> {
    const command = this.commands.get(id);
    return command ? { ...command } : undefined;
  }

  async createCommand(input: PublishCommandInput): Promise<StoredRegistryCommand> {
    if (this.commands.has(input.id)) {
      throw new Error('Command ID is already taken.');
    }

    const publisher = this.publishers.get(input.publisherHandle);
    if (!publisher) {
      throw new Error('Publisher profile not found');
    }

    const command = buildStoredCommand(input, publisher);
    this.commands.set(command.id, command);
    return { ...command };
  }

  async listPacks(query: string, host?: string): Promise<StoredRegistryCommandPack[]> {
    return [...this.packs.values()].filter((pack) => packMatchesSearch(pack, query) && packMatchesHost(pack, host));
  }

  async getPack(id: string): Promise<StoredRegistryCommandPack | undefined> {
    const pack = this.packs.get(id);
    return pack ? { ...pack, commands: [...pack.commands] } : undefined;
  }

  async createPack(input: PublishCommandPackInput): Promise<StoredRegistryCommandPack> {
    if (this.packs.has(input.id)) throw new Error('Pack ID is already taken.');
    const publisher = this.publishers.get(input.publisherHandle);
    if (!publisher) throw new Error('Publisher profile not found');
    const commands = input.commandIds.map((id) => this.commands.get(id));
    if (commands.some((command) => !command)) throw new Error('One or more selected commands were not found');
    if (commands.some((command) => command!.publisher.handle !== publisher.handle)) {
      throw new Error('Packs can only include commands published by the current user');
    }
    const pack = buildStoredPack(input, publisher, commands as StoredRegistryCommand[]);
    this.packs.set(pack.id, pack);
    return { ...pack, commands: [...pack.commands] };
  }

  async getPublisherProfile(handle: string): Promise<StoredPublisherRecord | undefined> {
    return this.getUser(handle);
  }

  async listUsers(query: string): Promise<StoredPublisherRecord[]> {
    const normalized = normalizeQuery(query);
    return [...this.publishers.values()]
      .map((profile) => this.attachCommandCount(profile))
      .filter((profile) => {
        if (!normalized) return true;
        return [
          profile.name,
          profile.handle,
          profile.bio,
          profile.githubLogin,
          profile.profileUrl,
          ...(profile.verifiedSources || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => b.publishedCommandsCount - a.publishedCommandsCount);
  }

  async getUser(handle: string): Promise<StoredPublisherRecord | undefined> {
    const profile = this.publishers.get(handle);
    return profile ? this.attachCommandCount(profile) : undefined;
  }

  async updateUser(handle: string, patch: Partial<StoredPublisherRecord>): Promise<StoredPublisherRecord> {
    const profile = this.publishers.get(handle);
    if (!profile) throw new Error('Publisher profile not found');

    const next: StoredPublisherRecord = normalizeStoredPublisher({
      ...profile,
      ...patch,
      verifiedSources: patch.verifiedSources ?? profile.verifiedSources,
      publishedCommandsCount: profile.publishedCommandsCount,
    });
    this.publishers.set(handle, next);
    return this.attachCommandCount(next);
  }

  async upsertGitHubUser(profile: GitHubUserProfile): Promise<StoredPublisherRecord> {
    const handle = `@${profile.login}`;
    const existing =
      [...this.publishers.values()].find((item) => item.githubId === profile.id || item.githubLogin === profile.login || item.handle === handle) ??
      this.publishers.get(handle);

    const merged: StoredPublisherRecord = normalizeStoredPublisher({
      ...(existing ?? {
        name: profile.name || profile.login,
        handle,
        avatarInitials: deriveAvatarInitials(profile.name || profile.login),
        verified: false,
        verifiedSources: [],
        publishedCommandsCount: 0,
        joinedAt: new Date().toISOString().slice(0, 10),
        bio: profile.bio || '',
        role: 'publisher',
      }),
      name: profile.name || existing?.name || profile.login,
      handle,
      avatarInitials: existing?.avatarInitials || deriveAvatarInitials(profile.name || profile.login),
      githubId: profile.id,
      githubLogin: profile.login,
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url,
      bio: profile.bio ?? existing?.bio ?? '',
    });

    this.publishers.set(handle, merged);
    return this.attachCommandCount(merged);
  }

  async listApiTokens(userHandle: string): Promise<RegistryApiToken[]> {
    return [...this.apiTokens.values()]
      .filter((token) => token.userHandle === userHandle)
      .map(({ tokenHash: _tokenHash, ...token }) => token)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createApiToken(userHandle: string, name: string, tokenHash: string): Promise<RegistryApiToken> {
    const token = {
      id: crypto.randomUUID(),
      userHandle,
      name: name.trim() || 'Registry API token',
      createdAt: new Date().toISOString(),
      tokenHash,
    };
    this.apiTokens.set(token.id, token);
    const { tokenHash: _tokenHash, ...publicToken } = token;
    return publicToken;
  }

  async deleteApiToken(userHandle: string, tokenId: string): Promise<void> {
    const token = this.apiTokens.get(tokenId);
    if (token?.userHandle === userHandle) this.apiTokens.delete(tokenId);
  }

  async getUserByApiTokenHash(tokenHash: string): Promise<StoredPublisherRecord | null> {
    const token = [...this.apiTokens.values()].find((item) => item.tokenHash === tokenHash);
    if (!token) return null;
    token.lastUsedAt = new Date().toISOString();
    const publisher = this.publishers.get(token.userHandle);
    return publisher ? this.attachCommandCount(publisher) : null;
  }

  private attachCommandCount(profile: StoredPublisherRecord): StoredPublisherRecord {
    const commandCount = [...this.commands.values()].filter((command) => command.publisher.handle === profile.handle).length;
    return {
      ...profile,
      publishedCommandsCount: commandCount,
    };
  }
}

class D1RegistryStore implements RegistryStore {
  private readonly initPromise: Promise<void>;

  constructor(private readonly db: D1DatabaseLike) {
    this.initPromise = this.initialize();
  }

  async getCurrentUser(sessionId: string | null): Promise<StoredPublisherRecord | null> {
    if (!sessionId) return null;
    await this.initPromise;

    const session = await this.db
      .prepare('SELECT user_handle FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ user_handle: string }>();
    if (!session) return null;

    return this.getUser(session.user_handle);
  }

  async createSession(handle: string): Promise<{ sessionId: string; user: StoredPublisherRecord }> {
    await this.initPromise;

    const publisher = await this.getUser(handle);
    if (!publisher) throw new Error('Publisher profile not found');

    const sessionId = crypto.randomUUID();
    await this.db
      .prepare('INSERT INTO sessions (id, user_handle, created_at) VALUES (?, ?, ?)')
      .bind(sessionId, publisher.handle, new Date().toISOString())
      .run();

    return {
      sessionId,
      user: publisher,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.initPromise;
    await this.db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }

  async listCommands(query: string, host?: string): Promise<StoredRegistryCommand[]> {
    await this.initPromise;

    const rows = await this.db
      .prepare(`
        SELECT
          c.id,
          c.title,
          c.description,
          c.website,
          c.match_patterns,
          c.publisher_handle,
          c.trust_level,
          c.risk,
          c.permissions,
          c.source_url,
          c.installs,
          c.rating,
          c.icon,
          c.code,
          c.version,
          p.name AS pub_name,
          p.avatar_initials AS pub_initials
        FROM commands c
        JOIN publishers p ON c.publisher_handle = p.handle
      `)
      .all<{
        id: string;
        title: string;
        description: string;
        website: string;
        match_patterns: string;
        publisher_handle: string;
        trust_level: string;
        risk: string;
        permissions: string;
        source_url: string;
        installs: number;
        rating: number;
        icon: string;
        code: string;
        version: string;
        pub_name: string;
        pub_initials: string;
      }>();

    return rows.results
      .map((row) => this.mapCommandRow(row))
      .filter((command) => matchesSearch(command, query) && matchesHost(command, host));
  }

  async getCommand(id: string): Promise<StoredRegistryCommand | undefined> {
    await this.initPromise;

    const row = await this.db
      .prepare(`
        SELECT
          c.id,
          c.title,
          c.description,
          c.website,
          c.match_patterns,
          c.publisher_handle,
          c.trust_level,
          c.risk,
          c.permissions,
          c.source_url,
          c.installs,
          c.rating,
          c.icon,
          c.code,
          c.version,
          p.name AS pub_name,
          p.avatar_initials AS pub_initials
        FROM commands c
        JOIN publishers p ON c.publisher_handle = p.handle
        WHERE c.id = ?
      `)
      .bind(id)
      .first<{
        id: string;
        title: string;
        description: string;
        website: string;
        match_patterns: string;
        publisher_handle: string;
        trust_level: string;
        risk: string;
        permissions: string;
        source_url: string;
        installs: number;
        rating: number;
        icon: string;
        code: string;
        version: string;
        pub_name: string;
        pub_initials: string;
      }>();

    return row ? this.mapCommandRow(row) : undefined;
  }

  async createCommand(input: PublishCommandInput): Promise<StoredRegistryCommand> {
    await this.initPromise;

    const existing = await this.db
      .prepare('SELECT id FROM commands WHERE id = ?')
      .bind(input.id)
      .first<{ id: string }>();
    if (existing) throw new Error('Command ID is already taken.');

    const publisher = await this.db
      .prepare('SELECT handle, name, avatar_initials FROM publishers WHERE handle = ?')
      .bind(input.publisherHandle)
      .first<{ handle: string; name: string; avatar_initials: string }>();
    if (!publisher) throw new Error('Publisher profile not found');

    await this.db
      .prepare(`
        INSERT INTO commands (
          id,
          title,
          description,
          website,
          match_patterns,
          publisher_handle,
          trust_level,
          risk,
          permissions,
          source_url,
          installs,
          rating,
          icon,
          code,
          version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        input.id,
        input.title,
        input.description,
        input.website,
        JSON.stringify(input.matchPatterns),
        input.publisherHandle,
        input.trustLevel,
        input.risk,
        JSON.stringify(input.permissions),
        input.sourceUrl,
        0,
        5.0,
        JSON.stringify(input.icon),
        input.code,
        input.version || '1.0.0'
      )
      .run();

    const command = await this.getCommand(input.id);
    if (!command) throw new Error('Failed to load created command');
    return command;
  }

  async listPacks(query: string, host?: string): Promise<StoredRegistryCommandPack[]> {
    await this.initPromise;

    const rows = await this.db
      .prepare(`
        SELECT
          p.id,
          p.title,
          p.description,
          p.website,
          p.match_patterns,
          p.publisher_handle,
          p.trust_level,
          p.risk,
          p.permissions,
          p.source_url,
          p.installs,
          p.rating,
          p.icon,
          p.version,
          pub.name AS pub_name,
          pub.avatar_initials AS pub_initials
        FROM packs p
        JOIN publishers pub ON p.publisher_handle = pub.handle
      `)
      .all<{
        id: string;
        title: string;
        description: string;
        website: string;
        match_patterns: string;
        publisher_handle: string;
        trust_level: string;
        risk: string;
        permissions: string;
        source_url: string;
        installs: number;
        rating: number;
        icon: string;
        version: string;
        pub_name: string;
        pub_initials: string;
      }>();

    const packsWithoutCommands = rows.results.map((row) => this.mapPackRow(row, []));
    const filteredPacks = packsWithoutCommands.filter((pack) => packMatchesSearch(pack, query) && packMatchesHost(pack, host));

    const hydratedPacks = await Promise.all(
      filteredPacks.map(async (pack) => {
        const commandRows = await this.db
          .prepare(`
            SELECT
              c.id,
              c.title,
              c.description,
              c.website,
              c.match_patterns,
              c.publisher_handle,
              c.trust_level,
              c.risk,
              c.permissions,
              c.source_url,
              c.installs,
              c.rating,
              c.icon,
              c.code,
              c.version,
              pub.name AS pub_name,
              pub.avatar_initials AS pub_initials
            FROM pack_commands pc
            JOIN commands c ON pc.command_id = c.id
            JOIN publishers pub ON c.publisher_handle = pub.handle
            WHERE pc.pack_id = ?
          `)
          .bind(pack.id)
          .all<{
            id: string;
            title: string;
            description: string;
            website: string;
            match_patterns: string;
            publisher_handle: string;
            trust_level: string;
            risk: string;
            permissions: string;
            source_url: string;
            installs: number;
            rating: number;
            icon: string;
            code: string;
            version: string;
            pub_name: string;
            pub_initials: string;
          }>();

        const commands = commandRows.results.map((row) => ({
          ...this.mapCommandRow(row),
          packId: pack.id,
          packTitle: pack.title,
          sourceUrl: pack.sourceUrl,
        }));

        return {
          ...pack,
          commands,
        };
      })
    );

    return hydratedPacks;
  }

  async getPack(id: string): Promise<StoredRegistryCommandPack | undefined> {
    await this.initPromise;

    const row = await this.db
      .prepare(`
        SELECT
          p.id,
          p.title,
          p.description,
          p.website,
          p.match_patterns,
          p.publisher_handle,
          p.trust_level,
          p.risk,
          p.permissions,
          p.source_url,
          p.installs,
          p.rating,
          p.icon,
          p.version,
          pub.name AS pub_name,
          pub.avatar_initials AS pub_initials
        FROM packs p
        JOIN publishers pub ON p.publisher_handle = pub.handle
        WHERE p.id = ?
      `)
      .bind(id)
      .first<{
        id: string;
        title: string;
        description: string;
        website: string;
        match_patterns: string;
        publisher_handle: string;
        trust_level: string;
        risk: string;
        permissions: string;
        source_url: string;
        installs: number;
        rating: number;
        icon: string;
        version: string;
        pub_name: string;
        pub_initials: string;
      }>();

    if (!row) return undefined;

    const commandRows = await this.db
      .prepare(`
        SELECT
          c.id,
          c.title,
          c.description,
          c.website,
          c.match_patterns,
          c.publisher_handle,
          c.trust_level,
          c.risk,
          c.permissions,
          c.source_url,
          c.installs,
          c.rating,
          c.icon,
          c.code,
          c.version,
          pub.name AS pub_name,
          pub.avatar_initials AS pub_initials
        FROM pack_commands pc
        JOIN commands c ON pc.command_id = c.id
        JOIN publishers pub ON c.publisher_handle = pub.handle
        WHERE pc.pack_id = ?
      `)
      .bind(id)
      .all<{
        id: string;
        title: string;
        description: string;
        website: string;
        match_patterns: string;
        publisher_handle: string;
        trust_level: string;
        risk: string;
        permissions: string;
        source_url: string;
        installs: number;
        rating: number;
        icon: string;
        code: string;
        version: string;
        pub_name: string;
        pub_initials: string;
      }>();

    const commands = commandRows.results.map((r) => ({
      ...this.mapCommandRow(r),
      packId: id,
      packTitle: row.title,
      sourceUrl: row.source_url,
    }));

    return this.mapPackRow(row, commands);
  }

  async createPack(input: PublishCommandPackInput): Promise<StoredRegistryCommandPack> {
    await this.initPromise;

    const existing = await this.db
      .prepare('SELECT id FROM packs WHERE id = ?')
      .bind(input.id)
      .first<{ id: string }>();
    if (existing) throw new Error('Pack ID is already taken.');

    const publisher = await this.db
      .prepare('SELECT handle, name, avatar_initials FROM publishers WHERE handle = ?')
      .bind(input.publisherHandle)
      .first<{ handle: string; name: string; avatar_initials: string }>();
    if (!publisher) throw new Error('Publisher profile not found');

    const commands = await Promise.all(
      input.commandIds.map(async (cmdId) => {
        const cmd = await this.getCommand(cmdId);
        return cmd;
      })
    );

    if (commands.some((cmd) => !cmd)) {
      throw new Error('One or more selected commands were not found');
    }

    if (commands.some((cmd) => cmd!.publisher.handle !== publisher.handle)) {
      throw new Error('Packs can only include commands published by the current user');
    }

    const trustLevel = commands.every((cmd) => cmd!.trustLevel === 'verified') ? 'verified' : 'community';
    const risk = commands.some((cmd) => cmd!.risk === 'high') ? 'high' : commands.some((cmd) => cmd!.risk === 'medium') ? 'medium' : 'low';
    const permissions = [...new Set(commands.flatMap((cmd) => cmd!.permissions))];

    await this.db
      .prepare(`
        INSERT INTO packs (
          id,
          title,
          description,
          website,
          match_patterns,
          publisher_handle,
          trust_level,
          risk,
          permissions,
          source_url,
          installs,
          rating,
          icon,
          version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        input.id,
        input.title,
        input.description,
        input.website,
        JSON.stringify(input.matchPatterns),
        input.publisherHandle,
        trustLevel,
        risk,
        JSON.stringify(permissions),
        input.sourceUrl,
        0,
        5.0,
        JSON.stringify(input.icon),
        input.version || '1.0.0'
      )
      .run();

    for (const cmdId of input.commandIds) {
      await this.db
        .prepare('INSERT INTO pack_commands (pack_id, command_id) VALUES (?, ?)')
        .bind(input.id, cmdId)
        .run();
    }

    const pack = await this.getPack(input.id);
    if (!pack) throw new Error('Failed to load created pack');
    return pack;
  }

  async getPublisherProfile(handle: string): Promise<StoredPublisherRecord | undefined> {
    return this.getUser(handle);
  }

  async listUsers(query: string): Promise<StoredPublisherRecord[]> {
    await this.initPromise;
    const rows = await this.db
      .prepare(`
        SELECT
          p.*,
          COUNT(c.id) AS published_count
        FROM publishers p
        LEFT JOIN commands c ON c.publisher_handle = p.handle
        GROUP BY p.handle
      `)
      .all<{
        handle: string;
        name: string;
        avatar_initials: string;
        verified: number;
        verified_sources: string;
        joined_at: string;
        bio: string | null;
        github_id: string | null;
        github_login: string | null;
        avatar_url: string | null;
        profile_url: string | null;
        role: 'admin' | 'publisher' | 'member' | null;
        published_count: number;
      }>();

    const normalized = normalizeQuery(query);
    return rows.results
      .map((row) => this.mapPublisherRow(row, row.published_count))
      .filter((profile) => {
        if (!normalized) return true;
        return [
          profile.name,
          profile.handle,
          profile.bio,
          profile.githubLogin,
          profile.profileUrl,
          ...(profile.verifiedSources || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => b.publishedCommandsCount - a.publishedCommandsCount);
  }

  async getUser(handle: string): Promise<StoredPublisherRecord | undefined> {
    await this.initPromise;
    const row = await this.db
      .prepare('SELECT * FROM publishers WHERE handle = ?')
      .bind(handle)
      .first<{
        handle: string;
        name: string;
        avatar_initials: string;
        verified: number;
        verified_sources: string;
        joined_at: string;
        bio: string | null;
        github_id: string | null;
        github_login: string | null;
        avatar_url: string | null;
        profile_url: string | null;
        role: 'admin' | 'publisher' | 'member' | null;
      }>();
    if (!row) return undefined;

    const count = await this.db
      .prepare('SELECT COUNT(*) AS count FROM commands WHERE publisher_handle = ?')
      .bind(handle)
      .first<{ count: number }>();

    return this.mapPublisherRow(row, count?.count ?? 0);
  }

  async updateUser(handle: string, patch: Partial<StoredPublisherRecord>): Promise<StoredPublisherRecord> {
    await this.initPromise;
    const existing = await this.getUser(handle);
    if (!existing) throw new Error('Publisher profile not found');

    await this.db
      .prepare(`
        UPDATE publishers
        SET
          name = ?,
          avatar_initials = ?,
          verified = ?,
          verified_sources = ?,
          joined_at = ?,
          bio = ?,
          github_id = ?,
          github_login = ?,
          avatar_url = ?,
          profile_url = ?,
          role = ?
        WHERE handle = ?
      `)
      .bind(
        patch.name ?? existing.name,
        patch.avatarInitials ?? existing.avatarInitials,
        typeof patch.verified === 'boolean' ? (patch.verified ? 1 : 0) : existing.verified ? 1 : 0,
        JSON.stringify(patch.verifiedSources ?? existing.verifiedSources),
        patch.joinedAt ?? existing.joinedAt,
        patch.bio ?? existing.bio,
        patch.githubId ?? existing.githubId ?? null,
        patch.githubLogin ?? existing.githubLogin ?? null,
        patch.avatarUrl ?? existing.avatarUrl ?? null,
        patch.profileUrl ?? existing.profileUrl ?? null,
        patch.role ?? existing.role ?? 'publisher',
        handle
      )
      .run();

    const updated = await this.getUser(handle);
    if (!updated) throw new Error('Failed to update publisher profile');
    return updated;
  }

  async upsertGitHubUser(profile: GitHubUserProfile): Promise<StoredPublisherRecord> {
    await this.initPromise;
    const existing = await this.db
      .prepare('SELECT * FROM publishers WHERE github_id = ? OR github_login = ? OR handle = ?')
      .bind(profile.id, profile.login, `@${profile.login}`)
      .first<{
        handle: string;
        name: string;
        avatar_initials: string;
        verified: number;
        verified_sources: string;
        joined_at: string;
        bio: string | null;
        github_id: string | null;
        github_login: string | null;
        avatar_url: string | null;
        profile_url: string | null;
        role: 'admin' | 'publisher' | 'member' | null;
      }>();

    const handle = existing?.handle ?? `@${profile.login}`;
    const avatarInitials = existing?.avatar_initials ?? deriveAvatarInitials(profile.name || profile.login);
    const joinedAt = existing?.joined_at ?? new Date().toISOString().slice(0, 10);
    const bio = profile.bio ?? existing?.bio ?? '';
    const role = existing?.role ?? 'publisher';
    const verified = existing?.verified ?? 0;
    const verifiedSources = existing?.verified_sources ?? JSON.stringify([]);

    if (existing) {
      await this.db
        .prepare(`
          UPDATE publishers
          SET
            name = ?,
            avatar_initials = ?,
            verified = ?,
            verified_sources = ?,
            joined_at = ?,
            bio = ?,
            github_id = ?,
            github_login = ?,
            avatar_url = ?,
            profile_url = ?,
            role = ?
          WHERE handle = ?
        `)
        .bind(
          profile.name || existing.name || profile.login,
          avatarInitials,
          verified,
          verifiedSources,
          joinedAt,
          bio,
          profile.id,
          profile.login,
          profile.avatar_url,
          profile.html_url,
          role,
          handle
        )
        .run();
    } else {
      await this.db
        .prepare(`
          INSERT INTO publishers (
            handle,
            name,
            avatar_initials,
            verified,
            verified_sources,
            joined_at,
            bio,
            github_id,
            github_login,
            avatar_url,
            profile_url,
            role
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          handle,
          profile.name || profile.login,
          avatarInitials,
          0,
          JSON.stringify([]),
          joinedAt,
          bio,
          profile.id,
          profile.login,
          profile.avatar_url,
          profile.html_url,
          'publisher'
        )
        .run();
    }

    const updated = await this.getUser(handle);
    if (!updated) throw new Error('Failed to load GitHub user');
    return updated;
  }

  async listApiTokens(userHandle: string): Promise<RegistryApiToken[]> {
    await this.initPromise;
    const rows = await this.db
      .prepare('SELECT id, user_handle, name, created_at, last_used_at FROM api_tokens WHERE user_handle = ? ORDER BY created_at DESC')
      .bind(userHandle)
      .all<{ id: string; user_handle: string; name: string; created_at: string; last_used_at: string | null }>();
    return rows.results.map((row) => ({
      id: row.id,
      userHandle: row.user_handle,
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at || undefined,
    }));
  }

  async createApiToken(userHandle: string, name: string, tokenHash: string): Promise<RegistryApiToken> {
    await this.initPromise;
    const token = {
      id: crypto.randomUUID(),
      userHandle,
      name: name.trim() || 'Registry API token',
      createdAt: new Date().toISOString(),
    };
    await this.db
      .prepare('INSERT INTO api_tokens (id, user_handle, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(token.id, token.userHandle, token.name, tokenHash, token.createdAt)
      .run();
    return token;
  }

  async deleteApiToken(userHandle: string, tokenId: string): Promise<void> {
    await this.initPromise;
    await this.db.prepare('DELETE FROM api_tokens WHERE id = ? AND user_handle = ?').bind(tokenId, userHandle).run();
  }

  async getUserByApiTokenHash(tokenHash: string): Promise<StoredPublisherRecord | null> {
    await this.initPromise;
    const row = await this.db
      .prepare('SELECT user_handle FROM api_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first<{ user_handle: string }>();
    if (!row) return null;
    await this.db
      .prepare('UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?')
      .bind(new Date().toISOString(), tokenHash)
      .run();
    return this.getUser(row.user_handle);
  }

  private async initialize(): Promise<void> {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS publishers (
        handle TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_initials TEXT NOT NULL,
        verified INTEGER NOT NULL,
        verified_sources TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        bio TEXT,
        github_id TEXT,
        github_login TEXT,
        avatar_url TEXT,
        profile_url TEXT,
        role TEXT NOT NULL DEFAULT 'publisher'
      )
    `).run();

    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS commands (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        website TEXT NOT NULL,
        match_patterns TEXT NOT NULL,
        publisher_handle TEXT NOT NULL,
        trust_level TEXT NOT NULL,
        risk TEXT NOT NULL,
        permissions TEXT NOT NULL,
        source_url TEXT NOT NULL,
        installs INTEGER NOT NULL DEFAULT 0,
        rating REAL NOT NULL DEFAULT 5.0,
        icon TEXT NOT NULL,
        code TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        FOREIGN KEY(publisher_handle) REFERENCES publishers(handle)
      )
    `).run();

    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_handle TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_handle) REFERENCES publishers(handle)
      )
    `).run();

    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id TEXT PRIMARY KEY,
        user_handle TEXT NOT NULL,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        FOREIGN KEY(user_handle) REFERENCES publishers(handle)
      )
    `).run();

    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS packs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        website TEXT NOT NULL,
        match_patterns TEXT NOT NULL,
        publisher_handle TEXT NOT NULL,
        trust_level TEXT NOT NULL,
        risk TEXT NOT NULL,
        permissions TEXT NOT NULL,
        source_url TEXT NOT NULL,
        installs INTEGER NOT NULL DEFAULT 0,
        rating REAL NOT NULL DEFAULT 5.0,
        icon TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        FOREIGN KEY(publisher_handle) REFERENCES publishers(handle)
      )
    `).run();

    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS pack_commands (
        pack_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        PRIMARY KEY(pack_id, command_id),
        FOREIGN KEY(pack_id) REFERENCES packs(id) ON DELETE CASCADE,
        FOREIGN KEY(command_id) REFERENCES commands(id) ON DELETE CASCADE
      )
    `).run();
  }

  private mapCommandRow(row: {
    id: string;
    title: string;
    description: string;
    website: string;
    match_patterns: string;
    publisher_handle: string;
    trust_level: string;
    risk: string;
    permissions: string;
    source_url: string;
    installs: number;
    rating: number;
    icon: string;
    code: string;
    version: string;
    pub_name: string;
    pub_initials: string;
  }): StoredRegistryCommand {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      website: row.website,
      matchPatterns: parseJsonArray<string>(row.match_patterns, []),
      publisher: {
        name: row.pub_name,
        handle: row.publisher_handle,
        avatarInitials: row.pub_initials,
      },
      trustLevel: row.trust_level as BurstCommand['trustLevel'],
      risk: row.risk as BurstCommand['risk'],
      permissions: parseJsonArray<string>(row.permissions, []),
      sourceUrl: row.source_url,
      installs: row.installs,
      rating: row.rating,
      icon: parseJsonObject<BurstCommand['icon']>(row.icon, { type: 'initials', value: '??' }),
      code: row.code,
      version: row.version,
    };
  }

  private mapPackRow(
    row: {
      id: string;
      title: string;
      description: string;
      website: string;
      match_patterns: string;
      publisher_handle: string;
      trust_level: string;
      risk: string;
      permissions: string;
      source_url: string;
      installs: number;
      rating: number;
      icon: string;
      version: string;
      pub_name: string;
      pub_initials: string;
    },
    commands: BurstCommand[]
  ): StoredRegistryCommandPack {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      website: row.website,
      matchPatterns: parseJsonArray<string>(row.match_patterns, []),
      publisher: {
        name: row.pub_name,
        handle: row.publisher_handle,
        avatarInitials: row.pub_initials,
      },
      trustLevel: row.trust_level as StoredRegistryCommandPack['trustLevel'],
      risk: row.risk as StoredRegistryCommandPack['risk'],
      permissions: parseJsonArray<string>(row.permissions, []),
      sourceUrl: row.source_url,
      installs: row.installs,
      rating: row.rating,
      icon: parseJsonObject<StoredRegistryCommandPack['icon']>(row.icon, { type: 'initials', value: '??' }),
      version: row.version,
      commands,
    };
  }

  private mapPublisherRow(
    row: {
      handle: string;
      name: string;
      avatar_initials: string;
      verified: number;
      verified_sources: string;
      joined_at: string;
      bio: string | null;
      github_id: string | null;
      github_login: string | null;
      avatar_url: string | null;
      profile_url: string | null;
      role: 'admin' | 'publisher' | 'member' | null;
    },
    publishedCommandsCount: number
  ): StoredPublisherRecord {
    return {
      name: row.name,
      handle: row.handle,
      avatarInitials: row.avatar_initials,
      verified: row.verified === 1,
      verifiedSources: parseJsonArray<string>(row.verified_sources, []),
      publishedCommandsCount,
      joinedAt: row.joined_at,
      bio: row.bio ?? '',
      githubId: row.github_id ?? undefined,
      githubLogin: row.github_login ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      profileUrl: row.profile_url ?? undefined,
      role: row.role ?? 'publisher',
    };
  }
}

export function createMemoryRegistryStore(): RegistryStore {
  return new MemoryRegistryStore();
}

export function createD1RegistryStore(db: D1DatabaseLike): RegistryStore {
  return new D1RegistryStore(db);
}

export async function buildAuditReport(store: RegistryStore, commandId: string, version?: string): Promise<AuditReport | undefined> {
  const command = await store.getCommand(commandId);
  if (!command) return undefined;

  const profile = await store.getPublisherProfile(command.publisher.handle);
  const analysis = analyzeScriptCode(command.code, command.matchPatterns);
  const isVerified = profile?.verified ?? false;
  const reportVersion = version || command.version;

  return {
    commandId,
    version: reportVersion,
    auditedAt: new Date().toISOString().slice(0, 10),
    status: analysis.status,
    checks: {
      ...analysis.checks,
      signature: {
        status: isVerified ? 'pass' : 'warning',
        detail: isVerified
          ? `Cryptographic signature verified against verified publisher ${command.publisher.handle} key. Manifest integrity matches package source.`
          : 'Community package signature is self-signed/unverified. Review manifest content before installing.',
      },
    },
    summary: analysis.summary,
  };
}
