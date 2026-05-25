import { afterEach, describe, expect, test } from 'bun:test';
import { createRegistryHandler } from '../apps/registry/src/registryHandler.ts';
import { createMemoryRegistryStore } from '../apps/registry/src/registryStore.ts';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

function jsonRequest(path, init = {}) {
  return new Request(`http://registry.test${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function createSession(store, login, patch = {}) {
  const user = await store.upsertGitHubUser({
    id: `${login}-id`,
    login,
    name: login,
    avatar_url: `https://github.com/${login}.png`,
    html_url: `https://github.com/${login}`,
    bio: null,
  });
  const updated = Object.keys(patch).length > 0 ? await store.updateUser(user.handle, patch) : user;
  const { sessionId } = await store.createSession(updated.handle);
  return { user: updated, sessionId };
}

function commandPayload(publisherHandle, overrides = {}) {
  return {
    id: 'backend-test-command',
    title: 'Backend test command',
    description: 'A command published by backend tests.',
    website: 'example.com',
    matchPatterns: ['example.com/*'],
    publisherHandle,
    trustLevel: 'community',
    risk: 'low',
    permissions: [],
    sourceUrl: 'https://github.com/example/backend-test-command',
    icon: { type: 'initials', value: 'BT' },
    code: 'export default async function run() { return true; }',
    version: '1.0.0',
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
});

describe('registry backend auth endpoints', () => {
  test('reports GitHub auth availability from config', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore(), {
      githubClientId: 'client-id',
      githubClientSecret: 'client-secret',
    });

    const response = await handler(new Request('http://registry.test/api/auth/config'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.githubEnabled).toBe(true);
    expect(body.loginUrl).toBe('http://registry.test/api/auth/github/start');
  });

  test('normalizes unsafe OAuth return targets', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore(), {
      githubClientId: 'client-id',
      githubClientSecret: 'client-secret',
    });

    const response = await handler(new Request('http://registry.test/api/auth/github/start?returnTo=https://evil.test/phish'));
    expect(response.status).toBe(302);
    const cookies = response.headers.getSetCookie?.() ?? [];
    const returnCookie = cookies.find((cookie) => cookie.startsWith('burst_github_return_to='));
    expect(returnCookie).toContain('%2Fdashboard');
  });

  test('promotes configured GitHub admin logins during OAuth callback', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, {
      githubClientId: 'client-id',
      githubClientSecret: 'client-secret',
      adminGithubLogins: 'RootUser, another-admin',
    });

    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.includes('github.com/login/oauth/access_token')) {
        return Response.json({ access_token: 'token' });
      }
      if (href.includes('api.github.com/user')) {
        return Response.json({
          id: 42,
          login: 'rootuser',
          name: 'Root User',
          avatar_url: 'https://github.com/rootuser.png',
          html_url: 'https://github.com/rootuser',
          bio: null,
        });
      }
      return new Response('Unexpected URL', { status: 500 });
    };

    const response = await handler(new Request('http://registry.test/api/auth/github/callback?code=abc&state=state-1', {
      headers: {
        Cookie: 'burst_github_state=state-1; burst_github_return_to=%2Fdashboard',
      },
    }));
    expect(response.status).toBe(302);

    const user = await store.getUser('@rootuser');
    expect(user?.role).toBe('admin');
  });

  test('rejects OAuth callback errors and invalid state without creating sessions', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, {
      githubClientId: 'client-id',
      githubClientSecret: 'client-secret',
    });

    const providerError = await handler(new Request('http://registry.test/api/auth/github/callback?error=access_denied'));
    expect(providerError.status).toBe(401);
    expect((await providerError.json()).error).toBe('access_denied');

    const badState = await handler(new Request('http://registry.test/api/auth/github/callback?code=abc&state=wrong', {
      headers: {
        Cookie: 'burst_github_state=expected',
      },
    }));
    expect(badState.status).toBe(400);
    expect((await badState.json()).error).toBe('Invalid GitHub login state');
  });

  test('surfaces GitHub token exchange failures during OAuth callback', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore(), {
      githubClientId: 'client-id',
      githubClientSecret: 'client-secret',
    });
    console.error = () => {};

    globalThis.fetch = async (url) => {
      if (String(url).includes('github.com/login/oauth/access_token')) {
        return Response.json({ error_description: 'Bad verification code' });
      }
      return new Response('Unexpected URL', { status: 500 });
    };

    const response = await handler(new Request('http://registry.test/api/auth/github/callback?code=abc&state=state-1', {
      headers: {
        Cookie: 'burst_github_state=state-1; burst_github_return_to=%2Fdashboard',
      },
    }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('Bad verification code');
  });

  test('logout deletes the active session', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const { sessionId } = await createSession(store, 'logout-user');

    const before = await handler(new Request('http://registry.test/api/auth/me', {
      headers: { Cookie: `session_id=${sessionId}` },
    }));
    expect((await before.json()).handle).toBe('@logout-user');

    const logout = await handler(new Request('http://registry.test/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: `session_id=${sessionId}` },
    }));
    expect(logout.status).toBe(200);

    const after = await handler(new Request('http://registry.test/api/auth/me', {
      headers: { Cookie: `session_id=${sessionId}` },
    }));
    expect((await after.json()).handle).toBe('guest');
  });
});

describe('registry backend permissions', () => {
  test('keeps command catalog, command details, publisher profiles, and audits public', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore());

    expect((await handler(new Request('http://registry.test/api/commands'))).status).toBe(200);
    expect((await handler(new Request('http://registry.test/api/commands/copy-github-branch'))).status).toBe(200);
    expect((await handler(new Request('http://registry.test/api/publishers/%40schen'))).status).toBe(200);
    expect((await handler(new Request('http://registry.test/api/audit-reports/copy-github-branch'))).status).toBe(200);
  });

  test('paginates the public command catalog when requested', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore());
    const response = await handler(new Request('http://registry.test/api/commands?limit=2&offset=1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.commands.length).toBe(2);
    expect(body.offset).toBe(1);
    expect(body.limit).toBe(2);
    expect(body.total).toBeGreaterThan(2);
    expect(body.hasMore).toBe(true);
  });

  test('filters the public command catalog by host before pagination', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore());
    const response = await handler(new Request('http://registry.test/api/commands?host=github.com&limit=20&offset=0'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.commands.some((command) => command.id === 'copy-github-branch')).toBe(true);
    expect(body.commands.every((command) =>
      command.matchPatterns.includes('<all_urls>') ||
      command.matchPatterns.some((pattern) => pattern.includes('github.com')),
    )).toBe(true);
  });

  test('only self or admin can read private user management records', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const publisher = await createSession(store, 'publisher-user');
    const other = await createSession(store, 'other-user');
    const admin = await createSession(store, 'admin-user', { role: 'admin' });

    const guestResponse = await handler(new Request('http://registry.test/api/users/%40publisher-user'));
    expect(guestResponse.status).toBe(401);

    const otherResponse = await handler(new Request('http://registry.test/api/users/%40publisher-user', {
      headers: { Cookie: `session_id=${other.sessionId}` },
    }));
    expect(otherResponse.status).toBe(403);

    const selfResponse = await handler(new Request('http://registry.test/api/users/%40publisher-user', {
      headers: { Cookie: `session_id=${publisher.sessionId}` },
    }));
    expect(selfResponse.status).toBe(200);

    const adminResponse = await handler(new Request('http://registry.test/api/users/%40publisher-user', {
      headers: { Cookie: `session_id=${admin.sessionId}` },
    }));
    expect(adminResponse.status).toBe(200);
  });

  test('requires admin access for user directory and filters by query', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    await createSession(store, 'alpha-publisher', { role: 'publisher' });
    await createSession(store, 'beta-member', { role: 'member' });
    const admin = await createSession(store, 'directory-admin', { role: 'admin' });

    const guestResponse = await handler(new Request('http://registry.test/api/users'));
    expect(guestResponse.status).toBe(401);

    const memberResponse = await handler(new Request('http://registry.test/api/users', {
      headers: { Cookie: 'session_id=missing-session' },
    }));
    expect(memberResponse.status).toBe(401);

    const publisher = await createSession(store, 'plain-publisher', { role: 'publisher' });
    const publisherResponse = await handler(new Request('http://registry.test/api/users', {
      headers: { Cookie: `session_id=${publisher.sessionId}` },
    }));
    expect(publisherResponse.status).toBe(403);

    const adminResponse = await handler(new Request('http://registry.test/api/users?q=alpha', {
      headers: { Cookie: `session_id=${admin.sessionId}` },
    }));
    expect(adminResponse.status).toBe(200);
    const users = await adminResponse.json();
    expect(users.map((user) => user.handle)).toContain('@alpha-publisher');
    expect(users.map((user) => user.handle)).not.toContain('@beta-member');
  });

  test('allows admins to update role and verification fields', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    await createSession(store, 'publisher-user');
    const admin = await createSession(store, 'admin-user', { role: 'admin' });

    const response = await handler(jsonRequest('/api/users/%40publisher-user', {
      method: 'PATCH',
      headers: { Cookie: `session_id=${admin.sessionId}` },
      body: JSON.stringify({
        role: 'admin',
        verified: true,
        verifiedSources: ['github.com/publisher-user'],
      }),
    }));

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.role).toBe('admin');
    expect(updated.verified).toBe(true);
    expect(updated.verifiedSources).toEqual(['github.com/publisher-user']);
  });

  test('sanitizes self profile updates to prevent role and verification escalation', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const member = await createSession(store, 'self-edit-user', { role: 'member', verified: false });

    const response = await handler(jsonRequest('/api/users/%40self-edit-user', {
      method: 'PATCH',
      headers: { Cookie: `session_id=${member.sessionId}` },
      body: JSON.stringify({
        name: 'Self Edited',
        bio: 'Updated bio',
        role: 'admin',
        verified: true,
        verifiedSources: ['github.com/self-edit-user'],
      }),
    }));

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe('Self Edited');
    expect(updated.bio).toBe('Updated bio');
    expect(updated.verifiedSources).toEqual(['github.com/self-edit-user']);
    expect(updated.role).toBe('member');
    expect(updated.verified).toBe(false);
  });

  test('requires the publisher session to match the command publisher handle', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const publisher = await createSession(store, 'publisher-user');

    const guestResponse = await handler(jsonRequest('/api/commands', {
      method: 'POST',
      body: JSON.stringify(commandPayload('@publisher-user')),
    }));
    expect(guestResponse.status).toBe(401);

    const mismatchResponse = await handler(jsonRequest('/api/commands', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify(commandPayload('@someone-else')),
    }));
    expect(mismatchResponse.status).toBe(401);

    const member = await createSession(store, 'member-user', { role: 'member' });
    const memberResponse = await handler(jsonRequest('/api/commands', {
      method: 'POST',
      headers: { Cookie: `session_id=${member.sessionId}` },
      body: JSON.stringify(commandPayload('@member-user')),
    }));
    expect(memberResponse.status).toBe(401);
  });

  test('publishes commands for matching publisher sessions and rejects duplicates', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const publisher = await createSession(store, 'publisher-user');

    const first = await handler(jsonRequest('/api/commands', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify(commandPayload('@publisher-user')),
    }));
    expect(first.status).toBe(200);
    expect((await first.json()).id).toBe('backend-test-command');

    const duplicate = await handler(jsonRequest('/api/commands', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify(commandPayload('@publisher-user')),
    }));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toContain('Command ID is already taken');
  });

  test('returns dynamic audit reports from both audit routes', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store);
    const publisher = await createSession(store, 'audit-publisher', { role: 'publisher' });

    await handler(jsonRequest('/api/commands', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify(commandPayload('@audit-publisher', {
        id: 'dynamic-audit-command',
        matchPatterns: ['<all_urls>'],
        permissions: ['Read cookies'],
        code: 'document.cookie; eval("console.log(1)")',
      })),
    }));

    const canonical = await handler(new Request('http://registry.test/api/audit-reports/dynamic-audit-command?v=1.0.0'));
    const nested = await handler(new Request('http://registry.test/api/commands/dynamic-audit-command/audit?v=1.0.0'));
    expect(canonical.status).toBe(200);
    expect(nested.status).toBe(200);

    const canonicalBody = await canonical.json();
    const nestedBody = await nested.json();
    expect(canonicalBody.commandId).toBe('dynamic-audit-command');
    expect(canonicalBody.version).toBe('1.0.0');
    expect(canonicalBody.status).toBe('fail');
    expect(nestedBody).toEqual(canonicalBody);
  });

  test('creates API tokens and authorizes hosted AI generation', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, { aiApiKey: 'provider-key' });
    const publisher = await createSession(store, 'ai-user');

    const createToken = await handler(jsonRequest('/api/me/tokens', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify({ name: 'Extension token' }),
    }));
    expect(createToken.status).toBe(200);
    const tokenBody = await createToken.json();
    expect(tokenBody.token).toStartWith('burst_');

    const listed = await handler(new Request('http://registry.test/api/me/tokens', {
      headers: { Cookie: `session_id=${publisher.sessionId}` },
    }));
    expect(listed.status).toBe(200);
    expect((await listed.json()).length).toBe(1);

    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
      expect(init.headers.Authorization).toBe('Bearer provider-key');
      return Response.json({
        choices: [{ message: { content: '```js\nexport default async function run({ toast }) { toast("ok"); }\n```' } }],
      });
    };

    const generate = await handler(jsonRequest('/api/ai/generate-script', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.token}` },
      body: JSON.stringify({ request: 'toast ok' }),
    }));
    expect(generate.status).toBe(200);
    expect((await generate.json()).code).toContain('export default async function run');
  });

  test('supports Anthropic hosted AI provider configuration', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, {
      aiProvider: 'anthropic',
      anthropicApiKey: 'anthropic-key',
      anthropicModel: 'claude-test',
    });
    const publisher = await createSession(store, 'anthropic-user');
    const createToken = await handler(jsonRequest('/api/me/tokens', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify({ name: 'Anthropic token' }),
    }));
    const tokenBody = await createToken.json();

    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
      expect(init.headers['x-api-key']).toBe('anthropic-key');
      const body = JSON.parse(init.body);
      expect(body.model).toBe('claude-test');
      return Response.json({
        content: [{ type: 'text', text: 'export default async function run() {}' }],
      });
    };

    const generate = await handler(jsonRequest('/api/ai/generate-script', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.token}` },
      body: JSON.stringify({ request: 'make script' }),
    }));
    expect(generate.status).toBe(200);
    expect((await generate.json()).code).toContain('export default async function run');
  });

  test('supports Google hosted AI provider configuration', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, {
      aiProvider: 'google',
      googleAiApiKey: 'google-key',
      googleAiModel: 'gemini-test',
    });
    const publisher = await createSession(store, 'google-user');
    const createToken = await handler(jsonRequest('/api/me/tokens', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify({ name: 'Google token' }),
    }));
    const tokenBody = await createToken.json();

    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=google-key');
      const body = JSON.parse(init.body);
      expect(body.contents[0].parts[0].text).toContain('make script');
      return Response.json({
        candidates: [{ content: { parts: [{ text: 'export default async function run() {}' }] } }],
      });
    };

    const generate = await handler(jsonRequest('/api/ai/generate-script', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.token}` },
      body: JSON.stringify({ request: 'make script' }),
    }));
    expect(generate.status).toBe(200);
    expect((await generate.json()).code).toContain('export default async function run');
  });

  test('supports OpenRouter hosted AI provider configuration', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, {
      aiProvider: 'openrouter',
      openrouterApiKey: 'openrouter-key',
      openrouterModel: 'openai/test-model',
    });
    const publisher = await createSession(store, 'openrouter-user');
    const createToken = await handler(jsonRequest('/api/me/tokens', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify({ name: 'OpenRouter token' }),
    }));
    const tokenBody = await createToken.json();

    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(init.headers.Authorization).toBe('Bearer openrouter-key');
      expect(JSON.parse(init.body).model).toBe('openai/test-model');
      return Response.json({
        choices: [{ message: { content: 'export default async function run() {}' } }],
      });
    };

    const generate = await handler(jsonRequest('/api/ai/generate-script', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.token}` },
      body: JSON.stringify({ request: 'make script' }),
    }));
    expect(generate.status).toBe(200);
    expect((await generate.json()).code).toContain('export default async function run');
  });

  test('supports Cloudflare Workers AI provider configuration', async () => {
    const store = createMemoryRegistryStore();
    const handler = createRegistryHandler(store, {
      aiProvider: 'workers-ai',
      cloudflareAiApiToken: 'cf-token',
      cloudflareAccountId: 'account-123',
      cloudflareAiModel: '@cf/test/model',
    });
    const publisher = await createSession(store, 'workers-ai-user');
    const createToken = await handler(jsonRequest('/api/me/tokens', {
      method: 'POST',
      headers: { Cookie: `session_id=${publisher.sessionId}` },
      body: JSON.stringify({ name: 'Workers AI token' }),
    }));
    const tokenBody = await createToken.json();

    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.cloudflare.com/client/v4/accounts/account-123/ai/run/@cf/test/model');
      expect(init.headers.Authorization).toBe('Bearer cf-token');
      return Response.json({
        result: { response: 'export default async function run() {}' },
      });
    };

    const generate = await handler(jsonRequest('/api/ai/generate-script', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBody.token}` },
      body: JSON.stringify({ request: 'make script' }),
    }));
    expect(generate.status).toBe(200);
    expect((await generate.json()).code).toContain('export default async function run');
  });
});

describe('registry backend error boundaries', () => {
  test('returns 404s for missing command, audit, publisher, and API routes', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore());

    expect((await handler(new Request('http://registry.test/api/commands/missing-command'))).status).toBe(404);
    expect((await handler(new Request('http://registry.test/api/audit-reports/missing-command'))).status).toBe(404);
    expect((await handler(new Request('http://registry.test/api/publishers/%40missing'))).status).toBe(404);
    expect((await handler(new Request('http://registry.test/api/unknown'))).status).toBe(404);
  });

  test('responds to CORS preflight with allowed methods and headers', async () => {
    const handler = createRegistryHandler(createMemoryRegistryStore());

    const response = await handler(new Request('http://registry.test/api/commands', { method: 'OPTIONS' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Cookie');
  });
});
