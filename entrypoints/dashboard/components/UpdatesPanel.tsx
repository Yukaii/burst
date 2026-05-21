import React from 'react';
import { PanelLeftOpen } from 'lucide-react';
import type { ScriptUpdate } from './types';
import { Tooltip } from './ui';

export function UpdatesPanel({
  leftSidebarOpen,
  onToggleLeft,
  updateStatusText,
  isCheckingUpdates,
  availableUpdates,
  onCheckUpdates,
  onUpdateAll,
  onUpdateScript,
}: {
  leftSidebarOpen: boolean;
  onToggleLeft: () => void;
  updateStatusText: string;
  isCheckingUpdates: boolean;
  availableUpdates: ScriptUpdate[];
  onCheckUpdates: () => void;
  onUpdateAll: () => void;
  onUpdateScript: (update: ScriptUpdate) => void;
}) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  return (
    <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Update checker">
      <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {!leftSidebarOpen && (
            <Tooltip content="Expand Left Sidebar" shortcut={isMac ? '⌘\\' : 'Ctrl+\\'} align="left">
              <button
                onClick={onToggleLeft}
                className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                type="button"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Unified Update Checker</h2>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">{updateStatusText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors disabled:opacity-50"
            type="button"
            disabled={isCheckingUpdates}
            onClick={onCheckUpdates}
          >
            {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>
          {availableUpdates.length > 0 && (
            <button
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
              type="button"
              onClick={onUpdateAll}
            >
              Update All
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {availableUpdates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3 max-w-md mx-auto">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ✓
            </div>
            <h4 className="text-sm font-semibold text-foreground">All scripts up to date</h4>
            <p className="text-xs text-muted-foreground font-medium">
              All installed registry commands and git-based scripts are at the latest available version.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableUpdates.map((update) => (
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 shadow-sm gap-4" key={update.id}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border text-[11px] font-bold shrink-0">
                    {update.type === 'official' ? 'R' : 'G'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-foreground truncate block">{update.name}</h4>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border uppercase">
                        {update.type === 'official' ? 'Official' : 'Git'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border">
                        Installed: v{update.currentVersion}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-[9px] font-bold text-sky-500 border border-sky-500/20">
                        Latest: v{update.latestVersion}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1.5 bg-primary text-primary-foreground shadow hover:bg-primary/95 cursor-pointer transition-colors"
                  type="button"
                  onClick={() => onUpdateScript(update)}
                >
                  Update
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
