import { Search, Plus, RefreshCw } from 'lucide-react';
import type { BurstCommand } from '@/src/lib/commands';
import type { AuditReport, PublisherProfile } from '@/src/lib/registryApi';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CommandInspector } from './CommandInspector';

const trustCopy: Record<BurstCommand['trustLevel'], string> = {
  verified: 'Verified',
  reviewed: 'Reviewed',
  community: 'Community',
  local: 'Local',
};

const riskCopy: Record<BurstCommand['risk'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface DiscoverPanelProps {
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  filteredCommands: BurstCommand[];
  activeCommandId: string | null;
  setActiveCommandId: (id: string | null) => void;
  installedCommandIds: string[];
  pinnedCommandIds: string[];
  activeCommand: BurstCommand | null;
  activeAuditReport: AuditReport | null;
  activePublisherProfile: PublisherProfile | null;
  inspectorLoading: boolean;
  inspectorTab: 'details' | 'audit' | 'publisher';
  setInspectorTab: (tab: 'details' | 'audit' | 'publisher') => void;
  handleInstall: (cmd: BurstCommand) => void;
  handleUninstall: (id: string) => void;
  handlePin: (id: string) => void;
  handleUnpin: (id: string) => void;
  filterCategory: 'all' | 'verified' | 'high_risk' | 'installed';
  setFilterCategory: (cat: 'all' | 'verified' | 'high_risk' | 'installed') => void;
  setNavTab: (tab: 'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings') => void;
  isInspectorOpen: boolean;
  setIsInspectorOpen: (open: boolean) => void;
}

export function DiscoverPanel({
  query,
  setQuery,
  loading,
  filteredCommands,
  activeCommandId,
  setActiveCommandId,
  installedCommandIds,
  pinnedCommandIds,
  activeCommand,
  activeAuditReport,
  activePublisherProfile,
  inspectorLoading,
  inspectorTab,
  setInspectorTab,
  handleInstall,
  handleUninstall,
  handlePin,
  handleUnpin,
  filterCategory,
  setFilterCategory,
  setNavTab,
  isInspectorOpen,
  setIsInspectorOpen
}: DiscoverPanelProps) {
  return (
    <section className="flex flex-1 min-h-0 flex-col gap-3">
      <header className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-0 flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5 pointer-events-none" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search website, publisher, permission, or use case"
            className="pl-8.5 pr-3 h-8 w-full bg-background border-border rounded-lg text-xs font-medium focus-visible:ring-ring"
          />
        </div>
        <Button
          className="h-7.5 px-3.5 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 text-[11px] shadow-sm transition-colors cursor-pointer border-none shrink-0"
          type="button"
          onClick={() => {
            setNavTab('Publish');
          }}
        >
          <Plus className="size-3.5" />
          Publish
        </Button>
      </header>

      <section className="relative flex min-h-0 flex-1">
        <div className="flex w-full min-w-0 min-h-0 flex-col overflow-hidden border border-border rounded-lg bg-card" aria-label="Registry commands">
          <div className="flex items-center justify-between gap-3.5 border-b border-border p-3 px-3.5">
            <div>
              <h2 className="m-0 text-foreground text-base font-semibold leading-none">Discover commands</h2>
              <p className="m-0 mt-1.5 text-muted-foreground text-xs leading-normal">Find actions that match the current website, then inspect trust signals before installing.</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold leading-none p-1.25 px-2">{filteredCommands.length} results</span>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border bg-background p-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'verified', label: 'Verified' },
                { id: 'high_risk', label: 'High risk' },
                { id: 'installed', label: 'Installed' },
              ] as const
            ).map((cat) => {
              const isActive = filterCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterCategory(cat.id)}
                  className={`rounded-full bg-transparent cursor-pointer text-[9px] font-medium px-2.5 py-0.5 text-center transition-all duration-150 border ${
                    isActive 
                      ? 'border-border bg-accent text-accent-foreground' 
                      : 'border-transparent text-muted-foreground hover:bg-accent/35 hover:text-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-[minmax(190px,_1.5fr)_minmax(120px,_1fr)_92px_78px_72px] gap-3 items-center border-b border-border bg-background text-muted-foreground text-[10px] font-bold tracking-[0.08em] p-2.25 px-3.5 uppercase">
            <span>Command</span>
            <span>Website</span>
            <span>Trust</span>
            <span>Risk</span>
            <span className="text-right">Usage</span>
          </div>

          {loading ? (
            <div className="grid flex-1 min-h-[220px] place-content-center gap-2.5 text-muted-foreground text-center">
              <RefreshCw className="size-6 animate-spin text-sky-500" />
              <span className="text-sm font-semibold">Searching registry...</span>
            </div>
          ) : filteredCommands.length > 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {filteredCommands.map((command) => {
                const isSelected = activeCommandId === command.id;
                
                const trustColors = {
                  verified: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30',
                  reviewed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
                  community: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
                  local: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
                }[command.trustLevel];
 
                const riskColors = {
                  low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/40',
                  medium: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
                  high: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',
                }[command.risk];

                return (
                  <button
                    data-command-id={command.id}
                    className={`grid grid-cols-[minmax(190px,_1.5fr)_minmax(120px,_1fr)_92px_78px_72px] gap-3 items-center w-full min-h-[60px] border-0 border-b border-border bg-card text-foreground cursor-pointer p-2.5 px-3.5 text-left transition-all duration-150 hover:bg-accent/55 ${
                      isSelected ? 'bg-accent shadow-[inset_3px_0_0_0_hsl(var(--primary))]' : ''
                    }`}
                    key={command.id}
                    type="button"
                    onClick={() => {
                      setActiveCommandId(command.id);
                      setIsInspectorOpen(true);
                    }}
                  >
                    <span className="flex flex-col min-w-0 pr-2">
                      <strong className="text-[13px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight truncate">
                        {command.title}
                        {installedCommandIds.includes(command.id) && (
                          <Badge variant="secondary" className="h-4.5 px-1.5 py-0 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">Installed</Badge>
                        )}
                        {pinnedCommandIds.includes(command.id) && (
                          <span className="text-[10px] text-sky-500 shrink-0" title="Pinned">📌</span>
                        )}
                      </strong>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        by {command.publisher.name} <span className="text-[10px] text-slate-500">{command.publisher.handle.startsWith('@') ? command.publisher.handle : `@${command.publisher.handle}`}</span>
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate pr-2">{command.website}</span>
                    <div>
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${trustColors}`}>
                        {trustCopy[command.trustLevel]}
                      </span>
                    </div>
                    <div>
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${riskColors}`}>
                        {riskCopy[command.risk]}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold text-right">{command.installs.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid flex-1 min-h-[220px] place-content-center gap-2.5 text-muted-foreground text-center">
              <Search className="size-8 text-slate-300 dark:text-slate-700" />
              <strong className="text-sm font-bold text-slate-900 dark:text-white mt-1">No registry commands match</strong>
              <span className="text-xs text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">Try searching for a different website matching pattern or publisher name.</span>
            </div>
          )}
        </div>

        {isInspectorOpen && (activeCommand || inspectorLoading) && activeCommand ? (
          <div
            className="fixed z-50 inset-0"
            onClick={() => setIsInspectorOpen(false)}
          >
            <button
              type="button"
              className="absolute inset-0 border-0 bg-[#080d1a]/28 backdrop-blur-sm cursor-default"
              onClick={() => setIsInspectorOpen(false)}
              aria-label="Close command details"
            />
            <CommandInspector
              command={activeCommand}
              auditReport={activeAuditReport}
              publisherProfile={activePublisherProfile}
              loading={inspectorLoading}
              activeTab={inspectorTab}
              setActiveTab={setInspectorTab}
              installedCommandIds={installedCommandIds}
              pinnedCommandIds={pinnedCommandIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onClose={() => setIsInspectorOpen(false)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </section>
    </section>
  );
}
