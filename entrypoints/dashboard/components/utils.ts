import { EditorView } from '@codemirror/view';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { LocalScript } from '@/src/lib/localScripts';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { getCommandIconHost, getFaviconUrl, type CommandIcon } from '@/src/lib/commands';
import { GIT_REGISTRIES_STORAGE_KEY } from './types';
import type { GitRegistry } from './types';

export function parseGitUrl(input: string): { owner: string; repo: string; branch: string } | null {
  try {
    let clean = input.trim();
    if (clean.startsWith('http://')) clean = clean.substring(7);
    if (clean.startsWith('https://')) clean = clean.substring(8);
    if (clean.endsWith('.git')) clean = clean.slice(0, -4);
    if (clean.endsWith('/')) clean = clean.slice(0, -1);

    const parts = clean.split('/');
    let owner = '';
    let repo = '';
    let branch = 'main';

    if (parts[0].includes('.')) {
      if (parts.length < 3) return null;
      owner = parts[1];
      repo = parts[2];
      if (parts[3] === 'tree' && parts[4]) {
        branch = parts.slice(4).join('/');
      }
    } else {
      if (parts.length < 2) return null;
      owner = parts[0];
      repo = parts[1];
      if (parts[2] === 'tree' && parts[3]) {
        branch = parts.slice(3).join('/');
      }
    }

    if (!owner || !repo) return null;
    return { owner, repo, branch };
  } catch {
    return null;
  }
}

export async function loadGitRegistries(): Promise<GitRegistry[]> {
  const extensionStorage = typeof browser !== 'undefined' && browser.storage?.local;
  if (extensionStorage) {
    const result = await extensionStorage.get(GIT_REGISTRIES_STORAGE_KEY);
    return (result[GIT_REGISTRIES_STORAGE_KEY] as GitRegistry[]) || [];
  }
  const raw = localStorage.getItem(GIT_REGISTRIES_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GitRegistry[];
  } catch {
    return [];
  }
}

export async function saveGitRegistries(registries: GitRegistry[]): Promise<void> {
  const extensionStorage = typeof browser !== 'undefined' && browser.storage?.local;
  if (extensionStorage) {
    await extensionStorage.set({ [GIT_REGISTRIES_STORAGE_KEY]: registries });
    return;
  }
  localStorage.setItem(GIT_REGISTRIES_STORAGE_KEY, JSON.stringify(registries));
}

export function createEditorTheme(fontFamily: string, fontSize: number, isDark: boolean) {
  if (isDark) {
    return EditorView.theme({
      '&': { height: '100%', backgroundColor: '#111827', color: '#dbeafe', fontSize: `${fontSize}px` },
      '.cm-scroller': { fontFamily, lineHeight: '1.55' },
      '.cm-content': { padding: '14px 0' },
      '.cm-line': { color: '#dbeafe', textTransform: 'none', padding: '0 14px' },
      '.cm-gutters': { backgroundColor: '#111827', borderRight: '1px solid rgba(148, 163, 184, 0.14)', color: '#64748b' },
      '.cm-activeLine': { backgroundColor: 'rgba(30, 41, 59, 0.55)' },
      '.cm-activeLineGutter': { backgroundColor: 'rgba(30, 41, 59, 0.55)' },
      '.cm-cursor': { borderLeftColor: '#7dd3fc' },
      '&.cm-focused': { outline: 'none' },
      '.tok-keyword': { color: '#7dd3fc' },
      '.tok-variableName': { color: '#dbeafe' },
      '.tok-propertyName': { color: '#bfdbfe' },
      '.tok-string': { color: '#86efac' },
      '.tok-comment': { color: '#64748b' },
      '.tok-punctuation': { color: '#94a3b8' },
    });
  }
  return EditorView.theme({
    '&': { height: '100%', backgroundColor: '#ffffff', color: '#1e293b', fontSize: `${fontSize}px` },
    '.cm-scroller': { fontFamily, lineHeight: '1.55' },
    '.cm-content': { padding: '14px 0' },
    '.cm-line': { color: '#1e293b', textTransform: 'none', padding: '0 14px' },
    '.cm-gutters': { backgroundColor: '#f8fafc', borderRight: '1px solid rgba(0, 0, 0, 0.08)', color: '#64748b' },
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.03)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.03)' },
    '.cm-cursor': { borderLeftColor: '#0ea5e9' },
    '&.cm-focused': { outline: 'none' },
    '.tok-keyword': { color: '#0284c7' },
    '.tok-variableName': { color: '#1e293b' },
    '.tok-propertyName': { color: '#0f172a' },
    '.tok-string': { color: '#15803d' },
    '.tok-comment': { color: '#94a3b8' },
    '.tok-punctuation': { color: '#475569' },
  });
}

export function compileLocalScript(code: string) {
  if (!/^\s*export\s+default\s+(async\s+)?function\b/.test(code)) {
    throw new Error('Local scripts must use: export default function run(context) { ... }');
  }
  const error = getFirstSyntaxError(code);
  if (error) throw error;
}

export function validateLocalScriptCode(code: string): { ok: true } | { ok: false; message: string; from: number; to: number } {
  try {
    compileLocalScript(code);
    return { ok: true };
  } catch (error) {
    const lineEnd = code.indexOf('\n');
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      from: error instanceof LocalScriptSyntaxError ? error.from : 0,
      to: error instanceof LocalScriptSyntaxError ? error.to : Math.min(code.length, Math.max(1, lineEnd)),
    };
  }
}

const OXFMT_FORMAT_ENDPOINT = '/api/editor/format-local-script';

async function formatLocalScriptCodeWithOxfmt(registryServerBaseUrl: string, code: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(new URL(OXFMT_FORMAT_ENDPOINT, registryServerBaseUrl).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null) as { code?: unknown } | null;
    return typeof payload?.code === 'string' ? payload.code : null;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function formatLocalScriptCodeFallback(code: string): string {
  compileLocalScript(code);

  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const formatted: string[] = [];
  let indent = 0;
  let inTemplateLiteral = false;

  for (const rawLine of lines) {
    if (inTemplateLiteral) {
      formatted.push(rawLine);
      inTemplateLiteral = isInTemplateLiteral(rawLine, inTemplateLiteral);
      continue;
    }

    const line = rawLine.trimEnd().trimStart();
    if (!line) {
      if (formatted[formatted.length - 1] !== '') formatted.push('');
      continue;
    }

    if (/^[}\])]/.test(line)) indent = Math.max(0, indent - 1);
    formatted.push(`${'  '.repeat(indent)}${line}`);

    const opens = countUnquoted(line, /[{\[(]/g);
    const closes = countUnquoted(line, /[}\])]/g);
    indent = Math.max(0, indent + opens - closes);
    inTemplateLiteral = isInTemplateLiteral(line, inTemplateLiteral);
  }

  return `${formatted.join('\n').trim()}\n`;
}

export async function formatLocalScriptCode(code: string, registryServerBaseUrl: string): Promise<string> {
  compileLocalScript(code);

  const formattedWithOxfmt = await formatLocalScriptCodeWithOxfmt(registryServerBaseUrl, code);
  if (formattedWithOxfmt) {
    return formattedWithOxfmt.endsWith('\n') ? formattedWithOxfmt : `${formattedWithOxfmt}\n`;
  }

  return formatLocalScriptCodeFallback(code);
}

class LocalScriptSyntaxError extends Error {
  constructor(message: string, readonly from: number, readonly to: number) {
    super(message);
    this.name = 'LocalScriptSyntaxError';
  }
}

function getFirstSyntaxError(code: string): LocalScriptSyntaxError | undefined {
  let errorPosition: number | undefined;
  javascriptLanguage.parser.parse(code).iterate({
    enter(node) {
      if (node.type.isError) {
        errorPosition = node.from;
        return false;
      }
      return undefined;
    },
  });

  if (errorPosition === undefined) return undefined;
  const { line, column } = getLineColumn(code, errorPosition);
  const lineEnd = code.indexOf('\n', errorPosition);
  const to = lineEnd === -1 ? Math.max(errorPosition + 1, code.length) : lineEnd;
  return new LocalScriptSyntaxError(`SyntaxError: invalid JavaScript near line ${line}, column ${column}`, errorPosition, to);
}

function getLineColumn(code: string, position: number): { line: number; column: number } {
  const prefix = code.slice(0, position);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function countUnquoted(line: string, pattern: RegExp): number {
  const stripped = line
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
    .replace(/\/\/.*$/, '');
  return stripped.match(pattern)?.length ?? 0;
}

function isInTemplateLiteral(line: string, initialState: boolean): boolean {
  let inTemplate = initialState;
  let escaped = false;
  for (const char of line) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '`') inTemplate = !inTemplate;
  }
  return inTemplate;
}

export function parseMatchPatternsInput(value: string): string[] {
  const patterns = value.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
  return patterns.length > 0 ? patterns : ['<all_urls>'];
}

export function formatMatchPatterns(patterns: string[]): string {
  return patterns.length > 0 ? patterns.join(', ') : '<all_urls>';
}

export function getStatusClassName(status: LocalScript['status']): string {
  if (status === 'enabled') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  if (status === 'disabled') return 'bg-red-500/10 text-red-400 border-red-500/25';
  return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
}

export function getStatusDotClassName(status: LocalScript['status']): string {
  if (status === 'enabled') return 'bg-emerald-400';
  if (status === 'disabled') return 'bg-red-400';
  return 'bg-amber-400';
}

export function getScriptAuditStatus(script: LocalScript): 'pass' | 'warning' | 'fail' {
  return analyzeScriptCode(script.code, script.matchPatterns).status;
}

export function getLocalIconLabel(icon: CommandIcon): string {
  if (icon.type === 'initials' || icon.type === 'emoji') return icon.value;
  if (icon.type === 'lucide') return icon.name.slice(0, 2).toUpperCase();
  if (icon.type === 'favicon') return 'F';
  return 'B';
}

export function getLocalIconUrl(icon: CommandIcon, matchPatterns: string[] = [], website = 'all sites'): string | undefined {
  if (icon.type === 'url' || icon.type === 'asset') return icon.src;
  if (icon.type === 'favicon') {
    const host = getCommandIconHost({ icon, matchPatterns, website });
    return host ? getFaviconUrl(host) : undefined;
  }
  return undefined;
}

export function getIconKey(icon: CommandIcon): string {
  if (icon.type === 'favicon') return `favicon:${icon.host ?? ''}`;
  if (icon.type === 'url' || icon.type === 'asset') return `${icon.type}:${icon.src}`;
  if (icon.type === 'lucide') return `lucide:${icon.name}`;
  return `${icon.type}:${icon.value}`;
}

export function iconsMatch(left: CommandIcon, right: CommandIcon): boolean {
  return getIconKey(left) === getIconKey(right);
}
