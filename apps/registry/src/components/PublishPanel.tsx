import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import type { BurstCommand, BurstCommandPack } from '@/src/lib/commands';
import type { LocalScript } from '@/src/lib/localScripts';
import type { RegistrySessionUser } from '@/src/lib/registryApi';
import { publishCommand, publishCommandPack } from '@/src/lib/registryApi';
import { analyzeScriptCode } from '@/src/lib/staticAnalysis';
import { ChecklistItem } from './CommandInspector';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Eraser, FileCode2, Lock, PlugZap, RefreshCw, RotateCcw, Save } from 'lucide-react';

interface PublishPanelProps {
  currentUser: RegistrySessionUser;
  onPublishSuccess: (newCommand: BurstCommand) => void;
  onPackPublishSuccess: (newPack: BurstCommandPack) => void;
  setNavTab: (tab: 'Discover' | 'Publish' | 'Users' | 'Audits' | 'Settings') => void;
  bridgeConnected: boolean;
  localScripts: LocalScript[];
  availableCommands: BurstCommand[];
  onRefreshLocalScripts: () => void;
}

export function PublishPanel({
  currentUser,
  onPublishSuccess,
  onPackPublishSuccess,
  setNavTab,
  bridgeConnected,
  localScripts,
  availableCommands,
  onRefreshLocalScripts,
}: PublishPanelProps) {
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
  const [selectedLocalScriptId, setSelectedLocalScriptId] = useState('');
  const [publishMode, setPublishMode] = useState<'command' | 'pack'>('command');
  const [packTitle, setPackTitle] = useState('');
  const [packId, setPackId] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [packWebsite, setPackWebsite] = useState('');
  const [packMatchPattern, setPackMatchPattern] = useState('');
  const [packSourceUrl, setPackSourceUrl] = useState('');
  const [selectedPackCommandIds, setSelectedPackCommandIds] = useState<string[]>([]);

  const editorExtensions = useMemo(() => [
    javascript({ jsx: true, typescript: true }),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': {
        fontSize: '13px',
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        lineHeight: '1.55',
      },
      '.cm-gutters': {
        fontSize: '12px',
      },
    }),
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
    clearForm();
  };

  const clearForm = () => {
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
    setSelectedLocalScriptId('');
    setPackTitle('');
    setPackId('');
    setPackDescription('');
    setPackWebsite('');
    setPackMatchPattern('');
    setPackSourceUrl('');
    setSelectedPackCommandIds([]);
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

  const fillFromLocalScript = (scriptId: string) => {
    const script = localScripts.find((item) => item.id === scriptId);
    if (!script) return;

    handleTitleChange(script.name);
    const patterns = script.matchPatterns.length > 0 ? script.matchPatterns : ['<all_urls>'];
    setMatchPattern(patterns.join(', '));
    setWebsite(patterns.includes('<all_urls>')
      ? 'All websites'
      : patterns.map((pattern) => pattern.replace(/^\*:\/\/|\/\*$/g, '')).join(', '));
    setDescription(`Publishes the local Burst command "${script.name}" for reuse from the registry.`);
    setSourceUrl(script.originRegistryUrl?.startsWith('https://') ? script.originRegistryUrl : '');
    setCode(script.code);
    setPermissions([]);
    setErrors({});
    setDraftStatus('saved');
  };

  const describeLocalScriptScope = (script: LocalScript) => {
    const patterns = script.matchPatterns.length > 0 ? script.matchPatterns : ['<all_urls>'];
    return patterns.includes('<all_urls>') ? 'All websites' : patterns.join(', ');
  };

  const selectedLocalScript = localScripts.find((script) => script.id === selectedLocalScriptId);
  const publishableCommands = availableCommands.filter((command) => command.publisher.handle === currentUser.handle);
  const selectedPackCommands = publishableCommands.filter((command) => selectedPackCommandIds.includes(command.id));

  const parsedMatchPatterns = matchPattern
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const auditResult = analyzeScriptCode(code, parsedMatchPatterns);

  const handlePackSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};
    const packPatterns = packMatchPattern.split(',').map((pattern) => pattern.trim()).filter(Boolean);

    if (!packTitle.trim()) newErrors.packTitle = 'Pack title is required';
    if (!packId.trim()) newErrors.packId = 'Pack ID is required';
    if (!packDescription.trim()) newErrors.packDescription = 'Pack description is required';
    if (!packWebsite.trim()) newErrors.packWebsite = 'Website scope is required';
    if (packPatterns.length === 0) newErrors.packMatchPattern = 'Match pattern is required';
    if (!packSourceUrl.trim()) {
      newErrors.packSourceUrl = 'Source URL is required';
    } else if (!packSourceUrl.startsWith('https://')) {
      newErrors.packSourceUrl = 'Source URL must begin with https://';
    }
    if (selectedPackCommandIds.length === 0) newErrors.packCommands = 'Select at least one command';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const newPack = await publishCommandPack({
        id: packId,
        title: packTitle,
        description: packDescription,
        website: packWebsite,
        matchPatterns: packPatterns,
        publisherHandle: currentUser.handle,
        sourceUrl: packSourceUrl,
        icon: { type: 'initials' as const, value: packTitle.substring(0, 2).toUpperCase() },
        commandIds: selectedPackCommandIds,
        version: '1.0.0',
      });
      onPackPublishSuccess(newPack);
      setErrors({});
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to publish command pack' });
    }
  };


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
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{publishMode === 'command' ? 'Publish a New Command' : 'Create a Command Pack'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {publishMode === 'command'
                ? 'Define manifest capabilities, declare host scopes, and write the execution block.'
                : 'Group already-published commands into one installable website pack.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                className={`h-7 rounded-md px-3 text-xs font-bold ${publishMode === 'command' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setPublishMode('command')}
              >
                Command
              </button>
              <button
                type="button"
                className={`h-7 rounded-md px-3 text-xs font-bold ${publishMode === 'pack' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setPublishMode('pack')}
              >
                Pack
              </button>
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 text-2xs font-bold text-slate-500 dark:text-slate-400">
              <Save className="size-3" />
              {draftStatus === 'restored' ? 'Draft restored' : draftStatus === 'saved' ? 'Draft saved' : 'Draft ready'}
            </span>
            <Button type="button" variant="outline" className="h-8 px-3 font-bold" onClick={clearDraft}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {publishMode === 'pack' ? (
        <form onSubmit={(event) => void handlePackSubmit(event)} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {errors.form && (
            <div className="lg:col-span-2 text-xs font-bold px-3 py-2.5 rounded-lg border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
              {errors.form}
            </div>
          )}
          <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Pack title</label>
                <Input
                  value={packTitle}
                  onChange={(event) => {
                    setPackTitle(event.target.value);
                    setPackId(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                  placeholder="e.g. GitHub Workflow Pack"
                />
                {errors.packTitle && <span className="text-[10px] font-bold text-rose-500">{errors.packTitle}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Pack ID</label>
                <Input value={packId} onChange={(event) => setPackId(event.target.value)} placeholder="github-workflow-pack" className="font-mono" />
                {errors.packId && <span className="text-[10px] font-bold text-rose-500">{errors.packId}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Description</label>
              <Textarea
                value={packDescription}
                onChange={(event) => setPackDescription(event.target.value)}
                placeholder="Describe the set of workflows this pack installs together..."
                rows={3}
              />
              {errors.packDescription && <span className="text-[10px] font-bold text-rose-500">{errors.packDescription}</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Website</label>
                <Input value={packWebsite} onChange={(event) => setPackWebsite(event.target.value)} placeholder="github.com or all sites" />
                {errors.packWebsite && <span className="text-[10px] font-bold text-rose-500">{errors.packWebsite}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Match patterns</label>
                <Input value={packMatchPattern} onChange={(event) => setPackMatchPattern(event.target.value)} placeholder="github.com/*, <all_urls>" />
                {errors.packMatchPattern && <span className="text-[10px] font-bold text-rose-500">{errors.packMatchPattern}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Secure Source URL</label>
              <Input value={packSourceUrl} onChange={(event) => setPackSourceUrl(event.target.value)} placeholder="https://github.com/username/repo" />
              {errors.packSourceUrl && <span className="text-[10px] font-bold text-rose-500">{errors.packSourceUrl}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Commands</label>
                <span className="text-[10px] font-semibold text-muted-foreground">{selectedPackCommands.length} selected</span>
              </div>
              {errors.packCommands && <span className="text-[10px] font-bold text-rose-500">{errors.packCommands}</span>}
              <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 xl:grid-cols-2">
                {publishableCommands.length > 0 ? publishableCommands.map((command) => {
                  const checked = selectedPackCommandIds.includes(command.id);
                  return (
                    <label key={command.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedPackCommandIds((prev) => (
                          prev.includes(command.id)
                            ? prev.filter((id) => id !== command.id)
                            : [...prev, command.id]
                        ))}
                        className="mt-0.5 size-4 shrink-0 rounded border-border"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-foreground">{command.title}</span>
                        <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground">{command.website} · {command.version || '1.0.0'}</span>
                        <span className="mt-1 block line-clamp-2 text-[11px] text-muted-foreground">{command.description}</span>
                      </span>
                    </label>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-semibold text-muted-foreground">
                    Publish at least one command before creating a pack.
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="h-8 px-4 font-semibold" disabled={publishableCommands.length === 0}>
                Publish Pack
              </Button>
              <Button type="button" variant="outline" className="h-8 px-4 font-semibold" onClick={clearForm}>
                <Eraser className="size-3.5" />
                Clear form
              </Button>
              <Button type="button" variant="outline" className="h-8 px-4 font-semibold" onClick={() => setNavTab('Discover')}>
                Cancel
              </Button>
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground">Pack Preview</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
              Packs reference commands you already published. Command code and audits stay command-owned.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {selectedPackCommands.map((command) => (
                <div key={command.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="truncate text-xs font-bold text-foreground">{command.title}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">{command.risk} risk · {command.trustLevel}</div>
                </div>
              ))}
              {selectedPackCommands.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-xs font-semibold text-muted-foreground">No commands selected.</div>
              )}
            </div>
          </aside>
        </form>
      ) : null}

      {publishMode === 'command' && <div className={`flex flex-col gap-3 rounded-lg border p-3.5 ${
        bridgeConnected
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-card text-muted-foreground'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className={`grid size-7 shrink-0 place-items-center rounded-md border ${
              bridgeConnected
                ? 'border-emerald-500/25 bg-emerald-500/10'
                : 'border-border bg-muted/40'
            }`}>
              <PlugZap className="size-3.5" />
            </span>
            <div className="min-w-0">
              <strong className="block text-xs font-bold text-foreground">
                {bridgeConnected ? 'Extension connected' : 'Extension bridge not detected'}
              </strong>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {bridgeConnected
                  ? 'Select a local development script to prefill the publish form. Add a secure source URL before submitting.'
                  : 'Open this registry page with the Burst extension enabled to import local development scripts.'}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 font-semibold"
            onClick={onRefreshLocalScripts}
            disabled={!bridgeConnected}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>

        {bridgeConnected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <label className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground sm:w-40">
                <FileCode2 className="size-3.5" />
                Local script
              </label>
              <Select
                value={selectedLocalScriptId}
                disabled={localScripts.length === 0}
                onValueChange={(value) => {
                  setSelectedLocalScriptId(value);
                  fillFromLocalScript(value);
                }}
              >
                <SelectTrigger className="h-11 min-w-0 flex-1 bg-background px-3 text-[13px] font-medium">
                  {selectedLocalScript ? (
                    <span className="flex min-w-0 flex-col items-start gap-0.5 overflow-hidden">
                      <span className="max-w-full truncate text-xs font-semibold text-foreground">
                        {selectedLocalScript.name}
                      </span>
                      <span className="max-w-full truncate font-mono text-[10px] leading-none text-muted-foreground">
                        {describeLocalScriptScope(selectedLocalScript)}
                      </span>
                    </span>
                  ) : (
                    <SelectValue placeholder={localScripts.length > 0 ? 'Select a script to fill this form...' : 'No local scripts found'} />
                  )}
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width) max-h-[320px] p-1.5">
                  {localScripts.map((script) => (
                    <SelectItem
                      key={script.id}
                      value={script.id}
                      className="min-h-[72px] items-start gap-2 py-2.5 pr-8 pl-2.5"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-xs font-semibold text-foreground">{script.name}</span>
                          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none ${
                            script.status === 'enabled'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : script.status === 'draft'
                                ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'border-slate-500/20 bg-slate-500/10 text-slate-500 dark:text-slate-400'
                          }`}>
                            {script.status}
                          </span>
                        </span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {describeLocalScriptScope(script)}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Updated {script.updatedAt}{script.version ? ` - v${script.version}` : ''}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>}

      {publishMode === 'command' && <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  className="font-medium"
                />
                {errors.title && <span className="text-[10px] font-bold text-rose-500">{errors.title}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Command ID</label>
                <Input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. copy-github-branch"
                  className="font-medium"
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
                className="font-medium min-h-[88px]"
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
                  className="font-medium"
                />
                {errors.website && <span className="text-[10px] font-bold text-rose-500">{errors.website}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Match Pattern (comma separated)</label>
                <Input
                  value={matchPattern}
                  onChange={(e) => setMatchPattern(e.target.value)}
                  placeholder="e.g. github.com/*, *://*.github.com/*"
                  className="font-medium"
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
                className="font-medium"
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

          <div className="flex gap-2">
            <Button type="submit" className="font-semibold h-8 px-4 cursor-pointer">
              Publish Command
            </Button>
            <Button type="button" variant="outline" className="font-semibold h-8 px-4 cursor-pointer" onClick={clearForm}>
              <Eraser className="size-3.5" />
              Clear form
            </Button>
            <Button type="button" variant="outline" className="font-semibold h-8 px-4 cursor-pointer" onClick={() => setNavTab('Discover')}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-6 sticky top-6">
            <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Safety Audit</h3>
                <span className={`px-2.5 py-1 rounded-full text-[9px] leading-none font-extrabold uppercase border ${
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
      </form>}
    </div>
  );
}
