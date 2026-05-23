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
  setNavTab
}: DiscoverPanelProps) {
  return (
    <section className="registry-discover">
      <header className="registry-discover-controls">
        <div className="relative flex-1 min-w-0 flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4 pointer-events-none" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search website, publisher, permission, or use case"
            className="pl-10 pr-3 h-9 w-full bg-background border-border rounded-lg text-xs font-semibold focus-visible:ring-ring"
          />
        </div>
        <Button
          className="h-9 px-3 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 text-xs shadow-sm transition-colors cursor-pointer border-none shrink-0"
          type="button"
          onClick={() => {
            setNavTab('Publish');
          }}
        >
          <Plus className="size-4" />
          Publish
        </Button>
      </header>

      <section className="registry-discover-workspace">
        <div className="registry-command-table" aria-label="Registry commands">
          <div className="registry-panel-header">
            <div>
              <h2>Discover commands</h2>
              <p>Find actions that match the current website, then inspect trust signals before installing.</p>
            </div>
            <span>{filteredCommands.length} results</span>
          </div>

          <div className="registry-filter-row">
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
                  className={isActive ? 'is-active' : ''}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="registry-table-head">
            <span>Command</span>
            <span>Website</span>
            <span>Trust</span>
            <span>Risk</span>
            <span className="text-right">Usage</span>
          </div>

          {loading ? (
            <div className="registry-loading-state">
              <RefreshCw className="size-6 animate-spin text-sky-500" />
              <span className="text-sm font-semibold">Searching registry...</span>
            </div>
          ) : filteredCommands.length > 0 ? (
            <div className="registry-command-rows">
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
                    className={`registry-command-row ${isSelected ? 'is-selected' : ''}`}
                    key={command.id}
                    type="button"
                    onClick={() => setActiveCommandId(command.id)}
                  >
                    <span className="flex flex-col min-w-0 pr-2">
                      <strong className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight truncate">
                        {command.title}
                        {installedCommandIds.includes(command.id) && (
                          <Badge variant="secondary" className="h-4.5 px-1.5 py-0 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">Installed</Badge>
                        )}
                        {pinnedCommandIds.includes(command.id) && (
                          <span className="text-[10px] text-sky-500 shrink-0" title="Pinned">📌</span>
                        )}
                      </strong>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate mt-1">
                        by {command.publisher.name} <span className="text-[10px] text-slate-500">@{command.publisher.handle}</span>
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
            <div className="registry-empty-state">
              <Search className="size-8 text-slate-300 dark:text-slate-700" />
              <strong className="text-sm font-bold text-slate-900 dark:text-white mt-1">No registry commands match</strong>
              <span className="text-xs text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">Try searching for a different website matching pattern or publisher name.</span>
            </div>
          )}
        </div>

        {(activeCommand || inspectorLoading) && activeCommand ? (
          <div
            className="registry-inspector-modal"
            onClick={() => setActiveCommandId(null)}
          >
            <button
              type="button"
              className="registry-inspector-backdrop"
              onClick={() => setActiveCommandId(null)}
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
              onClose={() => setActiveCommandId(null)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </section>
    </section>
  );
}
