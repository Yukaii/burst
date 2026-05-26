import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { Boxes, ExternalLink, PanelLeftOpen, Trash2, GitFork, Power } from 'lucide-react';
import type { BurstCommand } from '@/src/lib/commands';
import { isRegistryCommandEnabled } from '@/src/lib/registryStorage';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { Tooltip } from './ui';
import { formatMatchPatterns } from './utils';

export function RegistryCommandPanel({
  command,
  packCommands,
  leftSidebarOpen,
  onToggleLeft,
  saveState,
  editorFontFamily,
  editorFontSize,
  onFork,
  onToggleStatus,
  onTogglePackStatus,
  onUninstall,
  onUninstallPack,
}: {
  command: BurstCommand;
  packCommands: BurstCommand[];
  leftSidebarOpen: boolean;
  onToggleLeft: () => void;
  saveState: string;
  editorFontFamily: string;
  editorFontSize: number;
  onFork: () => void;
  onToggleStatus: () => void;
  onTogglePackStatus: (status: 'enabled' | 'disabled') => void;
  onUninstall: () => void;
  onUninstallPack: () => void;
}) {
  const audit = React.useMemo(() => analyzeScriptCode(command.code || '', command.matchPatterns), [command.code, command.matchPatterns]);
  const storeHref = `http://localhost:5174/discover/${encodeURIComponent(command.id)}`;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const enabled = isRegistryCommandEnabled(command);
  const isPackCommand = Boolean(command.packId);
  const enabledPackCount = packCommands.filter(isRegistryCommandEnabled).length;
  const packEnabled = packCommands.length > 0 && enabledPackCount === packCommands.length;
  const readOnlyEditorTheme = React.useMemo(() => EditorView.theme({
    '&': { height: '100%', fontSize: `${editorFontSize}px` },
    '.cm-scroller': { fontFamily: editorFontFamily, lineHeight: '1.55' },
    '.cm-content': { padding: '14px 0' },
    '.cm-line': { padding: '0 14px', textTransform: 'none' },
  }), [editorFontFamily, editorFontSize]);

  return (
    <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Registry command details">
      <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!leftSidebarOpen && (
            <Tooltip content="Expand Left Sidebar" shortcut={isMac ? '⌘\\' : 'Ctrl+\\'} align="left">
              <button onClick={onToggleLeft} className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors" type="button">
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            enabled
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}>
            {enabled ? 'Enabled Registry' : 'Disabled Registry'}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground truncate">{command.title}</h2>
            <p className="text-[11px] text-muted-foreground font-medium mt-1 truncate">
              {command.publisher.name} {command.publisher.handle} · {command.packTitle ? `${command.packTitle} · ` : ''}v{command.version || '1.0.0'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveState && <span className="text-xs text-muted-foreground truncate max-w-[200px] font-medium">{saveState}</span>}
          <a href={storeHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground">
            <ExternalLink className="w-3.5 h-3.5" />
            Store
          </a>
          <button type="button" onClick={onFork} className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95">
            <GitFork className="w-3.5 h-3.5" />
            Fork
          </button>
          <button type="button" onClick={onToggleStatus} className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground">
            <Power className="w-3.5 h-3.5" />
            {enabled ? 'Disable' : 'Enable'}
          </button>
          <button type="button" onClick={onUninstall} className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 text-destructive border border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" />
            Uninstall
          </button>
          {isPackCommand && (
            <button type="button" onClick={onUninstallPack} className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 text-destructive border border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" />
              Pack
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[minmax(0,_1fr)_320px] min-h-0 overflow-hidden">
        <div className="flex flex-col min-w-0 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 p-4 border-b border-border bg-card/20 text-xs">
            <Meta label="Website" value={command.website} />
            <Meta label="Matches" value={formatMatchPatterns(command.matchPatterns)} />
            <Meta label="Trust" value={command.trustLevel} />
            <Meta label="Risk" value={command.risk} />
            {command.packTitle && <Meta label="Pack" value={command.packTitle} />}
            <Meta label="Source" value={command.sourceUrl} href={command.sourceUrl} wide />
          </div>
          <div className="flex min-h-[420px] flex-1 flex-col p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Installed Source Code</span>
              <span className="text-[10px] text-muted-foreground">Read-only. Fork to customize.</span>
            </div>
            <div className="min-h-[360px] flex-1 border border-border rounded-lg overflow-hidden bg-card/20 shadow-inner code-editor">
              <CodeMirror
                value={command.code || ''}
                editable={false}
                basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
                extensions={[javascript({ jsx: true, typescript: true }), readOnlyEditorTheme]}
                height="100%"
                theme="dark"
              />
            </div>
          </div>
        </div>

        <aside className="min-h-0 border-l border-border bg-card/5 overflow-y-auto">
          {isPackCommand && (
            <section className="p-4 flex flex-col gap-3 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Installed Pack</h3>
                <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] font-bold uppercase">
                  <Boxes className="h-3 w-3" />
                  {enabledPackCount}/{packCommands.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {packCommands.map((item) => (
                  <div key={item.id} className={`rounded-md border p-2 ${item.id === command.id ? 'border-primary/40 bg-primary/10' : 'border-border bg-card/30'}`}>
                    <div className="truncate text-xs font-semibold text-foreground">{item.title}</div>
                    <div className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                      {isRegistryCommandEnabled(item) ? 'enabled' : 'disabled'} · {formatMatchPatterns(item.matchPatterns)}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onTogglePackStatus(packEnabled ? 'disabled' : 'enabled')}
                className="inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground"
              >
                <Power className="w-3.5 h-3.5" />
                {packEnabled ? 'Disable pack' : 'Enable pack'}
              </button>
            </section>
          )}
          <section className="p-4 flex flex-col gap-3 border-b border-border">
            <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Metadata</h3>
            <Meta label="Command ID" value={command.id} />
            <Meta label="Installs" value={command.installs.toLocaleString()} />
            <Meta label="Rating" value={String(command.rating)} />
            <Meta label="Permissions" value={command.permissions.join(', ') || 'None declared'} />
          </section>
          <section className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Static Audit</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-border">{audit.status}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{audit.summary}</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Meta({ label, value, href, wide }: { label: string; value: string; href?: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline truncate block">{value}</a>
      ) : (
        <div className="text-xs text-foreground truncate">{value}</div>
      )}
    </div>
  );
}
