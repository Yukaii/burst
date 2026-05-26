import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import { burstAiApiNames, burstApiCompletions } from '@/src/lib/burstApiDocs';
import { validateLocalScriptCode } from './utils';

const contextHelpers = [
  { name: 'ai', pattern: /\bai\./ },
  { name: 'clipboard', pattern: /\bclipboard\./ },
  { name: 'list', pattern: /\blist\s*\(/ },
  { name: 'navigate', pattern: /\bnavigate\./ },
  { name: 'page', pattern: /\bpage\./ },
  { name: 'toast', pattern: /\btoast\s*\(/ },
];

const completionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/[\w.]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  return {
    from: word.from,
    options: burstApiCompletions.map((item) => ({
      label: item.label,
      type: item.type,
      detail: item.detail,
      info: item.info,
      apply: item.apply ?? item.label,
    })),
  };
};

export function createBurstApiAutocomplete() {
  return autocompletion({
    override: [completionSource],
    activateOnTyping: true,
    defaultKeymap: true,
  });
}

function getRunDestructuredParams(code: string) {
  const match = /export\s+default\s+async\s+function\s+run\s*\(\s*\{([^)]*)\}/.exec(code);
  if (!match) return null;
  return new Set(
    match[1]
      .split(',')
      .map((part) => part.split(':')[0]?.trim())
      .filter(Boolean),
  );
}

export function createBurstApiLinter() {
  return linter((view) => {
    const code = view.state.doc.toString();
    const diagnostics: Diagnostic[] = [];
    const syntax = validateLocalScriptCode(code);

    if (!syntax.ok) {
      diagnostics.push({
        from: syntax.from,
        to: syntax.to,
        severity: 'error',
        message: syntax.message,
      });
    }

    const locationMutation = /\b(?:window\.)?location\.href\s=|(?:window\.)?location\s=/g;
    for (const match of code.matchAll(locationMutation)) {
      diagnostics.push({
        from: match.index ?? 0,
        to: (match.index ?? 0) + match[0].length,
        severity: 'warning',
        message: 'Use navigate.to(url) or navigate.open(url) instead of mutating location directly.',
      });
    }

    const windowOpen = /\bwindow\.open\s*\(/g;
    for (const match of code.matchAll(windowOpen)) {
      diagnostics.push({
        from: match.index ?? 0,
        to: (match.index ?? 0) + match[0].length,
        severity: 'warning',
        message: 'Use navigate.open(url); direct window.open is not available in the sandbox.',
      });
    }

    for (const apiName of burstAiApiNames) {
      const match = new RegExp(`\\b${apiName}\\b`).exec(code);
      if (!match) continue;
      diagnostics.push({
        from: match.index,
        to: match.index + apiName.length,
        severity: 'warning',
        message: `Prefer Burst's ai helper over direct ${apiName} access so availability and capability checks stay consistent.`,
      });
    }

    const destructuredParams = getRunDestructuredParams(code);
    if (destructuredParams) {
      for (const helper of contextHelpers) {
        if (destructuredParams.has(helper.name)) continue;
        const match = helper.pattern.exec(code);
        if (!match || code.slice(Math.max(0, match.index - 8), match.index) === 'context.') continue;
        diagnostics.push({
          from: match.index,
          to: match.index + helper.name.length,
          severity: 'warning',
          message: `Add ${helper.name} to run({ ... }) before using this Burst helper.`,
        });
      }
    }

    const aiCall = /\bai\.(prompt|summarize|detectLanguage|translate|write|rewrite|proofread)\s*\(/.exec(code);
    if (aiCall && !/\bai\.availability\s*\(/.test(code)) {
      diagnostics.push({
        from: aiCall.index,
        to: aiCall.index + aiCall[0].length,
        severity: 'warning',
        message: 'Call ai.availability() before invoking built-in AI; Chrome support varies by API, version, and device.',
      });
    }

    return diagnostics;
  });
}
