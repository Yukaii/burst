import type { AuditReport, PublisherProfile, RegistryUserUpdate } from '@/src/lib/registryApi';
import { buildAuditReport, type GitHubUserProfile, type PublishCommandInput, type PublishCommandPackInput, type RegistryStore, type StoredRegistryCommandPack } from './registryStore';

type RegistryAuthConfig = {
  githubClientId?: string;
  githubClientSecret?: string;
  adminGithubLogins?: string | string[];
  aiProvider?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicBaseUrl?: string;
  anthropicModel?: string;
  googleAiApiKey?: string;
  googleAiBaseUrl?: string;
  googleAiModel?: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
  openrouterModel?: string;
  cloudflareAiApiToken?: string;
  cloudflareAccountId?: string;
  cloudflareAiBaseUrl?: string;
  cloudflareAiModel?: string;
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
  if (!value) return '/home';

  const fallback = '/home';
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

type HostedAiProvider = 'openai-compatible' | 'openai' | 'anthropic' | 'google' | 'openrouter' | 'workers-ai';

type HostedAiConfig = {
  provider: HostedAiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  cloudflareAccountId?: string;
};

function normalizeAiProvider(value: string | undefined): HostedAiProvider {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'openai' || normalized === 'anthropic' || normalized === 'google' || normalized === 'openrouter' || normalized === 'workers-ai') {
    return normalized;
  }
  return 'openai-compatible';
}

function resolveHostedAiConfig(config: RegistryAuthConfig): HostedAiConfig {
  const provider = normalizeAiProvider(config.aiProvider);
  const genericApiKey = config.aiApiKey?.trim() || '';
  const genericBaseUrl = config.aiBaseUrl?.trim() || '';
  const genericModel = config.aiModel?.trim() || '';

  if (provider === 'anthropic') {
    return {
      provider,
      apiKey: config.anthropicApiKey?.trim() || genericApiKey,
      baseUrl: config.anthropicBaseUrl?.trim() || genericBaseUrl || 'https://api.anthropic.com',
      model: config.anthropicModel?.trim() || genericModel || 'claude-3-5-haiku-latest',
    };
  }

  if (provider === 'google') {
    return {
      provider,
      apiKey: config.googleAiApiKey?.trim() || genericApiKey,
      baseUrl: config.googleAiBaseUrl?.trim() || genericBaseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      model: config.googleAiModel?.trim() || genericModel || 'gemini-1.5-flash',
    };
  }

  if (provider === 'openrouter') {
    return {
      provider,
      apiKey: config.openrouterApiKey?.trim() || genericApiKey,
      baseUrl: config.openrouterBaseUrl?.trim() || genericBaseUrl || 'https://openrouter.ai/api/v1',
      model: config.openrouterModel?.trim() || genericModel || 'openai/gpt-4o-mini',
    };
  }

  if (provider === 'workers-ai') {
    return {
      provider,
      apiKey: config.cloudflareAiApiToken?.trim() || genericApiKey,
      baseUrl: config.cloudflareAiBaseUrl?.trim() || genericBaseUrl || 'https://api.cloudflare.com/client/v4',
      model: config.cloudflareAiModel?.trim() || genericModel || '@cf/meta/llama-3.1-8b-instruct',
      cloudflareAccountId: config.cloudflareAccountId?.trim(),
    };
  }

  return {
    provider,
    apiKey: config.openaiApiKey?.trim() || genericApiKey,
    baseUrl: config.openaiBaseUrl?.trim() || genericBaseUrl || 'https://api.openai.com/v1',
    model: config.openaiModel?.trim() || genericModel || 'gpt-4o-mini',
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

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createPlainApiToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `burst_${btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 40)}`;
}

function readBearerToken(request: Request): string | undefined {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function getCurrentUserFromCookie(request: Request, store: RegistryStore) {
  return store.getCurrentUser(parseCookies(request.headers.get('Cookie')).session_id ?? null);
}

async function getCurrentUserFromBearer(request: Request, store: RegistryStore) {
  const token = readBearerToken(request);
  if (!token) return null;
  return store.getUserByApiTokenHash(await sha256Hex(token));
}

function buildScriptGenerationPrompt(body: {
  request?: unknown;
  currentCode?: unknown;
  matchPatterns?: unknown;
  pageTitle?: unknown;
}): string {
  return [
    'Create a Burst local command script for this user request.',
    'Return only JavaScript code. Do not use markdown fences.',
    '',
    'Rules:',
    '- Output a complete `export default async function run(context) { ... }` module.',
    '- Prefer destructuring from context: page, selection, clipboard, toast, list, ai, title, url.',
    '- Use page.querySelector/page.querySelectorAll instead of direct document access.',
    '- Use clipboard.writeText instead of navigator.clipboard directly.',
    '- Use toast for user-visible feedback.',
    '- If using AI, call ai.availability before ai.prompt/ai.summarize/ai.translate/etc.',
    '- Avoid eval, new Function, remote scripts, cookie reads, chrome.storage, clipboard reads, and external data exfiltration.',
    '',
    `Match patterns: ${Array.isArray(body.matchPatterns) ? body.matchPatterns.join(', ') : '<all_urls>'}`,
    `Page title context: ${typeof body.pageTitle === 'string' ? body.pageTitle : 'Unknown'}`,
    '',
    'User request:',
    typeof body.request === 'string' ? body.request : '',
    '',
    'Current code:',
    typeof body.currentCode === 'string' ? body.currentCode : '',
  ].join('\n');
}

function extractJavaScript(response: string): string {
  const fenced = /```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/i.exec(response);
  return (fenced?.[1] ?? response).trim();
}

async function generateScriptWithHostedAi(config: HostedAiConfig, body: {
  request?: unknown;
  currentCode?: unknown;
  matchPatterns?: unknown;
  pageTitle?: unknown;
}): Promise<string> {
  if (config.provider === 'anthropic') {
    return generateScriptWithAnthropic(config, body);
  }

  if (config.provider === 'google') {
    return generateScriptWithGoogle(config, body);
  }

  if (config.provider === 'workers-ai') {
    return generateScriptWithWorkersAi(config, body);
  }

  return generateScriptWithOpenAiCompatible(config, body);
}

async function generateScriptWithOpenAiCompatible(config: HostedAiConfig, body: {
  request?: unknown;
  currentCode?: unknown;
  matchPatterns?: unknown;
  pageTitle?: unknown;
}): Promise<string> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You write safe Burst local command scripts. Return only JavaScript code.',
        },
        {
          role: 'user',
          content: buildScriptGenerationPrompt(body),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Hosted AI provider failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Hosted AI provider returned no content.');
  return extractJavaScript(content);
}

async function generateScriptWithAnthropic(config: HostedAiConfig, body: {
  request?: unknown;
  currentCode?: unknown;
  matchPatterns?: unknown;
  pageTitle?: unknown;
}): Promise<string> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2000,
      system: 'You write safe Burst local command scripts. Return only JavaScript code.',
      messages: [
        {
          role: 'user',
          content: buildScriptGenerationPrompt(body),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Hosted AI provider failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const content = data.content?.find((part) => part.type === 'text' || typeof part.text === 'string')?.text;
  if (!content) throw new Error('Hosted AI provider returned no content.');
  return extractJavaScript(content);
}

async function generateScriptWithGoogle(config: HostedAiConfig, body: {
  request?: unknown;
  currentCode?: unknown;
  matchPatterns?: unknown;
  pageTitle?: unknown;
}): Promise<string> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'You write safe Burst local command scripts. Return only JavaScript code.',
                '',
                buildScriptGenerationPrompt(body),
              ].join('\n'),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Hosted AI provider failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!content) throw new Error('Hosted AI provider returned no content.');
  return extractJavaScript(content);
}

async function generateScriptWithWorkersAi(config: HostedAiConfig, body: {
  request?: unknown;
  currentCode?: unknown;
  matchPatterns?: unknown;
  pageTitle?: unknown;
}): Promise<string> {
  if (!config.cloudflareAccountId) {
    throw new Error('Cloudflare Workers AI requires CLOUDFLARE_ACCOUNT_ID.');
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/accounts/${encodeURIComponent(config.cloudflareAccountId)}/ai/run/${config.model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You write safe Burst local command scripts. Return only JavaScript code.',
        },
        {
          role: 'user',
          content: buildScriptGenerationPrompt(body),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Hosted AI provider failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json() as { result?: { response?: string; text?: string }; response?: string };
  const content = data.result?.response || data.result?.text || data.response;
  if (!content) throw new Error('Hosted AI provider returned no content.');
  return extractJavaScript(content);
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
  const aiConfig = resolveHostedAiConfig(authConfig);

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
          'Access-Control-Allow-Headers': 'Content-Type, Cookie, Authorization',
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
        const returnTo = normalizeReturnTo(cookies[GITHUB_RETURN_TO_COOKIE] ?? '/home', req.url);

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
        const currentUser = await getCurrentUserFromCookie(req, store);
        if (!isAdmin(currentUser)) {
          return errorResponse('Admin access required', currentUser ? 403 : 401);
        }

        const q = url.searchParams.get('q')?.trim() || '';
        const users = await store.listUsers(q);
        return jsonResponse(users);
      }

      if (path === '/api/me/tokens' && req.method === 'GET') {
        const user = await getCurrentUserFromCookie(req, store);
        if (!user) return errorResponse('Unauthorized', 401);
        return jsonResponse(await store.listApiTokens(user.handle));
      }

      if (path === '/api/me/tokens' && req.method === 'POST') {
        const user = await getCurrentUserFromCookie(req, store);
        if (!user) return errorResponse('Unauthorized', 401);
        const body = await req.json().catch(() => ({})) as { name?: string };
        const token = createPlainApiToken();
        const record = await store.createApiToken(user.handle, body.name || 'Extension AI token', await sha256Hex(token));
        return jsonResponse({ ...record, token });
      }

      const tokenMatch = path.match(/^\/api\/me\/tokens\/([a-zA-Z0-9_-]+)$/);
      if (tokenMatch && req.method === 'DELETE') {
        const user = await getCurrentUserFromCookie(req, store);
        if (!user) return errorResponse('Unauthorized', 401);
        await store.deleteApiToken(user.handle, tokenMatch[1]);
        return jsonResponse({ ok: true });
      }

      if (path === '/api/ai/generate-script' && req.method === 'POST') {
        const user = await getCurrentUserFromBearer(req, store);
        if (!user) return errorResponse('Invalid registry API token', 401);
        if (!aiConfig.apiKey) return errorResponse(`Hosted AI is not configured for provider "${aiConfig.provider}" on this registry.`, 503);
        const body = await req.json().catch(() => ({}));
        if (!body || typeof body !== 'object' || typeof (body as { request?: unknown }).request !== 'string') {
          return errorResponse('request is required', 400);
        }
        const code = await generateScriptWithHostedAi(aiConfig, body as Parameters<typeof generateScriptWithHostedAi>[1]);
        return jsonResponse({ code });
      }

      if (path === '/api/commands' && req.method === 'GET') {
        const q = url.searchParams.get('q')?.trim() || '';
        const host = url.searchParams.get('host')?.trim() || undefined;
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
        const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
        const commands = await store.listCommands(q, host);
        if (url.searchParams.has('limit') || url.searchParams.has('offset')) {
          return jsonResponse({
            commands: commands.slice(offset, offset + limit),
            total: commands.length,
            offset,
            limit,
            hasMore: offset + limit < commands.length,
          });
        }
        return jsonResponse(commands);
      }

      if (path === '/api/packs' && req.method === 'GET') {
        const q = url.searchParams.get('q')?.trim() || '';
        const host = url.searchParams.get('host')?.trim() || undefined;
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
        const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
        const packs = await store.listPacks(q, host);
        if (url.searchParams.has('limit') || url.searchParams.has('offset')) {
          return jsonResponse({
            packs: packs.slice(offset, offset + limit),
            total: packs.length,
            offset,
            limit,
            hasMore: offset + limit < packs.length,
          });
        }
        return jsonResponse(packs);
      }

      const packMatch = path.match(/^\/api\/packs\/([a-zA-Z0-9_-]+)$/);
      if (packMatch && req.method === 'GET') {
        const pack = await store.getPack(packMatch[1]);
        if (!pack) {
          return errorResponse('Command pack not found', 404);
        }

        return jsonResponse(pack);
      }

      if (path === '/api/packs' && req.method === 'POST') {
        const body = (await req.json()) as {
          id?: string;
          title?: string;
          description?: string;
          website?: string;
          matchPatterns?: string[];
          publisherHandle?: string;
          sourceUrl?: string;
          icon?: unknown;
          commandIds?: string[];
          version?: string;
        };
        const user = await getCurrentUserFromCookie(req, store);

        if (!user || user.handle !== body.publisherHandle || !['admin', 'publisher'].includes(user.role ?? 'member')) {
          return errorResponse('Unauthorized publishing action', 401);
        }
        if (!body.id || !body.title || !body.description || !body.website || !body.sourceUrl) {
          return errorResponse('Pack id, title, description, website, and source URL are required', 400);
        }
        if (!Array.isArray(body.commandIds) || body.commandIds.length === 0) {
          return errorResponse('Select at least one command for the pack', 400);
        }

        let created: StoredRegistryCommandPack;
        try {
          created = await store.createPack({
            id: body.id,
            title: body.title,
            description: body.description,
            website: body.website,
            matchPatterns: Array.isArray(body.matchPatterns) && body.matchPatterns.length > 0 ? body.matchPatterns : ['<all_urls>'],
            publisherHandle: body.publisherHandle,
            sourceUrl: body.sourceUrl,
            icon: body.icon && typeof body.icon === 'object' ? (body.icon as any) : { type: 'initials' as const, value: body.title.substring(0, 2).toUpperCase() },
            commandIds: body.commandIds,
            version: body.version,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to publish pack';
          if (message.includes('already taken')) {
            return errorResponse(message, 409);
          }
          if (message.includes('not found') || message.includes('were not found')) {
            return errorResponse(message, 404);
          }
          if (message.includes('only include commands published')) {
            return errorResponse(message, 403);
          }
          throw error;
        }

        return jsonResponse(created, { status: 201 });
      }

      if (path === '/api/commands' && req.method === 'POST') {
        const body = (await req.json()) as PublishCommandInput;
        const user = await getCurrentUserFromCookie(req, store);

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
          const currentUser = await getCurrentUserFromCookie(req, store);
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
          const currentUser = await getCurrentUserFromCookie(req, store);
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
