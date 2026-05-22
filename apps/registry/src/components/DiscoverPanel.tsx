import { Search, Plus, RefreshCw } from 'lucide-react';
import type { BurstCommand } from '@/src/lib/commands';
import type { AuditReport, PublisherProfile } from '@/src/lib/registryApi';
import { registryCommandsData } from '@/src/lib/registryApi';
import { sampleManifestValidationResults } from '@/src/lib/manifest';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CommandInspector, EmptyInspector } from './CommandInspector';

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
  validManifests: number;
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
  validManifests
}: DiscoverPanelProps) {
  return (
    <>
      <header className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between shrink-0">
        <div className="relative flex-1 max-w-md flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4 pointer-events-none" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search website, publisher, permission, or use case"
            className="pl-10 pr-12 h-10 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-sm focus-visible:ring-sky-500"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded font-mono shadow-[0_1px_1px_rgba(0,0,0,0.05)] pointer-events-none select-none">
            ⌘K
          </kbd>
        </div>
        <Button
          className="h-10 px-4 rounded-xl font-bold bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 hover:opacity-90 flex items-center gap-2 text-sm shadow-sm transition-all cursor-pointer border-none shrink-0"
          type="button"
          onClick={() => {
            setNavTab('Publish');
          }}
        >
          <Plus className="size-4" />
          Publish use case
        </Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0" aria-label="Registry summary">
        <SummaryStat label="Commands" value={registryCommandsData.length.toString()} />
        <SummaryStat label="Manifests" value={`${validManifests}/${sampleManifestValidationResults.length}`} />
        <SummaryStat
          label="Audited"
          value={registryCommandsData.filter((command) => command.trustLevel === 'verified' || command.trustLevel === 'reviewed').length.toString()}
        />
        <SummaryStat label="Sensitive" value={registryCommandsData.filter((command) => command.risk === 'high').length.toString()} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start w-full min-w-0">
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col" aria-label="Registry commands">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Discover commands</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Find actions that match the current website, then inspect trust signals before installing.</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">{filteredCommands.length} results</span>
          </div>

          {/* Category Filters Bar */}
          <div className="px-6 py-2.5 border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/30 dark:bg-slate-950/20 flex flex-wrap gap-1.5 items-center">
            {(
              [
                { id: 'all', label: 'All Scopes' },
                { id: 'verified', label: 'Verified Publishers' },
                { id: 'high_risk', label: 'High-Risk Flags' },
                { id: 'installed', label: 'Installed' },
              ] as const
            ).map((cat) => {
              const isActive = filterCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-500 border-sky-500/20'
                      : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/40 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider grid grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_0.8fr] gap-4 items-center animate-none">
            <span>Command</span>
            <span>Website</span>
            <span>Trust</span>
            <span>Risk</span>
            <span className="text-right">Usage</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
              <RefreshCw className="size-6 animate-spin text-sky-500" />
              <span className="text-sm font-semibold">Searching registry...</span>
            </div>
          ) : filteredCommands.length > 0 ? (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
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
                    className={`px-6 py-4 border-none transition-all duration-150 grid grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_0.8fr] gap-4 items-center text-left cursor-pointer w-full ${
                      isSelected 
                        ? 'bg-sky-500/5 dark:bg-sky-500/10 shadow-[inset_3px_0_0_0_#0ea5e9]' 
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/40'
                    }`}
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
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-2 border-t border-slate-100 dark:border-slate-800/40">
              <Search className="size-8 text-slate-300 dark:text-slate-700" />
              <strong className="text-sm font-bold text-slate-900 dark:text-white mt-1">No registry commands match</strong>
              <span className="text-xs text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">Try searching for a different website matching pattern or publisher name.</span>
            </div>
          )}

          {filteredCommands.length > 0 && (
            <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-400 dark:text-slate-500 font-semibold flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 py-0.2 rounded shadow-sm font-mono text-[9px]">↑</kbd>
                  <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 py-0.2 rounded shadow-sm font-mono text-[9px]">↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 py-0.2 rounded shadow-sm font-mono text-[9px]">↵</kbd>
                  Install/Uninstall
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 py-0.2 rounded shadow-sm font-mono text-[9px]">Esc</kbd>
                  Deselect
                </span>
              </div>
              <div className="flex gap-x-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1 py-0.2 rounded shadow-sm font-mono text-[9px]">⌥ 1-5</kbd>
                  Switch Tabs
                </span>
              </div>
            </div>
          )}
        </div>

        {activeCommand ? (
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
          />
        ) : (
          <EmptyInspector />
        )}
      </section>
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col gap-1.5 transition-all duration-200 hover:shadow-md">
      <strong className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">{value}</strong>
      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">{label}</span>
    </div>
  );
}
