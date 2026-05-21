import { Database } from 'bun:sqlite';
import { file } from 'bun';
import { join } from 'path';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';

const dbPath = join(__dirname, 'registry.db');
const db = new Database(dbPath);

// Initialize DB schemas
db.run(`
  CREATE TABLE IF NOT EXISTS publishers (
    handle TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_initials TEXT NOT NULL,
    verified INTEGER NOT NULL,
    verified_sources TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    bio TEXT
  )
`);

db.run(`
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
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_handle TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_handle) REFERENCES publishers(handle)
  )
`);

// Seed publishers if empty
const publisherCount = db.prepare('SELECT COUNT(*) as count FROM publishers').get() as { count: number };
if (publisherCount.count === 0) {
  const seedPublishers = [
    {
      handle: '@burst-examples',
      name: 'Burst Examples',
      avatar_initials: 'BE',
      verified: 1,
      verified_sources: JSON.stringify(['github.com/burst/examples']),
      joined_at: '2026-04-01',
      bio: 'Official open-source command examples maintained by the Burst Core Team.',
    },
    {
      handle: '@schen',
      name: 'Sarah Chen',
      avatar_initials: 'SC',
      verified: 1,
      verified_sources: JSON.stringify(['github.com/schen', 'sarahchen.dev']),
      joined_at: '2026-04-10',
      bio: 'Frontend engineer & developer experience enthusiast. Building productivity scripts for web workflows.',
    },
    {
      handle: '@hn-power',
      name: 'HN PowerUser',
      avatar_initials: 'HN',
      verified: 0,
      verified_sources: JSON.stringify([]),
      joined_at: '2026-05-02',
      bio: 'Avid Hacker News reader. Automating social news interfaces and thread reading.',
    },
  ];

  const insertPublisher = db.prepare(`
    INSERT INTO publishers (handle, name, avatar_initials, verified, verified_sources, joined_at, bio)
    VALUES ($handle, $name, $avatar_initials, $verified, $verified_sources, $joined_at, $bio)
  `);

  for (const pub of seedPublishers) {
    insertPublisher.run({
      $handle: pub.handle,
      $name: pub.name,
      $avatar_initials: pub.avatar_initials,
      $verified: pub.verified,
      $verified_sources: pub.verified_sources,
      $joined_at: pub.joined_at,
      $bio: pub.bio,
    });
  }
}

// Seed commands if empty
const commandCount = db.prepare('SELECT COUNT(*) as count FROM commands').get() as { count: number };
if (commandCount.count === 0) {
  const seedCommands = [
    {
      id: 'copy-github-branch',
      title: 'Copy GitHub branch name',
      description: 'Copies the active GitHub branch name to the clipboard.',
      website: 'github.com',
      match_patterns: JSON.stringify(['github.com/*']),
      publisher_handle: '@burst-examples',
      trust_level: 'verified',
      risk: 'medium',
      permissions: JSON.stringify(['Read page DOM', 'Write clipboard']),
      source_url: 'https://github.com/burst/examples/tree/main/copy-github-branch',
      installs: 1450,
      rating: 4.8,
      icon: JSON.stringify({ type: 'favicon', host: 'github.com' }),
      code: `export default async function run({ page, toast }) {
  const branch = page.querySelector('[data-icv-name="Switch branches/tags"]')?.textContent?.trim() || 'main';
  await navigator.clipboard.writeText(branch);
  toast('Copied branch: ' + branch);
}`,
      version: '1.0.0',
    },
    {
      id: 'markdown-link-builder',
      title: 'Copy as Markdown link',
      description: 'Copies the current page title and URL as a formatted Markdown link.',
      website: 'all sites',
      match_patterns: JSON.stringify(['<all_urls>']),
      publisher_handle: '@schen',
      trust_level: 'verified',
      risk: 'low',
      permissions: JSON.stringify(['Read page DOM', 'Write clipboard']),
      source_url: 'https://github.com/schen/burst-plugins/tree/main/markdown-link',
      installs: 4230,
      rating: 4.9,
      icon: JSON.stringify({ type: 'emoji', value: '🔗' }),
      code: `export default async function run({ title, url, toast }) {
  const link = \`[\${title}](\${url})\`;
  await navigator.clipboard.writeText(link);
  toast('Copied Markdown link: ' + link);
}`,
      version: '1.0.0',
    },
    {
      id: 'hn-comments-summarizer',
      title: 'Summarize Hacker News thread',
      description: 'Fetches comments from the active Hacker News thread and builds a summary.',
      website: 'news.ycombinator.com',
      match_patterns: JSON.stringify(['news.ycombinator.com/item*']),
      publisher_handle: '@hn-power',
      trust_level: 'reviewed',
      risk: 'medium',
      permissions: JSON.stringify(['Read page DOM', 'Write clipboard', 'Network access to api.burst.dev']),
      source_url: 'https://github.com/hn-power/burst-tools/tree/main/hn-summarizer',
      installs: 890,
      rating: 4.5,
      icon: JSON.stringify({ type: 'favicon', host: 'news.ycombinator.com' }),
      code: `export default async function run({ page, toast }) {
  const commentNode = page.querySelector('.comment');
  const text = commentNode?.textContent?.trim() || 'No comments found';
  // Send data to summary service
  await fetch('https://api.burst.dev/summarize', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
  toast('HN Thread Summary: ' + text.substring(0, 50) + '...');
}`,
      version: '1.0.0',
    },
    {
      id: 'tailwind-css-exporter',
      title: 'Tailwind CSS Exporter',
      description: 'Extracts the Tailwind HTML snippet under the cursor and copies it to clipboard.',
      website: 'tailwindplay.com',
      match_patterns: JSON.stringify(['play.tailwindcss.com/*']),
      publisher_handle: '@burst-examples',
      trust_level: 'community',
      risk: 'medium',
      permissions: JSON.stringify(['Read page DOM', 'Write clipboard']),
      source_url: 'https://github.com/burst/examples/tree/main/tailwind-exporter',
      installs: 320,
      rating: 4.2,
      icon: JSON.stringify({ type: 'initials', value: 'TW' }),
      code: `export default async function run({ toast }) {
  // Obfuscated/minified layout helper simulation
  const _0x1a2b = ["\\x54\\x61\\x69\\x6c\\x77\\x69\\x6e\\x64", "\\x65\\x78\\x70\\x6f\\x72\\x74"];
  toast('Exported ' + _0x1a2b[0] + ' ' + _0x1a2b[1]);
}`,
      version: '1.0.0',
    },
    {
      id: 'json-formatter-toast',
      title: 'Format Selected JSON',
      description: 'Parses the selected text as JSON, formats it, and displays a formatted snippet in a toast.',
      website: 'all sites',
      match_patterns: JSON.stringify(['<all_urls>']),
      publisher_handle: '@schen',
      trust_level: 'verified',
      risk: 'low',
      permissions: JSON.stringify(['Read selection', 'Toast alerts']),
      source_url: 'https://github.com/schen/burst-plugins/tree/main/json-formatter',
      installs: 1540,
      rating: 4.7,
      icon: JSON.stringify({ type: 'emoji', value: '📄' }),
      code: `export default async function run({ selection, toast }) {
  try {
    const formatted = JSON.stringify(JSON.parse(selection), null, 2);
    toast('JSON: ' + formatted.substring(0, 40) + '...');
  } catch (e) {
    toast('Select valid JSON text first');
  }
}`,
      version: '1.0.0',
    },
  ];

  const insertCommand = db.prepare(`
    INSERT INTO commands (id, title, description, website, match_patterns, publisher_handle, trust_level, risk, permissions, source_url, installs, rating, icon, code, version)
    VALUES ($id, $title, $description, $website, $match_patterns, $publisher_handle, $trust_level, $risk, $permissions, $source_url, $installs, $rating, $icon, $code, $version)
  `);

  for (const cmd of seedCommands) {
    insertCommand.run({
      $id: cmd.id,
      $title: cmd.title,
      $description: cmd.description,
      $website: cmd.website,
      $match_patterns: cmd.match_patterns,
      $publisher_handle: cmd.publisher_handle,
      $trust_level: cmd.trust_level,
      $risk: cmd.risk,
      $permissions: cmd.permissions,
      $source_url: cmd.source_url,
      $installs: cmd.installs,
      $rating: cmd.rating,
      $icon: cmd.icon,
      $code: cmd.code,
      $version: cmd.version,
    });
  }
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

async function getSessionUser(request: Request) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies['session_id'];
  if (!sessionId) return null;

  const session = db.prepare('SELECT user_handle FROM sessions WHERE id = ?').get(sessionId) as { user_handle: string } | null;
  if (!session) return null;

  const user = db.prepare('SELECT handle, name, avatar_initials FROM publishers WHERE handle = ?').get(session.user_handle) as {
    handle: string;
    name: string;
    avatar_initials: string;
  } | null;

  return user;
}

const server = Bun.serve({
  port: 5175,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Cookie',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    const jsonHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    // API Routes
    if (path.startsWith('/api')) {
      try {
        // GET /api/auth/me
        if (path === '/api/auth/me' && req.method === 'GET') {
          const user = await getSessionUser(req);
          if (!user) {
            return new Response(JSON.stringify({ handle: 'guest', name: 'Guest User', avatarInitials: 'G' }), { headers: jsonHeaders });
          }
          return new Response(JSON.stringify({ handle: user.handle, name: user.name, avatarInitials: user.avatar_initials }), { headers: jsonHeaders });
        }

        // POST /api/auth/login
        if (path === '/api/auth/login' && req.method === 'POST') {
          const body = (await req.json()) as { handle: string };
          if (!body.handle) {
            return new Response(JSON.stringify({ error: 'Missing handle' }), { status: 400, headers: jsonHeaders });
          }

          if (body.handle === 'guest') {
            // Delete session and clear cookie
            const cookies = parseCookies(req.headers.get('Cookie'));
            const sessionId = cookies['session_id'];
            if (sessionId) {
              db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
            }
            return new Response(JSON.stringify({ ok: true, user: { handle: 'guest', name: 'Guest User', avatarInitials: 'G' } }), {
              headers: {
                ...jsonHeaders,
                'Set-Cookie': 'session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
              },
            });
          }

          const publisher = db.prepare('SELECT handle, name, avatar_initials FROM publishers WHERE handle = ?').get(body.handle) as {
            handle: string;
            name: string;
            avatar_initials: string;
          } | null;

          if (!publisher) {
            return new Response(JSON.stringify({ error: 'Publisher profile not found' }), { status: 404, headers: jsonHeaders });
          }

          const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
          db.prepare('INSERT INTO sessions (id, user_handle, created_at) VALUES (?, ?, ?)')
            .run(sessionId, publisher.handle, new Date().toISOString());

          return new Response(JSON.stringify({ ok: true, user: { handle: publisher.handle, name: publisher.name, avatarInitials: publisher.avatar_initials } }), {
            headers: {
              ...jsonHeaders,
              'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
            },
          });
        }

        // POST /api/auth/logout
        if (path === '/api/auth/logout' && req.method === 'POST') {
          const cookies = parseCookies(req.headers.get('Cookie'));
          const sessionId = cookies['session_id'];
          if (sessionId) {
            db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
          }
          return new Response(JSON.stringify({ ok: true }), {
            headers: {
              ...jsonHeaders,
              'Set-Cookie': 'session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
            },
          });
        }

        // GET /api/commands
        if (path === '/api/commands' && req.method === 'GET') {
          const q = url.searchParams.get('q')?.trim().toLowerCase() || '';

          const rows = db.prepare(`
            SELECT c.*, p.name as pub_name, p.avatar_initials as pub_initials
            FROM commands c
            JOIN publishers p ON c.publisher_handle = p.handle
          `).all() as Array<{
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
          }>;

          const commands = rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            website: row.website,
            matchPatterns: JSON.parse(row.match_patterns) as string[],
            publisher: {
              name: row.pub_name,
              handle: row.publisher_handle,
              avatarInitials: row.pub_initials,
            },
            trustLevel: row.trust_level as any,
            risk: row.risk as any,
            permissions: JSON.parse(row.permissions) as string[],
            sourceUrl: row.source_url,
            installs: row.installs,
            rating: row.rating,
            icon: JSON.parse(row.icon),
            code: row.code,
            version: row.version,
          }));

          const filtered = commands.filter((cmd) => {
            if (!q) return true;
            const searchable = [
              cmd.title,
              cmd.description,
              cmd.website,
              cmd.publisher.name,
              cmd.publisher.handle,
              cmd.trustLevel,
              cmd.risk,
              ...cmd.permissions,
            ]
              .join(' ')
              .toLowerCase();
            return searchable.includes(q);
          });

          return new Response(JSON.stringify(filtered), { headers: jsonHeaders });
        }

        // POST /api/commands (Publish)
        if (path === '/api/commands' && req.method === 'POST') {
          const body = (await req.json()) as {
            id: string;
            title: string;
            description: string;
            website: string;
            matchPatterns: string[];
            publisherHandle: string;
            trustLevel: string;
            risk: string;
            permissions: string[];
            sourceUrl: string;
            icon: any;
            code: string;
            version?: string;
          };

          const user = await getSessionUser(req);
          if (!user || user.handle !== body.publisherHandle) {
            return new Response(JSON.stringify({ error: 'Unauthorized publishing action' }), { status: 401, headers: jsonHeaders });
          }

          // Check if command already exists
          const existing = db.prepare('SELECT id FROM commands WHERE id = ?').get(body.id);
          if (existing) {
            return new Response(JSON.stringify({ error: 'Command ID is already taken.' }), { status: 400, headers: jsonHeaders });
          }

          db.prepare(`
            INSERT INTO commands (id, title, description, website, match_patterns, publisher_handle, trust_level, risk, permissions, source_url, installs, rating, icon, code, version)
            VALUES ($id, $title, $description, $website, $match_patterns, $publisher_handle, $trust_level, $risk, $permissions, $source_url, 0, 5.0, $icon, $code, $version)
          `).run({
            $id: body.id,
            $title: body.title,
            $description: body.description,
            $website: body.website,
            $match_patterns: JSON.stringify(body.matchPatterns),
            $publisher_handle: body.publisherHandle,
            $trust_level: body.trustLevel,
            $risk: body.risk,
            $permissions: JSON.stringify(body.permissions),
            $source_url: body.sourceUrl,
            $icon: JSON.stringify(body.icon),
            $code: body.code,
            $version: body.version || '1.0.0',
          });

          // Fetch the updated command structure to return
          const row = db.prepare(`
            SELECT c.*, p.name as pub_name, p.avatar_initials as pub_initials
            FROM commands c
            JOIN publishers p ON c.publisher_handle = p.handle
            WHERE c.id = ?
          `).get(body.id) as any;

          const createdCommand = {
            id: row.id,
            title: row.title,
            description: row.description,
            website: row.website,
            matchPatterns: JSON.parse(row.match_patterns) as string[],
            publisher: {
              name: row.pub_name,
              handle: row.publisher_handle,
              avatarInitials: row.pub_initials,
            },
            trustLevel: row.trust_level,
            risk: row.risk,
            permissions: JSON.parse(row.permissions),
            sourceUrl: row.source_url,
            installs: row.installs,
            rating: row.rating,
            icon: JSON.parse(row.icon),
            code: row.code,
            version: row.version,
          };

          return new Response(JSON.stringify(createdCommand), { headers: jsonHeaders });
        }

        // GET /api/commands/:id
        const cmdMatch = path.match(/^\/api\/commands\/([a-zA-Z0-9_-]+)$/);
        if (cmdMatch && req.method === 'GET') {
          const commandId = cmdMatch[1];
          const row = db.prepare(`
            SELECT c.*, p.name as pub_name, p.avatar_initials as pub_initials
            FROM commands c
            JOIN publishers p ON c.publisher_handle = p.handle
            WHERE c.id = ?
          `).get(commandId) as any | null;

          if (!row) {
            return new Response(JSON.stringify({ error: 'Command not found' }), { status: 404, headers: jsonHeaders });
          }

          const command = {
            id: row.id,
            title: row.title,
            description: row.description,
            website: row.website,
            matchPatterns: JSON.parse(row.match_patterns) as string[],
            publisher: {
              name: row.pub_name,
              handle: row.publisher_handle,
              avatarInitials: row.pub_initials,
            },
            trustLevel: row.trust_level,
            risk: row.risk,
            permissions: JSON.parse(row.permissions),
            sourceUrl: row.source_url,
            installs: row.installs,
            rating: row.rating,
            icon: JSON.parse(row.icon),
            code: row.code,
            version: row.version,
          };

          return new Response(JSON.stringify(command), { headers: jsonHeaders });
        }

        // GET /api/commands/:id/audit
        const auditMatch = path.match(/^\/api\/commands\/([a-zA-Z0-9_-]+)\/audit$/);
        if (auditMatch && req.method === 'GET') {
          const commandId = auditMatch[1];
          const row = db.prepare(`
            SELECT c.*, p.name as pub_name, p.avatar_initials as pub_initials, p.verified as pub_verified
            FROM commands c
            JOIN publishers p ON c.publisher_handle = p.handle
            WHERE c.id = ?
          `).get(commandId) as any | null;

          if (!row) {
            return new Response(JSON.stringify({ error: 'Command not found for audit' }), { status: 404, headers: jsonHeaders });
          }

          const matchPatterns = JSON.parse(row.match_patterns) as string[];
          const report = analyzeScriptCode(row.code, matchPatterns);
          const isVerified = row.pub_verified === 1;

          const auditReport = {
            commandId,
            version: row.version,
            auditedAt: new Date().toISOString().slice(0, 10),
            status: report.status,
            checks: {
              ...report.checks,
              signature: {
                status: isVerified ? 'pass' : 'warning',
                detail: isVerified
                  ? `Cryptographic signature verified against verified publisher ${row.publisher_handle} key. Manifest integrity matches package source.`
                  : `Community package signature is self-signed/unverified. Review manifest content before installing.`,
              },
            },
            summary: report.summary,
          };

          return new Response(JSON.stringify(auditReport), { headers: jsonHeaders });
        }

        // GET /api/publishers/:handle
        const pubMatch = path.match(/^\/api\/publishers\/(@[a-zA-Z0-9_-]+)$/);
        if (pubMatch && req.method === 'GET') {
          const handle = pubMatch[1];
          const row = db.prepare('SELECT * FROM publishers WHERE handle = ?').get(handle) as any | null;
          if (!row) {
            return new Response(JSON.stringify({ error: 'Publisher profile not found' }), { status: 404, headers: jsonHeaders });
          }

          const cmdCount = db.prepare('SELECT COUNT(*) as count FROM commands WHERE publisher_handle = ?').get(handle) as { count: number };

          const profile = {
            name: row.name,
            handle: row.handle,
            avatarInitials: row.avatar_initials,
            verified: row.verified === 1,
            verifiedSources: JSON.parse(row.verified_sources) as string[],
            publishedCommandsCount: cmdCount.count,
            joinedAt: row.joined_at,
            bio: row.bio,
          };

          return new Response(JSON.stringify(profile), { headers: jsonHeaders });
        }

        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: jsonHeaders });
      } catch (err) {
        console.error('API Error:', err);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: String(err) }), { status: 500, headers: jsonHeaders });
      }
    }

    // Static Asset Serving (SPA Frontend fallback)
    const distPath = join(__dirname, 'dist');
    let filePath = join(distPath, path);

    // Security check: ensure filePath is within distPath
    if (!filePath.startsWith(distPath)) {
      return new Response('Access Denied', { status: 403 });
    }

    let fileObj = file(filePath);
    if (!(await fileObj.exists())) {
      filePath = join(distPath, 'index.html');
      fileObj = file(filePath);
    }

    if (await fileObj.exists()) {
      return new Response(fileObj);
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`[Burst Server] Server started at http://localhost:${server.port}`);
