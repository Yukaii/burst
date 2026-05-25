import { burstApiQuickStart } from './burstApiDocs';

type BuiltInAiApi = {
  availability?: (options?: Record<string, unknown>) => Promise<string> | string;
  available?: (options?: Record<string, unknown>) => Promise<string> | string;
  create?: (options?: Record<string, unknown>) => Promise<{
    prompt?: (input: string, options?: Record<string, unknown>) => Promise<string>;
    destroy?: () => void;
  }>;
};

type BuiltInAiGlobal = typeof globalThis & {
  LanguageModel?: BuiltInAiApi;
};

export async function getPromptApiAvailability(): Promise<string> {
  const api = (globalThis as BuiltInAiGlobal).LanguageModel;
  if (!api) return 'unavailable';
  if (typeof api.availability === 'function') return api.availability();
  if (typeof api.available === 'function') return api.available();
  return typeof api.create === 'function' ? 'available' : 'unavailable';
}

export async function generateBurstScriptWithAi(input: {
  request: string;
  currentCode: string;
  matchPatterns: string[];
  pageTitle?: string;
}): Promise<string> {
  const api = (globalThis as BuiltInAiGlobal).LanguageModel;
  if (!api?.create) {
    throw new Error('Chrome Prompt API is unavailable in this browser.');
  }

  const session = await api.create({
    initialPrompts: [
      {
        role: 'system',
        content: 'You write safe Burst local command scripts. Return only JavaScript code. Do not use markdown fences.',
      },
    ],
  });

  if (!session.prompt) {
    session.destroy?.();
    throw new Error('Chrome Prompt API session does not expose prompt().');
  }

  try {
    const response = await session.prompt(buildScriptGenerationPrompt(input));
    return extractJavaScript(response);
  } finally {
    session.destroy?.();
  }
}

function buildScriptGenerationPrompt(input: {
  request: string;
  currentCode: string;
  matchPatterns: string[];
  pageTitle?: string;
}): string {
  return [
    'Create a Burst local command script for the user request below.',
    '',
    'Burst script rules:',
    '- Output a complete `export default async function run(context) { ... }` module.',
    '- Prefer destructuring from context: page, selection, clipboard, toast, list, ai, title, url.',
    '- Use `page.querySelector()` and `page.querySelectorAll()` instead of direct document access.',
    '- Use `clipboard.writeText()` instead of navigator.clipboard directly.',
    '- Use `toast()` for user feedback.',
    '- Use `list()` when returning selectable results.',
    '- If using AI, call `await ai.availability(...)` before `ai.prompt()`, `ai.summarize()`, `ai.translate()`, etc.',
    '- Avoid eval, new Function, remote scripts, cookie reads, chrome.storage, clipboard reads, and sending page data to external services.',
    '- Keep the code concise and readable.',
    '',
    `Match patterns: ${input.matchPatterns.join(', ') || '<all_urls>'}`,
    `Page title context: ${input.pageTitle || 'Unknown'}`,
    '',
    'User request:',
    input.request,
    '',
    'Current code for reference:',
    input.currentCode || burstApiQuickStart,
  ].join('\n');
}

function extractJavaScript(response: string): string {
  const fenced = /```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/i.exec(response);
  return (fenced?.[1] ?? response).trim();
}
