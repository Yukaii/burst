import type { AuditReport, PublisherProfile } from '@/src/lib/registryApi';
import { buildAuditReport, type PublishCommandInput, type RegistryStore } from './registryStore';

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
};

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

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init?.headers || {}),
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, { status });
}

function sessionCookie(value: string): string {
  return `session_id=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

function expiredSessionCookie(): string {
  return 'session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

export function createRegistryHandler(store: RegistryStore) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

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

    if (!path.startsWith('/api')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      if (path === '/api/auth/me' && req.method === 'GET') {
        const cookies = parseCookies(req.headers.get('Cookie'));
        const user = await store.getCurrentUser(cookies.session_id ?? null);
        return jsonResponse(user ?? guestUser);
      }

      if (path === '/api/auth/login' && req.method === 'POST') {
        const body = (await req.json()) as { handle?: string };
        if (!body.handle) {
          return errorResponse('Missing handle');
        }

        if (body.handle === 'guest') {
          const cookies = parseCookies(req.headers.get('Cookie'));
          if (cookies.session_id) {
            await store.deleteSession(cookies.session_id);
          }

          return jsonResponse({ ok: true, user: guestUser }, {
            headers: {
              'Set-Cookie': expiredSessionCookie(),
            },
          });
        }

        const { sessionId, user } = await store.createSession(body.handle);
        return jsonResponse({ ok: true, user }, {
          headers: {
            'Set-Cookie': sessionCookie(sessionId),
          },
        });
      }

      if (path === '/api/auth/logout' && req.method === 'POST') {
        const cookies = parseCookies(req.headers.get('Cookie'));
        if (cookies.session_id) {
          await store.deleteSession(cookies.session_id);
        }

        return jsonResponse({ ok: true }, {
          headers: {
            'Set-Cookie': expiredSessionCookie(),
          },
        });
      }

      if (path === '/api/commands' && req.method === 'GET') {
        const q = url.searchParams.get('q')?.trim() || '';
        const commands = await store.listCommands(q);
        return jsonResponse(commands);
      }

      if (path === '/api/commands' && req.method === 'POST') {
        const body = (await req.json()) as PublishCommandInput;
        const user = await store.getCurrentUser(parseCookies(req.headers.get('Cookie')).session_id ?? null);

        if (!user || user.handle !== body.publisherHandle) {
          return errorResponse('Unauthorized publishing action', 401);
        }

        const created = await store.createCommand(body);
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

      const publisherMatch = path.match(/^\/api\/publishers\/(@[a-zA-Z0-9_-]+)$/);
      if (publisherMatch && req.method === 'GET') {
        const profile = await store.getPublisherProfile(publisherMatch[1]);
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
