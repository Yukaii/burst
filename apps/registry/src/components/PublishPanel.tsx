import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import type { BurstCommand } from '@/src/lib/commands';
import type { RegistrySessionUser } from '@/src/lib/registryApi';
import { publishCommand } from '@/src/lib/registryApi';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { ChecklistItem } from './CommandInspector';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Lock, RotateCcw, Save } from 'lucide-react';

interface PublishPanelProps {
  currentUser: RegistrySessionUser;
  onPublishSuccess: (newCommand: BurstCommand) => void;
  setNavTab: (tab: 'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings') => void;
}

export function PublishPanel({ currentUser, onPublishSuccess, setNavTab }: PublishPanelProps) {
  const isGuest = currentUser.handle === 'guest';
  const draftKey = currentUser.handle === 'guest' ? null : `burst.registry.publishDraft.${currentUser.handle}.v1`;

  const [title, setTitle] = useState('');
  const [id, setId] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [matchPattern, setMatchPattern] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [code, setCode] = useState(`export default async function run({ page, toast }) {\n  // Write your command code here\n  toast("Hello from " + page.title);\n}`);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'restored'>('idle');

  const editorExtensions = useMemo(() => [
    javascript({ jsx: true, typescript: true }),
    EditorView.lineWrapping,
  ], []);

  useEffect(() => {
    if (!draftKey) return;
    const rawDraft = localStorage.getItem(draftKey);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        title?: string;
        id?: string;
        description?: string;
        website?: string;
        matchPattern?: string;
        sourceUrl?: string;
        code?: string;
        permissions?: string[];
      };
      setTitle(draft.title ?? '');
      setId(draft.id ?? '');
      setDescription(draft.description ?? '');
      setWebsite(draft.website ?? '');
      setMatchPattern(draft.matchPattern ?? '');
      setSourceUrl(draft.sourceUrl ?? '');
      setCode(draft.code ?? code);
      setPermissions(Array.isArray(draft.permissions) ? draft.permissions : []);
      setDraftStatus('restored');
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || isGuest) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({
        title,
        id,
        description,
        website,
        matchPattern,
        sourceUrl,
        code,
        permissions,
      }));
      setDraftStatus('saved');
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [draftKey, isGuest, title, id, description, website, matchPattern, sourceUrl, code, permissions]);

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setTitle('');
    setId('');
    setDescription('');
    setWebsite('');
    setMatchPattern('');
    setSourceUrl('');
    setCode(`export default async function run({ page, toast }) {\n  // Write your command code here\n  toast("Hello from " + page.title);\n}`);
    setPermissions([]);
    setErrors({});
    setDraftStatus('idle');
  };

  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[350px]">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="size-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-extrabold text-lg border border-amber-500/20 mb-4">
            <Lock className="size-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">Authentication Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            You must be signed in as a verified publisher or community contributor to publish commands to the registry.
          </p>
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-900/60 rounded-xl text-left">
            <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Note:</span> Sign in with GitHub before publishing. The registry requires a real OAuth session for registry actions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setId(slug);
  };

  const handlePermissionToggle = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const parsedMatchPatterns = matchPattern
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const auditResult = analyzeScriptCode(code, parsedMatchPatterns);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!id.trim()) newErrors.id = 'Command ID is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!website.trim()) newErrors.website = 'Website scope is required';
    if (!matchPattern.trim()) newErrors.matchPattern = 'Match pattern is required';
    if (!sourceUrl.trim()) {
      newErrors.sourceUrl = 'Source URL is required';
    } else if (!sourceUrl.startsWith('https://')) {
      newErrors.sourceUrl = 'Source URL must begin with https:// (secured origin)';
    }
    if (!code.trim()) newErrors.code = 'Source code is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const profileDetails = currentUser.handle === 'guest' ? undefined : currentUser;
    const isVerifiedSource = profileDetails?.verifiedSources?.some((source: string) =>
      sourceUrl.toLowerCase().includes(source.toLowerCase())
    ) ?? false;

    let trustLevel: BurstCommand['trustLevel'] = 'community';
    let riskLevel: BurstCommand['risk'] = 'low';

    if (auditResult.status === 'fail') {
      riskLevel = 'high';
      trustLevel = 'community';
    } else if (auditResult.status === 'warning') {
      riskLevel = 'medium';
      trustLevel = isVerifiedSource ? 'verified' : 'community';
    } else {
      riskLevel = 'low';
      trustLevel = isVerifiedSource ? 'verified' : 'community';
    }

    const finalPermissions = [...permissions];
    if (code.includes('page.') || code.includes('document.')) {
      if (!finalPermissions.includes('Read page DOM')) finalPermissions.push('Read page DOM');
    }
    if (code.includes('clipboard.write') || code.includes('writeText')) {
      if (!finalPermissions.includes('Write clipboard')) finalPermissions.push('Write clipboard');
    }
    if (code.includes('selection')) {
      if (!finalPermissions.includes('Read selection')) finalPermissions.push('Read selection');
    }
    if (code.includes('toast')) {
      if (!finalPermissions.includes('Toast alerts')) finalPermissions.push('Toast alerts');
    }
    if (code.includes('fetch') || code.includes('XMLHttpRequest')) {
      if (!finalPermissions.includes('Network access')) finalPermissions.push('Network access');
    }

    try {
      const payload = {
        id,
        title,
        description,
        website,
        matchPatterns: parsedMatchPatterns,
        publisherHandle: currentUser.handle,
        trustLevel,
        risk: riskLevel,
        permissions: finalPermissions.length > 0 ? finalPermissions : ['None'],
        sourceUrl,
        icon: { type: 'initials' as const, value: title.substring(0, 2).toUpperCase() },
        code,
        version: '1.0.0',
      };
      const newCommand = await publishCommand(payload);
      if (draftKey) localStorage.removeItem(draftKey);
      onPublishSuccess(newCommand);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to publish command' });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
      <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/60 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Publish a New Command</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Define manifest capabilities, declare host scopes, and write the execution block.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              <Save className="size-3" />
              {draftStatus === 'restored' ? 'Draft restored' : draftStatus === 'saved' ? 'Draft saved' : 'Draft ready'}
            </span>
            <Button type="button" variant="outline" className="h-8 px-2 text-xs font-bold" onClick={clearDraft}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {errors.form && (
          <div className="lg:col-span-3 text-xs font-bold px-3 py-2.5 rounded-lg border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
            {errors.form}
          </div>
        )}

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Title</label>
                <Input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Copy GitHub branch name"
                  className="font-semibold text-xs h-9"
                />
                {errors.title && <span className="text-[10px] font-bold text-rose-500">{errors.title}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Command ID</label>
                <Input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. copy-github-branch"
                  className="font-semibold text-xs h-9"
                />
                {errors.id && <span className="text-[10px] font-bold text-rose-500">{errors.id}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a clear description of the command and its features..."
                rows={3}
                className="font-medium text-xs min-h-[80px]"
              />
              {errors.description && <span className="text-[10px] font-bold text-rose-500">{errors.description}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Target Website (Friendly Name)</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. github.com or all sites"
                  className="font-semibold text-xs h-9"
                />
                {errors.website && <span className="text-[10px] font-bold text-rose-500">{errors.website}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Match Pattern (comma separated)</label>
                <Input
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder="e.g. github.com/*, *://*.github.com/*"
                  className="font-semibold text-xs h-9"
                />
                {errors.matchPattern && <span className="text-[10px] font-bold text-rose-500">{errors.matchPattern}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Secure Source URL (Git Repository / Gist)</label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="font-semibold text-xs h-9"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Used for publisher verification checks. Must match verified sources.</span>
              {errors.sourceUrl && <span className="text-[10px] font-bold text-rose-500">{errors.sourceUrl}</span>}
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Explicit Permission Declarations</label>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {['Read page DOM', 'Write clipboard', 'Read selection', 'Toast alerts', 'Network access'].map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={permissions.includes(perm)}
                      onChange={() => handlePermissionToggle(perm)}
                      className="rounded border-slate-300 dark:border-slate-700 text-sky-500 focus:ring-sky-500 size-4 cursor-pointer"
                    />
                    <span>{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Source Code (ES Module)</label>
              <div className="overflow-hidden border border-[#1e293b] rounded-lg bg-[#0b0f19]">
                <CodeMirror
                  value={code}
                  basicSetup={{
                    bracketMatching: true,
                    closeBrackets: true,
                    defaultKeymap: true,
                    foldGutter: false,
                    highlightActiveLine: true,
                    highlightActiveLineGutter: true,
                    lineNumbers: true,
                  }}
                  extensions={editorExtensions}
                  height="360px"
                  theme="dark"
                  onChange={(value) => setCode(value)}
                />
              </div>
              {errors.code && <span className="text-[10px] font-bold text-rose-500">{errors.code}</span>}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="font-bold text-xs h-10 px-6 cursor-pointer">
              Publish Command
            </Button>
            <Button type="button" variant="outline" className="font-bold text-xs h-10 px-6 cursor-pointer" onClick={() => setNavTab('Discover')}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-6 sticky top-6">
            <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Safety Audit</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                  auditResult.status === 'pass' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' :
                  auditResult.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' :
                  'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                }`}>
                  {auditResult.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold leading-relaxed">{auditResult.summary}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <ChecklistItem
                label="Host Scope Restrictions"
                status={auditResult.checks.hostScope.status}
                detail={auditResult.checks.hostScope.detail}
              />
              <ChecklistItem
                label="Required API Permissions"
                status={auditResult.checks.permissions.status}
                detail={auditResult.checks.permissions.detail}
              />
              <ChecklistItem
                label="Remote Code Loading"
                status={auditResult.checks.remoteCode.status}
                detail={auditResult.checks.remoteCode.detail}
              />
              <ChecklistItem
                label="External Network Access"
                status={auditResult.checks.networkAccess.status}
                detail={auditResult.checks.networkAccess.detail}
              />
              <ChecklistItem
                label="Obfuscation & Compilation"
                status={auditResult.checks.obfuscation.status}
                detail={auditResult.checks.obfuscation.detail}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
