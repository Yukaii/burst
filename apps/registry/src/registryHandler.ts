import type { AuditReport, PublisherProfile, RegistryUserUpdate } from '@/src/lib/registryApi';
import { buildAuditReport, type GitHubUserProfile, type PublishCommandInput, type RegistryStore } from './registryStore';

type RegistryAuthConfig = {
  githubClientId?: string;
  githubClientSecret?: string;
  adminGithubLogins?: string | string[];
};

type JsonHeaders = Record<string, string>;

const jsonHeaders: JsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
};

const guestUser = {
  handle: 'guest',
  name: 'Guest User',
  avatarInitials: 'G',
  role: 'member' as const,
};

const GITHUB_STATE_COOKIE = 'burst_github_state';
const GITHUB_RETURN_TO_COOKIE = 'burst_github_return_to';

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

function normalizeReturnTo(value: string | null, requestUrl: string): string {
  if (!value) return '/dashboard';

  const fallback = '/dashboard';
  const request = new URL(requestUrl);

  try {
    const parsed = new URL(value);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

    if (parsed.origin === request.origin) {
      return parsed.toString();
    }

    if (localHosts.has(request.hostname) && parsed.hostname === request.hostname) {
      return parsed.toString();
    }
  } catch {
    if (value.startsWith('//')) return fallback;
    if (value.startsWith('/')) return value;
  }

  return fallback;
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}

function buildCookie(name: string, value: string, secure: boolean, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function clearCookie(name: string, secure: boolean): string {
  return buildCookie(name, '', secure, 0);
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Credentials', 'true');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function redirectResponse(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(null, { status: 302, headers });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, { status });
}

function appendSetCookies(headers: HeadersInit | undefined, cookies: string[]): HeadersInit {
  const next = new Headers(headers);
  for (const cookie of cookies) {
    next.append('Set-Cookie', cookie);
  }
  return next;
}

function normalizeAdminGithubLogins(value: string | string[] | undefined): Set<string> {
  const raw = Array.isArray(value) ? value : value?.split(',') ?? [];
  return new Set(
    raw
      .map((login) => login.trim().replace(/^@/, '').toLowerCase())
      .filter(Boolean)
  );
}

function normalizeAuthConfig(config: RegistryAuthConfig) {
  return {
    githubClientId: config.githubClientId?.trim() ?? '',
    githubClientSecret: config.githubClientSecret?.trim() ?? '',
    adminGithubLogins: normalizeAdminGithubLogins(config.adminGithubLogins),
  };
}

function isAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === 'admin';
}

function sanitizeSelfProfilePatch(patch: RegistryUserUpdate): RegistryUserUpdate {
  return {
    name: patch.name,
    bio: patch.bio,
    verifiedSources: patch.verifiedSources,
  };
}

async function exchangeGithubCode(request: Request, config: RegistryAuthConfig, code: string): Promise<string> {
  if (!config.githubClientId || !config.githubClientSecret) {
    throw new Error('GitHub login is not configured');
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: new URL('/api/auth/github/callback', request.url).toString(),
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange GitHub authorization code');
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to obtain GitHub access token');
  }

  return tokenData.access_token;
}

async function fetchGithubUser(accessToken: string): Promise<GitHubUserProfile> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `token ${accessToken}`,
      'User-Agent': 'burst-registry',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to fetch GitHub profile (status: ${response.status}): ${errorText}`);
  }

  const profile = (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
    bio: string | null;
  };

  return {
    id: String(profile.id),
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
    bio: profile.bio,
  };
}

export function createRegistryHandler(store: RegistryStore, authConfig: RegistryAuthConfig = {}) {
  const normalizedAuthConfig = normalizeAuthConfig(authConfig);

  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const secureCookie = isSecureRequest(req);
    const hasGitHubLogin = Boolean(normalizedAuthConfig.githubClientId && normalizedAuthConfig.githubClientSecret);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Cookie',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    if (!path.startsWith('/api')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      if (path === '/api/auth/config' && req.method === 'GET') {
        return jsonResponse({
          githubEnabled: hasGitHubLogin,
          loginUrl: hasGitHubLogin ? new URL('/api/auth/github/start', url.origin).toString() : undefined,
        });
      }

      if (path === '/api/auth/me' && req.method === 'GET') {
        const cookies = parseCookies(req.headers.get('Cookie'));
        const user = await store.getCurrentUser(cookies.session_id ?? null);
        return jsonResponse(user ?? guestUser);
      }

      if (path === '/api/auth/github/start' && req.method === 'GET') {
        if (!hasGitHubLogin) {
          return errorResponse('GitHub login is not configured', 503);
        }

        const state = crypto.randomUUID();
        const returnTo = normalizeReturnTo(url.searchParams.get('returnTo'), req.url);
        const callbackUrl = new URL('/api/auth/github/callback', url.origin).toString();
        const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
        authorizeUrl.searchParams.set('client_id', normalizedAuthConfig.githubClientId);
        authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
        authorizeUrl.searchParams.set('state', state);

        return redirectResponse(authorizeUrl.toString(), [
          buildCookie(GITHUB_STATE_COOKIE, state, secureCookie, 600),
          buildCookie(GITHUB_RETURN_TO_COOKIE, returnTo, secureCookie, 600),
        ]);
      }

      if (path === '/api/auth/github/callback' && req.method === 'GET') {
        if (!hasGitHubLogin) {
          return errorResponse('GitHub login is not configured', 503);
        }

        const error = url.searchParams.get('error');
        if (error) {
          return errorResponse(error, 401);
        }

        const cookies = parseCookies(req.headers.get('Cookie'));
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        if (!code || !state || cookies[GITHUB_STATE_COOKIE] !== state) {
          return errorResponse('Invalid GitHub login state', 400);
        }

        const accessToken = await exchangeGithubCode(req, normalizedAuthConfig, code);
        const githubProfile = await fetchGithubUser(accessToken);
        const user = await store.upsertGitHubUser(githubProfile);
        const sessionUser = normalizedAuthConfig.adminGithubLogins.has(githubProfile.login.toLowerCase())
          ? await store.updateUser(user.handle, { role: 'admin' })
          : user;
        const { sessionId } = await store.createSession(sessionUser.handle);
        const returnTo = normalizeReturnTo(cookies[GITHUB_RETURN_TO_COOKIE] ?? '/dashboard', req.url);

        return redirectResponse(returnTo, [
          buildCookie('session_id', sessionId, secureCookie, 86400),
          clearCookie(GITHUB_STATE_COOKIE, secureCookie),
          clearCookie(GITHUB_RETURN_TO_COOKIE, secureCookie),
        ]);
      }

      if (path === '/api/auth/logout' && req.method === 'POST') {
        const cookies = parseCookies(req.headers.get('Cookie'));
        if (cookies.session_id) {
          await store.deleteSession(cookies.session_id);
        }

        return jsonResponse({ ok: true }, {
          headers: appendSetCookies(undefined, [clearCookie('session_id', secureCookie)]),
        });
      }

      if (path === '/api/users' && req.method === 'GET') {
        const currentUser = await store.getCurrentUser(parseCookies(req.headers.get('Cookie')).session_id ?? null);
        if (!isAdmin(currentUser)) {
          return errorResponse('Admin access required', currentUser ? 403 : 401);
        }

        const q = url.searchParams.get('q')?.trim() || '';
        const users = await store.listUsers(q);
        return jsonResponse(users);
      }

      if (path === '/api/commands' && req.method === 'GET') {
        const q = url.searchParams.get('q')?.trim() || '';
        const commands = await store.listCommands(q);
        return jsonResponse(commands);
      }

      if (path === '/api/commands' && req.method === 'POST') {
        const body = (await req.json()) as PublishCommandInput;
        const user = await store.getCurrentUser(parseCookies(req.headers.get('Cookie')).session_id ?? null);

        if (!user || user.handle !== body.publisherHandle || !['admin', 'publisher'].includes(user.role ?? 'member')) {
          return errorResponse('Unauthorized publishing action', 401);
        }

        let created: Awaited<ReturnType<RegistryStore['createCommand']>>;
        try {
          created = await store.createCommand(body);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to publish command';
          if (message.includes('already taken')) {
            return errorResponse(message, 409);
          }
          if (message.includes('Publisher profile not found')) {
            return errorResponse(message, 404);
          }
          throw error;
        }

        return jsonResponse(created);
      }

      const commandMatch = path.match(/^\/api\/commands\/([a-zA-Z0-9_-]+)$/);
      if (commandMatch && req.method === 'GET') {
        const command = await store.getCommand(commandMatch[1]);
        if (!command) {
          return errorResponse('Command not found', 404);
        }

        return jsonResponse(command);
      }

      const commandAuditMatch = path.match(/^\/api\/commands\/([a-zA-Z0-9_-]+)\/audit$/);
      if (commandAuditMatch && req.method === 'GET') {
        const version = url.searchParams.get('v') || undefined;
        const report = await buildAuditReport(store, commandAuditMatch[1], version);
        if (!report) {
          return errorResponse('Command not found for audit', 404);
        }

        return jsonResponse(report);
      }

      const auditReportMatch = path.match(/^\/api\/audit-reports\/([a-zA-Z0-9_-]+)$/);
      if (auditReportMatch && req.method === 'GET') {
        const version = url.searchParams.get('v') || undefined;
        const report = await buildAuditReport(store, auditReportMatch[1], version);
        if (!report) {
          return errorResponse('Command not found for audit', 404);
        }

        return jsonResponse(report);
      }

      const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
      if (userMatch) {
        const handle = decodeURIComponent(userMatch[1]);

        if (req.method === 'GET') {
          const currentUser = await store.getCurrentUser(parseCookies(req.headers.get('Cookie')).session_id ?? null);
          if (!currentUser) {
            return errorResponse('Unauthorized', 401);
          }
          if (currentUser.handle !== handle && !isAdmin(currentUser)) {
            return errorResponse('Forbidden', 403);
          }

          const profile = await store.getUser(handle);
          if (!profile) {
            return errorResponse('Publisher profile not found', 404);
          }

          return jsonResponse(profile);
        }

        if (req.method === 'PATCH') {
          const currentUser = await store.getCurrentUser(parseCookies(req.headers.get('Cookie')).session_id ?? null);
          if (!currentUser) {
            return errorResponse('Unauthorized', 401);
          }

          const profile = await store.getUser(handle);
          if (!profile) {
            return errorResponse('Publisher profile not found', 404);
          }

          if (currentUser.handle !== handle && !isAdmin(currentUser)) {
            return errorResponse('Forbidden', 403);
          }

          const patch = (await req.json()) as RegistryUserUpdate;
          const updated = await store.updateUser(handle, isAdmin(currentUser) ? patch : sanitizeSelfProfilePatch(patch));
          return jsonResponse(updated);
        }
      }

      const publisherMatch = path.match(/^\/api\/publishers\/([^/]+)$/);
      if (publisherMatch && req.method === 'GET') {
        const profile = await store.getPublisherProfile(decodeURIComponent(publisherMatch[1]));
        if (!profile) {
          return errorResponse('Publisher profile not found', 404);
        }

        return jsonResponse(profile);
      }

      return errorResponse('Not Found', 404);
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  };
}

export type { AuditReport, PublisherProfile };
