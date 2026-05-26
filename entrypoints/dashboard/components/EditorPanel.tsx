import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import { emacs } from '@replit/codemirror-emacs';
import {
  SlidersHorizontal,
  MoreVertical,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ExternalLink,
  RotateCcw,
  Unlink,
  Sparkles,
  X,
} from 'lucide-react';
import type { LocalScript } from '@/src/lib/localScripts';
import { detectRequiredCapabilities, prepareLocalScriptForSave, stripDefaultExport } from '@/src/lib/localScripts';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { burstApiCompletions, burstApiQuickStart, burstApiReferenceSections } from '@/src/lib/burstApiDocs';
import { generateBurstScriptWithAi, getPromptApiAvailability } from '@/src/lib/browserAi';
import { IconSelect, Tooltip, AuditIssueDot } from './ui';
import { getStatusClassName, getStatusDotClassName, parseMatchPatternsInput } from './utils';
import { createEditorTheme } from './utils';
import { themesMap } from './constants';
import type { ExtensionSettings } from '@/src/lib/settings';
import { createBurstApiAutocomplete, createBurstApiLinter } from './editorExtensions';

export function EditorPanel({
  selectedScript,
  scripts,
  leftSidebarOpen,
  onToggleLeft,
  rightPanelOpen,
  onToggleRight,
  saveState,
  hasUnsavedChanges,
  onSave,
  onFormat,
  onDelete,
  onUpdateScript,
  onResetFork,
  onUnlinkFork,
  onOpenTestHarness,
  onOpenEditorPrefs,
  editorFontFamily,
  editorFontSize,
  editorTheme,
  editorKeymap,
  editorWordWrap,
  settings,
  isDraggingRight,
  onStartRightDrag,
}: {
  selectedScript: LocalScript;
  scripts: LocalScript[];
  leftSidebarOpen: boolean;
  onToggleLeft: () => void;
  rightPanelOpen: boolean;
  onToggleRight: () => void;
  saveState: string;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onFormat: () => void;
  onDelete: () => void;
  onUpdateScript: (patch: Partial<LocalScript>) => void;
  onResetFork: () => void;
  onUnlinkFork: () => void;
  onOpenTestHarness: () => void;
  onOpenEditorPrefs: () => void;
  editorFontFamily: string;
  editorFontSize: number;
  editorTheme: string;
  editorKeymap: 'default' | 'vim' | 'emacs';
  editorWordWrap: boolean;
  settings: ExtensionSettings;
  isDraggingRight: boolean;
  onStartRightDrag: (e: React.MouseEvent) => void;
}) {
  const [statusMenuOpen, setStatusMenuOpen] = React.useState(false);
  const [navbarMenuOpen, setNavbarMenuOpen] = React.useState(false);
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [assistantPrompt, setAssistantPrompt] = React.useState('');
  const [assistantStatus, setAssistantStatus] = React.useState('');
  const [isGeneratingScript, setIsGeneratingScript] = React.useState(false);
  const nameMeasureRef = React.useRef<HTMLSpanElement>(null);
  const [nameInputWidth, setNameInputWidth] = React.useState(180);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const isRegistryFork = selectedScript.originRegistryKind === 'official' && Boolean(selectedScript.originCommandId);
  const storeHref = selectedScript.originCommandId
    ? `${(selectedScript.originRegistryUrl || 'http://localhost:5174').replace(/\/$/, '')}/discover/${encodeURIComponent(selectedScript.originCommandId)}`
    : undefined;

  React.useEffect(() => {
    const measuredWidth = nameMeasureRef.current?.offsetWidth ?? 0;
    setNameInputWidth(Math.min(Math.max(measuredWidth + 18, 160), 520));
  }, [selectedScript.name]);

  const activeTheme = React.useMemo(() => {
    return settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : settings.theme;
  }, [settings.theme]);

  const editorThemeExtension = React.useMemo(
    () => createEditorTheme(editorFontFamily, editorFontSize, activeTheme === 'dark'),
    [editorFontFamily, editorFontSize, activeTheme],
  );

  const baseLayoutTheme = React.useMemo(() => {
    return EditorView.theme({
      '&': { height: '100%', fontSize: `${editorFontSize}px` },
      '.cm-scroller': { fontFamily: editorFontFamily, lineHeight: '1.55' },
      '.cm-content': { padding: '14px 0' },
      '.cm-line': { padding: '0 14px', textTransform: 'none' },
    });
  }, [editorFontFamily, editorFontSize]);

  const selectedThemeValue = React.useMemo(() => {
    if (editorTheme && editorTheme !== 'default') {
      return (themesMap[editorTheme] as unknown as Parameters<typeof CodeMirror>[0]['theme']) || (activeTheme === 'dark' ? 'dark' : 'light');
    }
    return activeTheme === 'dark' ? 'dark' : 'light';
  }, [editorTheme, activeTheme]);

  const editorExtensions = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = [
      javascript({ jsx: true, typescript: true }),
      createBurstApiAutocomplete(),
      createBurstApiLinter(),
    ];
    if (editorTheme === 'default') {
      list.push(editorThemeExtension);
    } else {
      list.push(baseLayoutTheme);
    }
    if (editorKeymap === 'vim') list.push(vim());
    else if (editorKeymap === 'emacs') list.push(emacs());
    if (editorWordWrap) list.push(EditorView.lineWrapping);
    return list;
  }, [editorTheme, editorThemeExtension, baseLayoutTheme, editorKeymap, editorWordWrap]);

  async function handleGenerateWithAi() {
    const request = assistantPrompt.trim();
    if (!request || isGeneratingScript) return;

    setIsGeneratingScript(true);
    setAssistantStatus('Checking Chrome built-in AI availability...');
    try {
      const availability = await getPromptApiAvailability();
      if (availability === 'unavailable' && settings.aiGenerationProvider === 'browser') {
        setAssistantStatus('Chrome Prompt API is unavailable. Update Chrome or enable the built-in AI feature for extensions.');
        return;
      }

      setAssistantStatus(availability === 'unavailable'
        ? 'Chrome built-in AI unavailable. Trying registry hosted fallback...'
        : availability === 'downloadable' || availability === 'downloading'
        ? 'Chrome may need to download the local model before generating.'
        : 'Generating script locally with Chrome built-in AI...');
      const code = await generateBurstScriptWithAi({
        request,
        currentCode: selectedScript.code,
        matchPatterns: selectedScript.matchPatterns,
        pageTitle: selectedScript.name,
        settings,
      });
      onUpdateScript({ code });
      setAssistantStatus('Generated script inserted. Review it before saving or enabling.');
      setAssistantOpen(false);
    } catch (error) {
      setAssistantStatus(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setIsGeneratingScript(false);
    }
  }

  return (
    <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Script editor">
      <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!leftSidebarOpen && (
            <Tooltip content="Expand Left Sidebar" shortcut={isMac ? '⌘\\' : 'Ctrl+\\'} align="left">
              <button
                onClick={onToggleLeft}
                className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                type="button"
              >
                <span className="sr-only">Expand Left Sidebar</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5 5-5M19 17l-5-5 5-5" /></svg>
              </button>
            </Tooltip>
          )}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setStatusMenuOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${getStatusClassName(selectedScript.status)} hover:bg-accent/50`}
              aria-haspopup="menu"
              aria-expanded={statusMenuOpen}
            >
              {selectedScript.status}
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
            {statusMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-20 w-36 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="menu">
                  {(['enabled', 'disabled', 'draft'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedScript.status === status}
                      onClick={() => { onUpdateScript({ status }); setStatusMenuOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left ${
                        selectedScript.status === status ? 'bg-accent/50 text-foreground' : ''
                      }`}
                    >
                      <span className="capitalize">{status}</span>
                      <span className={`h-2 w-2 rounded-full ${getStatusDotClassName(status)}`} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <IconSelect value={selectedScript.icon} onChange={(icon) => onUpdateScript({ icon })} variant="toolbar" />
          <span ref={nameMeasureRef} className="pointer-events-none invisible absolute whitespace-pre text-base font-semibold tracking-tight" aria-hidden="true">
            {selectedScript.name || 'Untitled local command'}
          </span>
          <input
            aria-label="Script name"
            value={selectedScript.name}
            onChange={(e) => onUpdateScript({ name: e.target.value })}
            style={{ width: `${nameInputWidth}px` }}
            className="h-9 min-w-0 max-w-full bg-transparent text-base font-semibold tracking-tight text-foreground outline-none rounded-md px-1.5 focus:bg-background focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-3">
          {saveState && (
            <span className="text-xs text-muted-foreground animate-fade-in truncate max-w-[200px] font-medium">
              {saveState}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenTestHarness}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            Test
          </button>
          <button
            type="button"
            onClick={onFormat}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            Format
          </button>
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
            >
              Save
            </button>
          )}
          <Tooltip content="Editor Preferences">
            <button
              type="button"
              onClick={onOpenEditorPrefs}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </Tooltip>
          <div className="relative">
            <Tooltip content="More actions">
              <button
                type="button"
                onClick={() => setNavbarMenuOpen((o) => !o)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                aria-haspopup="menu"
                aria-expanded={navbarMenuOpen}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </Tooltip>
            {navbarMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNavbarMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-20 w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" role="menu">
                  {isRegistryFork && storeHref && (
                    <>
                      <a
                        role="menuitem"
                        href={storeHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setNavbarMenuOpen(false)}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        Open store
                      </a>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { onResetFork(); setNavbarMenuOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        Reset to registry
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { onUnlinkFork(); setNavbarMenuOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                      >
                        <Unlink className="w-3.5 h-3.5 text-muted-foreground" />
                        Unlink fork
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { onDelete(); setNavbarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 p-2 rounded text-xs text-destructive hover:bg-destructive/10 cursor-pointer transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    Delete script
                  </button>
                </div>
              </>
            )}
          </div>
          <Tooltip
            content={rightPanelOpen ? 'Collapse Right Panel' : 'Expand Right Panel'}
            shortcut={isMac ? '⌘⇧\\' : 'Ctrl+Shift+\\'}
            align="right"
          >
            <button
              type="button"
              onClick={onToggleRight}
              className="relative p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          </Tooltip>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
          {isRegistryFork && (
            <div className="flex items-center justify-between gap-3 border-b border-border bg-sky-500/5 px-4 py-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-sky-400">Linked registry fork</span>
                <span className="text-muted-foreground"> · {selectedScript.originCommandId} · v{selectedScript.version || '1.0.0'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {storeHref && (
                  <a href={storeHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-accent">
                    <ExternalLink className="w-3 h-3" />
                    Store
                  </a>
                )}
                <button type="button" onClick={onResetFork} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-accent">
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
                <button type="button" onClick={onUnlinkFork} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Unlink className="w-3 h-3" />
                  Unlink
                </button>
              </div>
            </div>
          )}
          <div className="p-4 border-b border-border bg-card/20 shrink-0">
            <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Match Patterns
              <textarea
                value={selectedScript.matchPatterns.join('\n')}
                onChange={(e) => onUpdateScript({ matchPatterns: parseMatchPatternsInput(e.target.value) })}
                rows={3}
                placeholder={'github.com/*\nhttps://docs.example.com/*\n<all_urls>'}
                className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-[10px] normal-case tracking-normal font-medium text-muted-foreground">
                One pattern per line. Commas are also accepted.
              </span>
            </label>
          </div>

          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Source Code</span>
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Sparkles className="w-3 h-3" />
                Generate with AI
              </button>
            </div>
            {assistantOpen && (
              <div className="mb-3 rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <strong className="block text-xs font-bold text-foreground">AI Script Assistant</strong>
                    <span className="text-[11px] text-muted-foreground">Uses Chrome built-in AI locally when available.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssistantOpen(false)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Close AI script assistant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={assistantPrompt}
                  onChange={(event) => setAssistantPrompt(event.target.value)}
                  rows={3}
                  placeholder="Example: Create a command that summarizes the selected text with Chrome AI and copies the result."
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">{assistantStatus || 'Generated code is inserted into the editor for review.'}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateScript({ code: burstApiQuickStart })}
                      className="rounded-md border border-input px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Insert starter
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateWithAi()}
                      disabled={!assistantPrompt.trim() || isGeneratingScript}
                      className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGeneratingScript ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card/20 shadow-inner code-editor">
              <CodeMirror
                value={selectedScript.code}
                basicSetup={{
                  bracketMatching: true,
                  closeBrackets: true,
                  defaultKeymap: true,
                  foldGutter: false,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  lineNumbers: true,
                }}
                extensions={editorExtensions}
                height="100%"
                theme={selectedThemeValue}
                onChange={(code) => onUpdateScript({ code })}
              />
            </div>
          </div>
        </div>

        {rightPanelOpen && (
          <>
            <div className={`resize-handle ${isDraggingRight ? 'active' : ''}`} onMouseDown={onStartRightDrag} />
            <RightPanel
              selectedScript={selectedScript}
              onOpenTestHarness={onOpenTestHarness}
              rightWidth={320}
            />
          </>
        )}
      </div>
    </section>
  );
}

function RightPanel({
  selectedScript,
  onOpenTestHarness,
  rightWidth,
}: {
  selectedScript: LocalScript;
  onOpenTestHarness: () => void;
  rightWidth: number;
}) {
  const staticAuditReport = React.useMemo(() => {
    return analyzeScriptCode(selectedScript.code, selectedScript.matchPatterns);
  }, [selectedScript.code, selectedScript.matchPatterns]);
  const detectedCapabilities = React.useMemo(() => detectRequiredCapabilities(selectedScript.code), [selectedScript.code]);

  return (
    <div style={{ width: `${rightWidth}px` }} className="shrink-0 flex flex-col h-full overflow-y-auto divide-y divide-border bg-card/5">
      <section className="p-4 flex flex-col gap-3" aria-label="Detected local API capabilities">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Detected APIs</h3>
          <span className="text-[10px] font-semibold text-muted-foreground">{detectedCapabilities.length}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {detectedCapabilities.length > 0 ? detectedCapabilities.map((capability) => (
            <span key={capability} className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {capability}
            </span>
          )) : (
            <span className="text-xs text-muted-foreground">No gated APIs detected yet.</span>
          )}
        </div>
      </section>

      {staticAuditReport && (
        <section className="p-4 flex flex-col gap-3" aria-label="Static security audit report">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Static Security Audit</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              staticAuditReport.status === 'pass'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : staticAuditReport.status === 'warning'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/25'
            }`}>
              {staticAuditReport.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">{staticAuditReport.summary}</p>
          <div className="flex flex-col gap-2 mt-1">
            {(
              [
                { key: 'hostScope' as const, title: 'Host Scope & Match Patterns' },
                { key: 'permissions' as const, title: 'Sensitive APIs & Permissions' },
                { key: 'remoteCode' as const, title: 'Remote Code & Injection' },
                { key: 'networkAccess' as const, title: 'Network Access' },
                { key: 'obfuscation' as const, title: 'Code Quality & Obfuscation Heuristics' },
                { key: 'aiUsage' as const, title: 'Chrome Built-in AI' },
              ] as const
            ).map(({ key, title }) => {
              const check = staticAuditReport.checks[key];
              return (
                <div key={key} className="flex gap-3 text-xs bg-muted/30 p-2.5 rounded-md border border-border">
                  <span className={`font-bold shrink-0 ${check.status === 'pass' ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {check.status === 'pass' ? '✓' : '⚠'}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <strong className="text-foreground font-semibold">{title}</strong>
                    <span className="text-muted-foreground text-[11px] font-medium leading-relaxed">{check.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="p-4 flex flex-col gap-3" aria-label="Interactive sandbox">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Interactive Sandbox</h3>
          <button
            type="button"
            onClick={onOpenTestHarness}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            Open Sandbox
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-medium">
          Simulate browser environment variables, inspect DOM operations, and view custom script logs in a safe context.
        </p>
      </section>

      <section className="p-4 flex flex-col gap-3" aria-label="Burst local API reference">
        <div>
          <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Local API Reference</h3>
          <p className="mt-1 text-xs text-muted-foreground font-medium">All helpers are capability-gated and available from the run context.</p>
        </div>
        <div className="flex flex-col gap-3">
          {burstApiReferenceSections.map((section) => {
            const items = burstApiCompletions.filter((item) => item.category === section);
            if (items.length === 0) return null;

            return (
              <div key={section} className="flex flex-col gap-1.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{section}</h4>
                {items.map((item) => (
                  <div key={item.label} className="rounded-md border border-border bg-muted/20 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <code className="font-semibold text-foreground">{item.label}</code>
                      <span className="text-[10px] text-muted-foreground">{item.type}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{item.detail}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.info}</p>
                    {item.apply ? <code className="mt-1 block truncate text-[11px] text-foreground/80">{item.apply}</code> : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
