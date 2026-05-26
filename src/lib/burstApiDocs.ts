export type BurstApiCompletion = {
  label: string;
  type: 'function' | 'property' | 'variable';
  detail: string;
  info: string;
  apply?: string;
  category?: 'Page' | 'Feedback' | 'Navigation' | 'Network' | 'AI';
};

export const burstApiCompletions: BurstApiCompletion[] = [
  {
    label: 'ai',
    type: 'property',
    detail: 'Burst AI helper',
    info: 'Guarded access to Chrome built-in AI APIs. Use availability() before invoking a task.',
    category: 'AI',
  },
  {
    label: 'ai.availability',
    type: 'function',
    detail: "availability(kind: 'prompt' | 'summarizer' | 'translator' | 'languageDetector' | 'writer' | 'rewriter' | 'proofreader')",
    info: 'Checks whether a Chrome built-in AI API is available, downloadable, or unavailable in the current browser.',
    apply: "ai.availability('prompt')",
    category: 'AI',
  },
  {
    label: 'ai.prompt',
    type: 'function',
    detail: 'prompt(input, options?)',
    info: 'Runs the Chrome Prompt API through a temporary LanguageModel session.',
    apply: "ai.prompt('Summarize this page title: ' + title)",
    category: 'AI',
  },
  {
    label: 'ai.summarize',
    type: 'function',
    detail: 'summarize(text, options?)',
    info: 'Uses the Summarizer API for long-form text condensation when available.',
    apply: 'ai.summarize(selection)',
    category: 'AI',
  },
  {
    label: 'ai.detectLanguage',
    type: 'function',
    detail: 'detectLanguage(text)',
    info: 'Uses the Language Detector API and returns the best detection result.',
    apply: 'ai.detectLanguage(selection)',
    category: 'AI',
  },
  {
    label: 'ai.translate',
    type: 'function',
    detail: 'translate(text, { sourceLanguage, targetLanguage })',
    info: 'Uses the Translator API for on-device translation where supported.',
    apply: "ai.translate(selection, { sourceLanguage: 'auto', targetLanguage: 'en' })",
    category: 'AI',
  },
  {
    label: 'ai.write',
    type: 'function',
    detail: 'write(prompt, options?)',
    info: 'Uses the Writer API to create new text from instructions and optional context.',
    apply: "ai.write('Write a concise reply to: ' + selection)",
    category: 'AI',
  },
  {
    label: 'ai.rewrite',
    type: 'function',
    detail: 'rewrite(text, options?)',
    info: 'Uses the Rewriter API to revise or restructure text.',
    apply: "ai.rewrite(selection, { tone: 'more-formal' })",
    category: 'AI',
  },
  {
    label: 'ai.proofread',
    type: 'function',
    detail: 'proofread(text, options?)',
    info: 'Uses the Proofreader API when available and returns corrections or corrected text.',
    apply: 'ai.proofread(selection)',
    category: 'AI',
  },
  {
    label: 'toast',
    type: 'function',
    detail: 'toast(message | options)',
    info: 'Shows command feedback in the Burst palette.',
    apply: "toast({ title: 'Done', message: 'Command finished', variant: 'success' })",
    category: 'Feedback',
  },
  {
    label: 'list',
    type: 'function',
    detail: 'list({ title, items })',
    info: 'Returns a searchable list to the command palette. Items may include actions.',
    apply: "list({ id: 'links', title: 'Links', items: [] })",
    category: 'Feedback',
  },
  {
    label: 'page.querySelector',
    type: 'function',
    detail: 'page.querySelector(selector)',
    info: 'Reads a DOM element through Burst’s safe page wrapper.',
    apply: "page.querySelector('main')",
    category: 'Page',
  },
  {
    label: 'clipboard.writeText',
    type: 'function',
    detail: 'clipboard.writeText(text)',
    info: 'Writes text to the clipboard through Burst’s capability-gated helper.',
    apply: "clipboard.writeText(location.href)",
    category: 'Feedback',
  },
  {
    label: 'fetch',
    type: 'function',
    detail: 'fetch(url, init?)',
    info: 'Fetches same-origin resources through Burst’s capability-gated helper.',
    apply: "fetch('/api/me')",
    category: 'Network',
  },
  {
    label: 'navigate.to',
    type: 'function',
    detail: 'navigate.to(url)',
    info: 'Navigates the current page to a same-origin URL resolved against the active page.',
    apply: "navigate.to('/?nav=overview')",
    category: 'Navigation',
  },
  {
    label: 'navigate.open',
    type: 'function',
    detail: 'navigate.open(url)',
    info: 'Opens a same-origin URL in a new browser tab next to the current tab.',
    apply: "navigate.open('/?nav=overview')",
    category: 'Navigation',
  },
];

export const burstApiReferenceSections = ['Page', 'Feedback', 'Navigation', 'Network', 'AI'] as const;

export const burstApiQuickStart = `export default async function run({ ai, selection, toast }) {
  const status = await ai.availability('prompt');
  if (status === 'unavailable') {
    toast({ title: 'AI unavailable', message: 'Chrome built-in AI is not ready here.', variant: 'warning' });
    return;
  }

  const answer = await ai.prompt('Rewrite this clearly: ' + selection);
  toast({ title: 'AI result', message: answer, variant: 'success' });
}`;

export const burstAiApiNames = [
  'LanguageModel',
  'Summarizer',
  'Translator',
  'LanguageDetector',
  'Writer',
  'Rewriter',
  'Proofreader',
];
