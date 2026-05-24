import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  Plus,
  Download,
  Upload,
  MoreVertical,
  Power,
  Trash2,
  PanelLeftClose,
  CheckCircle2,
} from 'lucide-react';
import logoUrl from '@/assets/logo.svg';
import type { BurstCommand } from '@/src/lib/commands';
import type { LocalScript } from '@/src/lib/localScripts';
import { createLocalScriptDraft } from '@/src/lib/localScripts';
import { isRegistryCommandEnabled } from '@/src/lib/registryStorage';
import type { GitRegistry } from './types';
import { Tooltip, LocalScriptIcon, AuditIssueDot } from './ui';
import { getScriptAuditStatus, formatMatchPatterns } from './utils';

export function LeftSidebar({
  scripts,
  selectedId,
  onSelect,
  installedRegistryCommands,
  selectedRegistryCommandId,
  onSelectRegistryCommand,
  onCreateDraft,
  onExportAll,
  onImport,
  onToggleScriptStatus,
  onToggleRegistryCommandStatus,
  onUninstallRegistryCommand,
  onForkRegistryCommand,
  onExportScript,
  onDeleteScript,
  onAddRegistry,
  onSelectGitView,
  activeTab,
  onChangeTab,
  gitRegistries,
  selectedGitView,
  availableUpdates,
  newRepoUrl,
  setNewRepoUrl,
  addError,
  leftWidth,
  leftSidebarOpen,
  onToggleLeft,
  isDraggingLeft,
  onStartLeftDrag,
}: {
  scripts: LocalScript[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  installedRegistryCommands: BurstCommand[];
  selectedRegistryCommandId: string | undefined;
  onSelectRegistryCommand: (id: string) => void;
  onCreateDraft: () => void;
  onExportAll: () => void;
  onImport: () => void;
  onToggleScriptStatus: (script: LocalScript) => void;
  onToggleRegistryCommandStatus: (command: BurstCommand) => void;
  onUninstallRegistryCommand: (commandId: string) => void;
  onForkRegistryCommand: (command: BurstCommand) => void;
  onExportScript: (script: LocalScript) => void;
  onDeleteScript: (script: LocalScript) => void;
  onAddRegistry: (e: React.FormEvent) => void;
  onSelectGitView: (view: 'updates' | string) => void;
  activeTab: 'editor' | 'git-updates';
  onChangeTab: (tab: 'editor' | 'git-updates') => void;
  gitRegistries: GitRegistry[];
  selectedGitView: 'updates' | string;
  availableUpdates: { length: number };
  newRepoUrl: string;
  setNewRepoUrl: (v: string) => void;
  addError: string;
  leftWidth: number;
  leftSidebarOpen: boolean;
  onToggleLeft: () => void;
  isDraggingLeft: boolean;
  onStartLeftDrag: (e: React.MouseEvent) => void;
}) {
  const [newScriptDropdownOpen, setNewScriptDropdownOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | undefined>();
  const importInputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  if (!leftSidebarOpen) return null;

  return (
    <>
      <aside style={{ width: `${leftWidth}px` }} className="shrink-0 bg-card flex flex-col overflow-hidden" aria-label="Local scripts">
        <header className="h-16 px-4 bg-card border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img src={logoUrl} className="w-6 h-6 shrink-0" alt="Burst Logo" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground tracking-tight leading-none">Burst</h1>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">Local scripts companion</p>
            </div>
          </div>
          <Tooltip content="Collapse Left Sidebar" shortcut={isMac ? '⌘\\' : 'Ctrl+\\'} align="right">
            <button
              onClick={onToggleLeft}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              type="button"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </Tooltip>
        </header>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
          <div className="flex rounded-lg bg-muted p-1 gap-1 border border-border shrink-0">
            <button
              className={`flex-1 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-center ${
                activeTab === 'editor' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              type="button"
              onClick={() => onChangeTab('editor')}
            >
              Local Editor
            </button>
            <button
              className={`flex-1 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-colors text-center ${
                activeTab === 'git-updates' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              type="button"
              onClick={() => onChangeTab('git-updates')}
            >
              Git & Updates
            </button>
          </div>

          {activeTab === 'editor' ? (
            <div className="flex-1 flex flex-col min-h-0 gap-3">
              <div className="relative inline-flex w-full shrink-0">
                <button
                  className="flex-1 inline-flex items-center justify-center rounded-l-md text-xs font-semibold h-8 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors border-r border-primary-foreground/10"
                  type="button"
                  onClick={onCreateDraft}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New script
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-r-md text-xs font-semibold w-8 h-8 bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer transition-colors"
                  type="button"
                  onClick={() => setNewScriptDropdownOpen((c) => !c)}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {newScriptDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNewScriptDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-20 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in">
                      <button
                        type="button"
                        onClick={() => { onExportAll(); setNewScriptDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        Export scripts
                      </button>
                      <button
                        type="button"
                        onClick={() => { onImport(); setNewScriptDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                      >
                        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                        Import scripts
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input ref={importInputRef} className="hidden" type="file" accept="application/json" onChange={(e) => onImport()} />

              <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                {scripts.map((script) => {
                  const auditStatus = getScriptAuditStatus(script);
                  return (
                    <div
                      className={`group w-full flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent hover:bg-accent/40 cursor-pointer ${
                        !selectedRegistryCommandId && script.id === selectedId ? 'bg-accent border-border' : ''
                      }`}
                      key={script.id}
                      onClick={() => onSelect(script.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="relative shrink-0">
                          <LocalScriptIcon icon={script.icon} />
                          <AuditIssueDot status={auditStatus} />
                        </span>
                        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <strong className="text-xs font-semibold text-foreground truncate block">{script.name}</strong>
                          <em className="text-[10px] text-muted-foreground truncate block not-italic font-medium">
                            {formatMatchPatterns(script.matchPatterns)} ·{' '}
                            <span className={
                              script.status === 'enabled' ? 'text-emerald-400 font-semibold' :
                              script.status === 'disabled' ? 'text-red-400 font-semibold' :
                              'text-amber-400 font-semibold'
                            }>{script.status}</span>
                          </em>
                        </span>
                      </div>

                      <div className="relative shrink-0 ml-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId((c) => c === script.id ? undefined : script.id); }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/80 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          type="button"
                          title="Actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {openMenuId === script.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenMenuId(undefined); }} />
                            <div className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => { onToggleScriptStatus(script); setOpenMenuId(undefined); }}
                                className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                              >
                                <Power className="w-3.5 h-3.5 text-muted-foreground" />
                                {script.status === 'enabled' ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { onExportScript(script); setOpenMenuId(undefined); }}
                                className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                              >
                                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                Export
                              </button>
                              <button
                                type="button"
                                onClick={() => { onDeleteScript(script); setOpenMenuId(undefined); }}
                                className="w-full flex items-center gap-2 p-2 rounded text-xs text-destructive hover:bg-destructive/10 cursor-pointer transition-colors text-left"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {installedRegistryCommands.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase pt-3 pb-1 shrink-0">
                      Registry Installs
                    </div>
                    {installedRegistryCommands.map((command) => {
                      const enabled = isRegistryCommandEnabled(command);
                      return (
                        <div
                          className={`group w-full flex items-center justify-between p-2 rounded-lg transition-colors border border-transparent hover:bg-accent/40 cursor-pointer ${
                            command.id === selectedRegistryCommandId ? 'bg-accent border-border' : ''
                          }`}
                          key={command.id}
                          onClick={() => onSelectRegistryCommand(command.id)}
                        >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-md border text-xs font-bold shrink-0 ${
                            enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <strong className="text-xs font-semibold text-foreground truncate block">{command.title}</strong>
                            <em className="text-[10px] text-muted-foreground truncate block not-italic font-medium">
                              {formatMatchPatterns(command.matchPatterns)} ·{' '}
                              <span className={enabled ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {enabled ? 'enabled' : 'disabled'}
                              </span>
                            </em>
                          </span>
                        </div>

                        <div className="relative shrink-0 ml-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId((c) => c === command.id ? undefined : command.id); }}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/80 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            type="button"
                            title="Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {openMenuId === command.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenMenuId(undefined); }} />
                              <div className="absolute right-0 top-full mt-1.5 z-20 w-36 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => { onToggleRegistryCommandStatus(command); setOpenMenuId(undefined); }}
                                  className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                                >
                                  <Power className="w-3.5 h-3.5 text-muted-foreground" />
                                  {enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { onForkRegistryCommand(command); setOpenMenuId(undefined); }}
                                  className="w-full flex items-center gap-2 p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                                >
                                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                  Fork
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { onUninstallRegistryCommand(command.id); setOpenMenuId(undefined); }}
                                  className="w-full flex items-center gap-2 p-2 rounded text-xs text-destructive hover:bg-destructive/10 cursor-pointer transition-colors text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  Uninstall
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 gap-3">
              <button
                className={`w-full flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                  selectedGitView === 'updates' ? 'bg-accent border-border' : ''
                }`}
                type="button"
                onClick={() => onSelectGitView('updates')}
              >
                <span className="text-xs font-semibold text-foreground">Updates Checker</span>
                {availableUpdates.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                    {availableUpdates.length}
                  </span>
                )}
              </button>

              <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase pt-2 shrink-0">
                Git Registries
              </div>

              <form className="flex flex-col gap-2 p-2.5 rounded-lg border border-border bg-muted/40 shrink-0" onSubmit={onAddRegistry}>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Add GitHub Repository
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="owner/repo"
                    value={newRepoUrl}
                    onChange={(e) => setNewRepoUrl(e.target.value)}
                    className="flex-1 flex h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors px-2.5"
                  >
                    Add
                  </button>
                </div>
                {addError && <span className="text-[10px] text-destructive font-medium mt-0.5">{addError}</span>}
              </form>

              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
                {gitRegistries.map((reg) => (
                  <button
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-left border border-transparent hover:bg-accent/40 ${
                      reg.id === selectedGitView ? 'bg-accent border-border' : ''
                    }`}
                    key={reg.id}
                    type="button"
                    onClick={() => onSelectGitView(reg.id)}
                  >
                    <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-bold shrink-0">
                      G
                    </span>
                    <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <strong className="text-xs font-semibold text-foreground truncate block">{reg.name}</strong>
                      <em className="text-[10px] text-muted-foreground truncate block not-italic font-medium">
                        {reg.branch} · {reg.commands.length} commands
                      </em>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className={`resize-handle ${isDraggingLeft ? 'active' : ''}`} onMouseDown={onStartLeftDrag} />
    </>
  );
}
