import React from 'react';
import { PanelLeftOpen } from 'lucide-react';
import type { BurstCommand } from '@/src/lib/commands';
import type { LocalScript } from '@/src/lib/localScripts';
import type { GitRegistry } from './types';
import { LocalScriptIcon } from './ui';
import { Tooltip } from './ui';

export function GitRegistryPanel({
  registry,
  leftSidebarOpen,
  onToggleLeft,
  scripts,
  onInstallCommand,
  onRemoveRegistry,
}: {
  registry: GitRegistry;
  leftSidebarOpen: boolean;
  onToggleLeft: () => void;
  scripts: LocalScript[];
  onInstallCommand: (command: BurstCommand, registry: GitRegistry) => void;
  onRemoveRegistry: (id: string) => void;
}) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  return (
    <section className="flex-1 flex flex-col h-full w-full bg-background text-foreground overflow-hidden" aria-label="Git registry detail">
      <header className="h-16 px-6 bg-card border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {!leftSidebarOpen && (
            <Tooltip content="Expand Left Sidebar" shortcut={isMac ? '⌘\\' : 'Ctrl+\\'} align="left">
              <button
                onClick={onToggleLeft}
                className="mr-2 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
                type="button"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground truncate">{registry.name}</h2>
            <p className="text-[11px] text-muted-foreground font-medium mt-1 truncate">
              Git Repository:{' '}
              <a href={registry.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {registry.url}
              </a>{' '}
              (branch: {registry.branch})
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-destructive text-destructive-foreground border border-destructive/20 hover:bg-destructive/90 shadow-sm cursor-pointer transition-colors shrink-0"
          type="button"
          onClick={() => onRemoveRegistry(registry.id)}
        >
          Remove Registry
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {registry.commands.length === 0 ? (
          <p className="text-xs text-muted-foreground font-medium">No commands found in this registry&apos;s manifest.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registry.commands.map((cmd) => {
              const isInstalled = scripts.some(
                (s) => s.originRegistryUrl === registry.url && s.originCommandId === cmd.id
              );
              const installedScript = scripts.find(
                (s) => s.originRegistryUrl === registry.url && s.originCommandId === cmd.id
              );

              return (
                <div className="flex items-start justify-between p-4 rounded-xl border border-border bg-card/40 shadow-sm gap-4" key={cmd.id}>
                  <div className="flex items-start gap-3 min-w-0">
                    <LocalScriptIcon icon={cmd.icon} website={cmd.website} matchPatterns={cmd.matchPatterns} />
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate block">{cmd.title}</h4>
                      <p className="text-[11px] text-muted-foreground font-medium mt-1 line-clamp-2 leading-relaxed">
                        {cmd.description}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border">
                          v{cmd.version || '1.0.0'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold text-muted-foreground border border-border">
                          {cmd.website}
                        </span>
                        {isInstalled && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px] font-bold text-emerald-500 border border-emerald-500/20">
                            Installed v{installedScript?.version || '1.0.0'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`inline-flex items-center justify-center rounded-md text-xs font-semibold px-2.5 py-1.5 cursor-pointer transition-colors shadow-sm shrink-0 ${
                      isInstalled
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-none hover:bg-emerald-500/20'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                    type="button"
                    onClick={() => onInstallCommand(cmd, registry)}
                  >
                    {isInstalled ? 'Reinstall' : 'Install'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
