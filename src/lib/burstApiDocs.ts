export type BurstApiCompletion = {
  label: string;
  type: 'function' | 'property' | 'variable';
  detail: string;
  info: string;
  apply?: string;
};

export const burstApiCompletions: BurstApiCompletion[] = [
  {
    label: 'ai',
    type: 'property',
    detail: 'Burst AI helper',
    info: 'Guarded access to Chrome built-in AI APIs. Use availability() before invoking a task.',
  },
  {
    label: 'ai.availability',
    type: 'function',
    detail: "availability(kind: 'prompt' | 'summarizer' | 'translator' | 'languageDetector' | 'writer' | 'rewriter' | 'proofreader')",
    info: 'Checks whether a Chrome built-in AI API is available, downloadable, or unavailable in the current browser.',
    apply: "ai.availability('prompt')",
  },
  {
    label: 'ai.prompt',
    type: 'function',
    detail: 'prompt(input, options?)',
    info: 'Runs the Chrome Prompt API through a temporary LanguageModel session.',
    apply: "ai.prompt('Summarize this page title: ' + title)",
  },
  {
    label: 'ai.summarize',
    type: 'function',
    detail: 'summarize(text, options?)',
    info: 'Uses the Summarizer API for long-form text condensation when available.',
    apply: 'ai.summarize(selection)',
  },
  {
    label: 'ai.detectLanguage',
    type: 'function',
    detail: 'detectLanguage(text)',
    info: 'Uses the Language Detector API and returns the best detection result.',
    apply: 'ai.detectLanguage(selection)',
  },
  {
    label: 'ai.translate',
    type: 'function',
    detail: 'translate(text, { sourceLanguage, targetLanguage })',
    info: 'Uses the Translator API for on-device translation where supported.',
    apply: "ai.translate(selection, { sourceLanguage: 'auto', targetLanguage: 'en' })",
  },
  {
    label: 'ai.write',
    type: 'function',
    detail: 'write(prompt, options?)',
    info: 'Uses the Writer API to create new text from instructions and optional context.',
    apply: "ai.write('Write a concise reply to: ' + selection)",
  },
  {
    label: 'ai.rewrite',
    type: 'function',
    detail: 'rewrite(text, options?)',
    info: 'Uses the Rewriter API to revise or restructure text.',
    apply: "ai.rewrite(selection, { tone: 'more-formal' })",
  },
  {
    label: 'ai.proofread',
    type: 'function',
    detail: 'proofread(text, options?)',
    info: 'Uses the Proofreader API when available and returns corrections or corrected text.',
    apply: 'ai.proofread(selection)',
  },
  {
    label: 'toast',
    type: 'function',
    detail: 'toast(message | options)',
    info: 'Shows command feedback in the Burst palette.',
    apply: "toast({ title: 'Done', message: 'Command finished', variant: 'success' })",
  },
  {
    label: 'list',
    type: 'function',
    detail: 'list({ title, items })',
    info: 'Returns a searchable list to the command palette. Items may include actions.',
  },
  {
    label: 'page.querySelector',
    type: 'function',
    detail: 'page.querySelector(selector)',
    info: 'Reads a DOM element through Burst’s safe page wrapper.',
  },
  {
    label: 'clipboard.writeText',
    type: 'function',
    detail: 'clipboard.writeText(text)',
    info: 'Writes text to the clipboard through Burst’s capability-gated helper.',
  },
  {
    label: 'fetch',
    type: 'function',
    detail: 'fetch(url, init?)',
    info: 'Fetches same-origin resources through Burst’s capability-gated helper.',
    apply: "fetch('/api/me')",
  },
  {
    label: 'navigate.to',
    type: 'function',
    detail: 'navigate.to(url)',
    info: 'Navigates the current page to a same-origin URL resolved against the active page.',
    apply: "navigate.to('/?nav=overview')",
  },
  {
    label: 'navigate.open',
    type: 'function',
    detail: 'navigate.open(url)',
    info: 'Opens a same-origin URL in a new browser tab next to the current tab.',
    apply: "navigate.open('/?nav=overview')",
  },
];

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
