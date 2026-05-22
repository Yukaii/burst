import { useState } from 'react';
import type { BurstCommand } from '@/src/lib/commands';
import type { AuditReport, PublisherProfile } from '@/src/lib/registryApi';
import logoUrl from '@/assets/logo.svg';
import { sampleManifestValidationResults } from '@/src/lib/manifest';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Users, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check,
  Terminal,
  Code
} from 'lucide-react';

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

export function ChecklistItem({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}) {
  const Icon = {
    pass: CheckCircle2,
    warning: AlertTriangle,
    fail: XCircle,
  }[status];

  const colors = {
    pass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    fail: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  }[status];

  return (
    <div className={`p-3 rounded-xl border flex gap-3 items-start ${colors}`}>
      <Icon className="size-4 shrink-0 mt-0.5" />
      <div className="flex flex-col min-w-0">
        <strong className="text-xs font-extrabold leading-none">{label}</strong>
        <p className="text-[11px] leading-relaxed mt-1 font-semibold opacity-90">{detail}</p>
      </div>
    </div>
  );
}

export function EmptyInspector() {
  return (
    <aside className="flex flex-col gap-6 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-full" aria-label="Registry status">
      <div className="flex items-start gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <img className="size-11 rounded-xl object-cover" src={logoUrl} alt="Burst Logo" />
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Registry pending</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Select a command from the list on the left to inspect its details, security audits, and publisher profiles.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Manifest samples</h3>
        {sampleManifestValidationResults.map((sample) => (
          <div key={sample.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 rounded-xl shadow-sm">
            <strong className="text-xs font-bold text-slate-800 dark:text-slate-200">{sample.id}</strong>
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
              sample.result.ok 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' 
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
            }`}>
              {sample.result.ok ? 'Valid' : 'Invalid'}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function CommandInspector({
  command,
  auditReport,
  publisherProfile,
  loading,
  activeTab,
  setActiveTab,
  installedCommandIds,
  pinnedCommandIds,
  onInstall,
  onUninstall,
  onPin,
  onUnpin,
}: {
  command: BurstCommand;
  auditReport: AuditReport | null;
  publisherProfile: PublisherProfile | null;
  loading: boolean;
  activeTab: 'details' | 'audit' | 'publisher';
  setActiveTab: (tab: 'details' | 'audit' | 'publisher') => void;
  installedCommandIds: string[];
  pinnedCommandIds: string[];
  onInstall: (command: BurstCommand) => void;
  onUninstall: (commandId: string) => void;
  onPin: (commandId: string) => void;
  onUnpin: (commandId: string) => void;
}) {
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (loading) {
    return (
      <aside className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-[400px]" aria-label="Loading details">
        <RefreshCw className="size-6 animate-spin text-sky-500" />
        <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-3">Loading details...</span>
      </aside>
    );
  }

  const isInstalled = installedCommandIds.includes(command.id);
  const isPinned = pinnedCommandIds.includes(command.id);

  const cliCommand = `burst add ${command.id}`;
  const sourceCode = command.code || `export default async function run({ page, toast }) {\n  // Source code is not available for this package\n}`;

  const copyToClipboard = async (text: string, type: 'cli' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'cli') {
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <aside className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-full overflow-hidden" aria-label="Selected command audit details">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-start gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="size-11 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-sm border border-sky-500/20 shrink-0">
          {command.publisher.avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">{command.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-1.5">{command.description}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'audit' | 'publisher')} className="flex flex-col flex-1 min-h-0">
        <div className="px-6 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
          <TabsList className="flex gap-4 bg-transparent p-0 rounded-none w-auto border-none">
            <TabsTrigger value="details" className="relative h-10 bg-transparent px-1 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-sky-500 dark:data-[state=active]:text-sky-400 data-[state=active]:border-b-2 data-[state=active]:border-sky-500 dark:data-[state=active]:border-sky-400 rounded-none shadow-none border-none transition-all cursor-pointer">Details</TabsTrigger>
            <TabsTrigger value="audit" className="relative h-10 bg-transparent px-1 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-sky-500 dark:data-[state=active]:text-sky-400 data-[state=active]:border-b-2 data-[state=active]:border-sky-500 dark:data-[state=active]:border-sky-400 rounded-none shadow-none border-none transition-all cursor-pointer">Audit Report</TabsTrigger>
            <TabsTrigger value="publisher" className="relative h-10 bg-transparent px-1 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:text-sky-500 dark:data-[state=active]:text-sky-400 data-[state=active]:border-b-2 data-[state=active]:border-sky-500 dark:data-[state=active]:border-sky-400 rounded-none shadow-none border-none transition-all cursor-pointer">Publisher</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="details" className="p-6 m-0 flex flex-col gap-6">
            <div className="flex gap-2">
              <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                command.trustLevel === 'verified' ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30' :
                command.trustLevel === 'reviewed' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' :
                command.trustLevel === 'community' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' :
                'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30'
              }`}>{trustCopy[command.trustLevel]}</span>
              <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                command.risk === 'low' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/40' :
                command.risk === 'medium' ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30' :
                'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
              }`}>{riskCopy[command.risk]} risk</span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/40 pb-3">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Publisher</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {command.publisher.name} <span className="text-slate-400 dark:text-slate-500 font-semibold">@{command.publisher.handle}</span>
                </span>
              </div>
              <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/40 pb-3">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Source</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  <a href={command.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline inline-flex items-center gap-1">
                    {command.sourceUrl.replace('https://github.com/', '')}
                    <ExternalLink className="size-3" />
                  </a>
                </span>
              </div>
              <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/40 pb-3">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Website Match</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">{command.matchPatterns.join(', ')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Requested permissions</h3>
              <div className="flex flex-wrap gap-1.5">
                {command.permissions.map((permission) => {
                  const isSensitive = ['Network access', 'Read page DOM'].includes(permission);
                  return (
                    <span 
                      key={permission} 
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        isSensitive 
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                      }`}
                    >
                      {permission}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* CLI Command Installation Panel */}
            <div className="flex flex-col gap-2.5 mt-2 bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-900/60 rounded-xl shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Terminal className="size-3.5 text-sky-500" />
                <strong className="text-[10px] font-extrabold uppercase tracking-widest">CLI Installation</strong>
              </div>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 px-3.5 py-2 rounded-lg font-mono text-xs text-slate-800 dark:text-slate-200 select-all shrink-0">
                <span className="truncate">{cliCommand}</span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(cliCommand, 'cli')}
                  className="bg-transparent border-none text-slate-400 hover:text-sky-500 cursor-pointer p-0 shrink-0"
                  title="Copy command"
                >
                  {copiedCli ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            {/* Script Source Preview */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Code className="size-3.5 text-sky-500" />
                  <strong className="text-[10px] font-extrabold uppercase tracking-widest">Code Preview</strong>
                </div>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(sourceCode, 'code')}
                  className="text-xs font-bold text-sky-500 hover:text-sky-400 bg-transparent border-none cursor-pointer p-0 flex items-center gap-1"
                >
                  {copiedCode ? (
                    <>
                      <Check className="size-3 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy source code
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-100 dark:bg-slate-950/80 rounded-xl font-mono text-xs overflow-x-auto select-all max-h-[300px] border border-slate-800">
                <code>{sourceCode}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="p-6 m-0 flex flex-col gap-6">
            {auditReport ? (
              <>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Audit Summary</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                      auditReport.status === 'pass' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' :
                      auditReport.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' :
                      'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                    }`}>
                      {auditReport.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold mt-1">{auditReport.summary}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold border-t border-slate-200/50 dark:border-slate-800/40 pt-2.5 mt-2">
                    <span>Version: {auditReport.version}</span>
                    <span>Audited: {auditReport.auditedAt}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Static Review Checks</h3>
                  <div className="flex flex-col gap-2.5">
                    <ChecklistItem
                      label="Host Scope Restrictions"
                      status={auditReport.checks.hostScope.status}
                      detail={auditReport.checks.hostScope.detail}
                    />
                    <ChecklistItem
                      label="Required API Permissions"
                      status={auditReport.checks.permissions.status}
                      detail={auditReport.checks.permissions.detail}
                    />
                    <ChecklistItem
                      label="Remote Code Loading"
                      status={auditReport.checks.remoteCode.status}
                      detail={auditReport.checks.remoteCode.detail}
                    />
                    <ChecklistItem
                      label="External Network Access"
                      status={auditReport.checks.networkAccess.status}
                      detail={auditReport.checks.networkAccess.detail}
                    />
                    <ChecklistItem
                      label="Obfuscation & Compilation"
                      status={auditReport.checks.obfuscation.status}
                      detail={auditReport.checks.obfuscation.detail}
                    />
                    <ChecklistItem
                      label="Package Signature & Integrity"
                      status={auditReport.checks.signature.status}
                      detail={auditReport.checks.signature.detail}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-slate-400">
                <ShieldCheck className="size-8 opacity-40 mb-2" />
                <span className="text-xs font-semibold">No audit report available for this command.</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="publisher" className="p-6 m-0 flex flex-col gap-6">
            {publisherProfile ? (
              <>
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800/40 pb-5">
                  <div className="size-12 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-sm border border-sky-500/20 shrink-0">
                    {publisherProfile.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{publisherProfile.name}</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block truncate mt-0.5">@{publisherProfile.handle}</span>
                    <div className="mt-2">
                      {publisherProfile.verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          ✓ Verified Publisher
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                          Community Contributor
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {publisherProfile.bio && (
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Biography</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">{publisherProfile.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/40 rounded-xl flex flex-col gap-1 shadow-sm">
                    <strong className="text-base font-extrabold text-slate-800 dark:text-slate-200">{publisherProfile.publishedCommandsCount}</strong>
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Commands</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/40 rounded-xl flex flex-col gap-1 shadow-sm">
                    <strong className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {new Date(publisherProfile.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                    </strong>
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-auto">Joined</span>
                  </div>
                </div>

                {publisherProfile.verifiedSources.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verified Sources</h3>
                    <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                      {publisherProfile.verifiedSources.map((source) => (
                        <li key={source} className="text-xs font-semibold">
                          <a href={`https://${source}`} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline inline-flex items-center gap-1">
                            {source}
                            <ExternalLink className="size-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-slate-400">
                <Users className="size-8 opacity-40 mb-2" />
                <span className="text-xs font-semibold">No publisher profile details available.</span>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/60 flex gap-3 shrink-0">
        <Button
          variant={isInstalled ? "destructive" : "default"}
          className="flex-1 font-bold text-xs h-9 cursor-pointer border-none"
          onClick={() => (isInstalled ? onUninstall(command.id) : onInstall(command))}
        >
          {isInstalled ? 'Uninstall' : 'Install'}
        </Button>
        <Button
          variant="outline"
          className="flex-1 font-bold text-xs h-9 cursor-pointer"
          disabled={!isInstalled}
          onClick={() => (isPinned ? onUnpin(command.id) : onPin(command.id))}
        >
          {isPinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>
    </aside>
  );
}
