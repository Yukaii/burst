import React from 'react';
import { X } from 'lucide-react';
import type { LocalScript } from '@/src/lib/localScripts';
import { detectRequiredCapabilities, stripDefaultExport } from '@/src/lib/localScripts';
import { compileLocalScript } from './utils';

export function TestHarnessModal({
  open,
  onClose,
  selectedScript,
  mockUrl,
  setMockUrl,
  mockTitle,
  setMockTitle,
  mockSelection,
  setMockSelection,
  mockHtml,
  setMockHtml,
  testOutput,
  setTestOutput,
}: {
  open: boolean;
  onClose: () => void;
  selectedScript: LocalScript | undefined;
  mockUrl: string;
  setMockUrl: (v: string) => void;
  mockTitle: string;
  setMockTitle: (v: string) => void;
  mockSelection: string;
  setMockSelection: (v: string) => void;
  mockHtml: string;
  setMockHtml: (v: string) => void;
  testOutput: string;
  setTestOutput: (v: string) => void;
}) {
  if (!open || !selectedScript) return null;

  const script = selectedScript;
  const detectedCapabilities = detectRequiredCapabilities(script.code);

  async function runTest() {
    setTestOutput('Running...');

    try {
      compileLocalScript(script.code);
    } catch (error) {
      setTestOutput(`Syntax Check Failed:\n${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[LOG] ${msg}`);
      setTestOutput(logs.join('\n'));
    };
    const logError = (msg: string) => {
      logs.push(`[ERROR] ${msg}`);
      setTestOutput(logs.join('\n'));
    };

    try {
      const parser = new DOMParser();
      const mockDoc = parser.parseFromString(mockHtml, 'text/html');

      const mockPage = {
        querySelector: (selector: string) => {
          log(`page.querySelector('${selector}')`);
          const result = mockDoc.querySelector(selector);
          log(`  => ${result ? `<${result.tagName.toLowerCase()}> with text "${result.textContent?.trim()}"` : 'null'}`);
          return result;
        },
        querySelectorAll: (selector: string) => {
          log(`page.querySelectorAll('${selector}')`);
          const results = mockDoc.querySelectorAll(selector);
          log(`  => Found ${results.length} element(s)`);
          return results;
        },
      };

      let clipboardContent = '';
      const mockNavigator = {
        ...navigator,
        clipboard: {
          writeText: async (text: string) => {
            clipboardContent = text;
            log(`navigator.clipboard.writeText("${text}")`);
          },
        },
      };

      const mockConsole = {
        log: (...args: unknown[]) => {
          const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          log(`console.log: ${str}`);
        },
        error: (...args: unknown[]) => {
          const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          logError(`console.error: ${str}`);
        },
        warn: (...args: unknown[]) => {
          const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          log(`console.warn: ${str}`);
        },
      };

      const mockWindow = {
        ...window,
        console: mockConsole,
        getSelection: () => ({ toString: () => mockSelection }),
      };

      const mockToast = (message: string) => log(`toast("${message}")`);

      const context = {
        page: mockPage,
        window: mockWindow,
        location: new URL(mockUrl),
        navigator: mockNavigator,
        selection: mockSelection,
        url: mockUrl,
        title: mockTitle,
        toast: mockToast,
      };

      const functionSource = stripDefaultExport(script.code);
      const runnerSource = `
        return async function(context) {
          const { page, window, location, navigator, selection, url, title, toast } = context;
          const document = page;
          const console = window.console;
          const run = ${functionSource};
          return await run(context);
        }
      `;
      const runner = new Function(runnerSource)();

      log('Starting execution...');
      await runner(context);
      log('Execution completed successfully.');

      if (clipboardContent) {
        logs.push(`\n[Clipboard Output] "${clipboardContent}"`);
        setTestOutput(logs.join('\n'));
      }
    } catch (error) {
      logError(`Runtime Exception: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }

  return (
    <div className="fixed-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content-card-large">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Script Test Harness</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Run and debug <strong>{selectedScript.name}</strong> inside a simulated browser sandbox.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-y-auto flex-1 pr-1">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-muted-foreground select-none">
              <span className="text-[10px] tracking-wider uppercase">Detected Capabilities:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {detectedCapabilities.length === 0 ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">none</span>
                ) : (
                  detectedCapabilities.map((cap) => (
                    <span key={cap} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20">{cap}</span>
                  ))
                )}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Mock URL
              <input type="text" value={mockUrl} onChange={(e) => setMockUrl(e.target.value)} placeholder="https://example.com"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </label>
            <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Mock Title
              <input type="text" value={mockTitle} onChange={(e) => setMockTitle(e.target.value)} placeholder="Page Title"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </label>
            <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Mock Selection
              <input type="text" value={mockSelection} onChange={(e) => setMockSelection(e.target.value)} placeholder="Selected text"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </label>
            <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-1 min-h-[140px]">
              Mock DOM HTML
              <textarea value={mockHtml} onChange={(e) => setMockHtml(e.target.value)} placeholder="<div>Mock page content</div>"
                className="flex w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-sm focus-visible:outline-none font-mono resize-none" />
            </label>
          </div>

          <div className="flex flex-col gap-3 min-h-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">Console & Execution Logs</span>
            <pre className="flex-1 p-3 rounded-md bg-zinc-950 text-zinc-200 border border-zinc-800 font-mono text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap select-text shadow-inner">
              {testOutput || 'No execution logs.'}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4 mt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-4 py-2 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={runTest}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
          >
            Run Execution
          </button>
        </div>
      </div>
    </div>
  );
}
