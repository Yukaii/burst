import { useState } from 'react';
import type { ReactNode } from 'react';
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
  Code,
  X
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

const javascriptKeywords = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'const',
  'continue',
  'default',
  'else',
  'export',
  'false',
  'for',
  'from',
  'function',
  'if',
  'import',
  'let',
  'new',
  'null',
  'return',
  'throw',
  'true',
  'try',
  'undefined',
  'while',
]);

function highlightJavaScript(source: string) {
  const tokenPattern = /(\/\/.*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^`])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[{}()[\].,;:+\-*/%=<>!?|&]+)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(source)) !== null) {
    const token = match[0];
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }

    let className = 'syntax-token';
    if (token.startsWith('//') || token.startsWith('/*')) {
      className += ' syntax-comment';
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      className += ' syntax-string';
    } else if (/^\d/.test(token)) {
      className += ' syntax-number';
    } else if (javascriptKeywords.has(token)) {
      className += ' syntax-keyword';
    } else if (/^[{}()[\].,;:+\-*/%=<>!?|&]+$/.test(token)) {
      className += ' syntax-punctuation';
    } else {
      className += ' syntax-identifier';
    }

    nodes.push(
      <span className={className} key={`${match.index}-${token}`}>
        {token}
      </span>
    );
    cursor = match.index + token.length;
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }

  return nodes;
}

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
    <aside className="absolute top-3.5 right-3.5 bottom-3.5 flex flex-col w-[calc(100vw-308px)] max-w-[760px] min-h-0 overflow-hidden border border-border rounded-lg bg-card shadow-[0_24px_90px_hsl(var(--foreground)/0.22)] p-6 gap-6" aria-label="Registry status">
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
  onClose,
  onPointerDown,
  onClick,
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
  onClose: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onClick?: React.MouseEventHandler<HTMLElement>;
}) {
  const [copiedCode, setCopiedCode] = useState(false);

  if (loading) {
    return (
      <aside className="absolute top-3.5 right-3.5 bottom-3.5 flex flex-col w-[calc(100vw-308px)] max-w-[760px] min-h-0 overflow-hidden border border-border rounded-lg bg-card shadow-[0_24px_90px_hsl(var(--foreground)/0.22)] items-center justify-center p-8" aria-label="Loading details">
        <RefreshCw className="size-6 animate-spin text-sky-500" />
        <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-3">Loading details...</span>
      </aside>
    );
  }

  const isInstalled = installedCommandIds.includes(command.id);
  const isPinned = pinnedCommandIds.includes(command.id);

  const sourceCode = command.code || `export default async function run({ page, toast }) {\n  // Source code is not available for this package\n}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <aside
      className="absolute top-3.5 right-3.5 bottom-3.5 flex flex-col w-[calc(100vw-308px)] max-w-[760px] min-h-0 overflow-hidden border border-border rounded-lg bg-card shadow-[0_24px_90px_hsl(var(--foreground)/0.22)]"
      aria-label="Selected command audit details"
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className="flex items-start gap-3.5 shrink-0 border-b border-border bg-background p-4">
        <div className="size-11 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-sm border border-sky-500/20 shrink-0">
          {command.publisher.avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">{command.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mt-1.5">{command.description}</p>
        </div>
        <button
          type="button"
          className="grid w-7.5 h-7.5 shrink-0 place-items-center border border-border rounded-lg bg-card text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
          onClick={onClose}
          aria-label="Close command details"
          title="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'audit' | 'publisher')} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border p-2 px-2.5">
          <TabsList className="!grid !grid-cols-3 !w-full !border !border-border !rounded-[7px] !bg-background !p-[3px] !overflow-hidden">
            <TabsTrigger value="details" className="!w-full !min-w-0 !inline-flex !items-center !justify-center !h-[28px] !border-0 !rounded-[5px] !bg-transparent !text-muted-foreground cursor-pointer !text-[11px] !font-bold !leading-none !overflow-hidden !text-ellipsis !whitespace-nowrap transition-colors hover:!bg-accent hover:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!text-accent-foreground data-active:!bg-accent data-active:!text-accent-foreground">Details</TabsTrigger>
            <TabsTrigger value="audit" className="!w-full !min-w-0 !inline-flex !items-center !justify-center !h-[28px] !border-0 !rounded-[5px] !bg-transparent !text-muted-foreground cursor-pointer !text-[11px] !font-bold !leading-none !overflow-hidden !text-ellipsis !whitespace-nowrap transition-colors hover:!bg-accent hover:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!text-accent-foreground data-active:!bg-accent data-active:!text-accent-foreground">Audit</TabsTrigger>
            <TabsTrigger value="publisher" className="!w-full !min-w-0 !inline-flex !items-center !justify-center !h-[28px] !border-0 !rounded-[5px] !bg-transparent !text-muted-foreground cursor-pointer !text-[11px] !font-bold !leading-none !overflow-hidden !text-ellipsis !whitespace-nowrap transition-colors hover:!bg-accent hover:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!text-accent-foreground data-active:!bg-accent data-active:!text-accent-foreground">Publisher</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <TabsContent value="details" className="flex flex-col gap-3 m-0 p-3.5">
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

            <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
              <div className="flex min-w-0 flex-col gap-1.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
                <span className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Publisher</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {command.publisher.name} <span className="text-slate-400 dark:text-slate-500 font-semibold">{command.publisher.handle.startsWith('@') ? command.publisher.handle : `@${command.publisher.handle}`}</span>
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
                <span className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Source</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  <a href={command.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline inline-flex items-center gap-1">
                    {command.sourceUrl.replace('https://github.com/', '')}
                    <ExternalLink className="size-3" />
                  </a>
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
                <span className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Website Match</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">{command.matchPatterns.join(', ')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
              <h3 className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Requested permissions</h3>
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

            {/* Script Source Preview */}
            <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Code className="size-3.5 text-sky-500" />
                  <strong className="text-[10px] font-extrabold uppercase tracking-widest">Code Preview</strong>
                </div>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(sourceCode)}
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
              <pre className="max-h-[320px] m-0 overflow-auto border border-[#1e293b] rounded-lg bg-[#0b0f19] text-[#e2e8f0] font-mono text-[11px] leading-relaxed p-3.5 whitespace-pre-wrap overflow-wrap-anywhere break-all">
                <code>{highlightJavaScript(sourceCode)}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="flex flex-col gap-3 m-0 p-3.5">
            {auditReport ? (
              <>
                <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
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

                <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
                  <h3 className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Static Review Checks</h3>
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

          <TabsContent value="publisher" className="flex flex-col gap-3 m-0 p-3.5">
            {publisherProfile ? (
              <>
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800/40 pb-5">
                  <div className="size-12 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-extrabold text-sm border border-sky-500/20 shrink-0">
                    {publisherProfile.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{publisherProfile.name}</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500 block truncate mt-0.5">{publisherProfile.handle.startsWith('@') ? publisherProfile.handle : `@${publisherProfile.handle}`}</span>
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
                  <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
                    <h3 className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Biography</h3>
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
                  <div className="flex flex-col gap-2.5 min-w-0 border border-border rounded-lg bg-background p-3">
                    <h3 className="m-0 text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none uppercase">Verified Sources</h3>
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

      <div className="flex gap-2 shrink-0 border-t border-border bg-background p-2.5">
        <Button
          variant={isInstalled ? "destructive" : "default"}
          className="flex-1 font-semibold text-[11px] h-7.5 cursor-pointer border-none"
          onClick={() => (isInstalled ? onUninstall(command.id) : onInstall(command))}
        >
          {isInstalled ? 'Uninstall' : 'Install'}
        </Button>
        <Button
          variant="outline"
          className="flex-1 font-semibold text-[11px] h-7.5 cursor-pointer"
          disabled={!isInstalled}
          onClick={() => (isPinned ? onUnpin(command.id) : onPin(command.id))}
        >
          {isPinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>
    </aside>
  );
}
