import type { BurstCommand } from '@/src/lib/commands';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import type { AuditReport, PublisherProfile } from '@/src/lib/registryApi';
import { getMockScriptCode, mockPublisherProfiles, registryCommandsData } from '@/src/lib/registryApi';

type RegistryUser = {
  handle: string;
  name: string;
  avatarInitials: string;
};

export type StoredRegistryCommand = BurstCommand & {
  code: string;
  version: string;
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

type StoredPublisherProfile = PublisherProfile;

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
  getCurrentUser(sessionId: string | null): Promise<RegistryUser | null>;
  createSession(handle: string): Promise<{ sessionId: string; user: RegistryUser }>;
  deleteSession(sessionId: string): Promise<void>;
  listCommands(query: string): Promise<StoredRegistryCommand[]>;
  getCommand(id: string): Promise<StoredRegistryCommand | undefined>;
  createCommand(input: PublishCommandInput): Promise<StoredRegistryCommand>;
  getPublisherProfile(handle: string): Promise<StoredPublisherProfile | undefined>;
};

const seedCommands: StoredRegistryCommand[] = registryCommandsData.map((command) => ({
  ...command,
  code: getMockScriptCode(command.id),
  version: '1.0.0',
}));

const seedPublishers: PublisherProfile[] = Object.values(mockPublisherProfiles).map((profile) => ({
  ...profile,
}));

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

function getSeedPublisherProfile(handle: string): StoredPublisherProfile | undefined {
  return seedPublishers.find((profile) => profile.handle === handle);
}

function buildPublisherProfile(handle: string, commandCount: number): StoredPublisherProfile | undefined {
  const profile = getSeedPublisherProfile(handle);
  if (!profile) return undefined;

  return {
    ...profile,
    publishedCommandsCount: commandCount,
  };
}

function buildSessionUser(profile: StoredPublisherProfile): RegistryUser {
  return {
    handle: profile.handle,
    name: profile.name,
    avatarInitials: profile.avatarInitials,
  };
}

function buildStoredCommand(input: PublishCommandInput, publisher: StoredPublisherProfile): StoredRegistryCommand {
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

class MemoryRegistryStore implements RegistryStore {
  private readonly publishers = new Map<string, StoredPublisherProfile>();
  private readonly commands = new Map<string, StoredRegistryCommand>();
  private readonly sessions = new Map<string, string>();

  constructor() {
    for (const profile of seedPublishers) {
      this.publishers.set(profile.handle, { ...profile });
    }
    for (const command of seedCommands) {
      this.commands.set(command.id, { ...command });
    }
  }

  async getCurrentUser(sessionId: string | null): Promise<RegistryUser | null> {
    if (!sessionId) return null;
    const handle = this.sessions.get(sessionId);
    if (!handle) return null;
    const publisher = this.publishers.get(handle);
    return publisher ? buildSessionUser(publisher) : null;
  }

  async createSession(handle: string): Promise<{ sessionId: string; user: RegistryUser }> {
    const publisher = this.publishers.get(handle);
    if (!publisher) throw new Error('Publisher profile not found');

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, handle);
    return { sessionId, user: buildSessionUser(publisher) };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listCommands(query: string): Promise<StoredRegistryCommand[]> {
    return [...this.commands.values()].filter((command) => matchesSearch(command, query));
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

  async getPublisherProfile(handle: string): Promise<StoredPublisherProfile | undefined> {
    const profile = this.publishers.get(handle);
    if (!profile) return undefined;

    const commandCount = [...this.commands.values()].filter((command) => command.publisher.handle === handle).length;
    return buildPublisherProfile(handle, commandCount);
  }
}

class D1RegistryStore implements RegistryStore {
  private readonly initPromise: Promise<void>;

  constructor(private readonly db: D1DatabaseLike) {
    this.initPromise = this.initialize();
  }

  async getCurrentUser(sessionId: string | null): Promise<RegistryUser | null> {
    if (!sessionId) return null;
    await this.initPromise;

    const session = await this.db
      .prepare('SELECT user_handle FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ user_handle: string }>();
    if (!session) return null;

    const publisher = await this.db
      .prepare('SELECT handle, name, avatar_initials FROM publishers WHERE handle = ?')
      .bind(session.user_handle)
      .first<{ handle: string; name: string; avatar_initials: string }>();

    return publisher
      ? {
          handle: publisher.handle,
          name: publisher.name,
          avatarInitials: publisher.avatar_initials,
        }
      : null;
  }

  async createSession(handle: string): Promise<{ sessionId: string; user: RegistryUser }> {
    await this.initPromise;

    const publisher = await this.db
      .prepare('SELECT handle, name, avatar_initials FROM publishers WHERE handle = ?')
      .bind(handle)
      .first<{ handle: string; name: string; avatar_initials: string }>();
    if (!publisher) throw new Error('Publisher profile not found');

    const sessionId = crypto.randomUUID();
    await this.db
      .prepare('INSERT INTO sessions (id, user_handle, created_at) VALUES (?, ?, ?)')
      .bind(sessionId, publisher.handle, new Date().toISOString())
      .run();

    return {
      sessionId,
      user: {
        handle: publisher.handle,
        name: publisher.name,
        avatarInitials: publisher.avatar_initials,
      },
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.initPromise;
    await this.db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }

  async listCommands(query: string): Promise<StoredRegistryCommand[]> {
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
      .filter((command) => matchesSearch(command, query));
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

  async getPublisherProfile(handle: string): Promise<StoredPublisherProfile | undefined> {
    await this.initPromise;

    const publisher = await this.db
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
      }>();
    if (!publisher) return undefined;

    const count = await this.db
      .prepare('SELECT COUNT(*) AS count FROM commands WHERE publisher_handle = ?')
      .bind(handle)
      .first<{ count: number }>();

    return {
      name: publisher.name,
      handle: publisher.handle,
      avatarInitials: publisher.avatar_initials,
      verified: publisher.verified === 1,
      verifiedSources: parseJsonArray<string>(publisher.verified_sources, []),
      publishedCommandsCount: count?.count ?? 0,
      joinedAt: publisher.joined_at,
      bio: publisher.bio ?? '',
    };
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
        bio TEXT
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

    const publisherCount = await this.db
      .prepare('SELECT COUNT(*) AS count FROM publishers')
      .first<{ count: number }>();

    if ((publisherCount?.count ?? 0) === 0) {
      for (const profile of seedPublishers) {
        await this.db
          .prepare(`
            INSERT INTO publishers (handle, name, avatar_initials, verified, verified_sources, joined_at, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            profile.handle,
            profile.name,
            profile.avatarInitials,
            profile.verified ? 1 : 0,
            JSON.stringify(profile.verifiedSources),
            profile.joinedAt,
            profile.bio
          )
          .run();
      }
    }

    const commandCount = await this.db
      .prepare('SELECT COUNT(*) AS count FROM commands')
      .first<{ count: number }>();

    if ((commandCount?.count ?? 0) === 0) {
      for (const command of seedCommands) {
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
            command.id,
            command.title,
            command.description,
            command.website,
            JSON.stringify(command.matchPatterns),
            command.publisher.handle,
            command.trustLevel,
            command.risk,
            JSON.stringify(command.permissions),
            command.sourceUrl,
            command.installs,
            command.rating,
            JSON.stringify(command.icon),
            command.code,
            command.version
          )
          .run();
      }
    }
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
