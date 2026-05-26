import { useState } from 'react';
import type React from 'react';
import { Check, Code, Copy, ExternalLink, PackagePlus, RefreshCw, X } from 'lucide-react';
import type { BurstCommand, BurstCommandPack } from '@/src/lib/commands';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CommandIcon } from './CommandIcon';
import { highlightJavaScript } from './CommandInspector';

export function PackInspector({
  pack,
  loading,
  installedCommandIds,
  onInstallCommand,
  onUninstallCommand,
  onInstallPack,
  onUninstallPack,
  onClose,
  onPointerDown,
  onClick,
}: {
  pack: BurstCommandPack;
  loading: boolean;
  installedCommandIds: string[];
  onInstallCommand: (command: BurstCommand) => void;
  onUninstallCommand: (commandId: string) => void;
  onInstallPack: (pack: BurstCommandPack) => void;
  onUninstallPack: (packId: string) => void;
  onClose: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onClick?: React.MouseEventHandler<HTMLElement>;
}) {
  const [activeCommandId, setActiveCommandId] = useState(pack.commands[0]?.id ?? '');
  const [copiedCode, setCopiedCode] = useState(false);
  const activeCommand = pack.commands.find((command) => command.id === activeCommandId) ?? pack.commands[0];
  const installedCount = pack.commands.filter((command) => installedCommandIds.includes(command.id)).length;
  const isPackInstalled = installedCount === pack.commands.length;

  const copyCode = async () => {
    if (!activeCommand?.code) return;
    await navigator.clipboard.writeText(activeCommand.code);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  if (loading) {
    return (
      <aside className="absolute top-3.5 right-3.5 bottom-3.5 flex w-[calc(100vw-308px)] max-w-[860px] items-center justify-center rounded-lg border border-border bg-card shadow-[0_24px_90px_hsl(var(--foreground)/0.22)]">
        <RefreshCw className="size-6 animate-spin text-sky-500" />
      </aside>
    );
  }

  return (
    <aside
      className="absolute top-3.5 right-3.5 bottom-3.5 flex w-[calc(100vw-308px)] max-w-[860px] min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[0_24px_90px_hsl(var(--foreground)/0.22)] dark:shadow-none"
      aria-label="Selected command pack details"
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className="flex shrink-0 items-start gap-3.5 border-b border-border bg-background p-4">
        <CommandIcon
          icon={pack.icon}
          website={pack.website}
          matchPatterns={pack.matchPatterns}
          fallbackLabel={pack.publisher.avatarInitials}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sm font-extrabold text-sky-500"
          imageClassName="rounded-[11px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-bold leading-tight text-foreground">{pack.title}</h2>
            <Badge variant={pack.trustLevel === 'verified' ? 'secondary' : 'outline'} className="shrink-0 text-[9px] uppercase">
              {pack.trustLevel}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs leading-normal text-muted-foreground">{pack.description}</p>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
            {pack.commands.length} commands · {installedCount} installed · {pack.publisher.name} {pack.publisher.handle}
          </p>
        </div>
        <button
          type="button"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onClose}
          aria-label="Close pack details"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
        <section className="flex min-h-0 flex-col border-r border-border bg-background/60">
          <div className="shrink-0 border-b border-border p-3">
            <Button
              type="button"
              className="h-8 w-full justify-center text-xs font-semibold"
              variant={isPackInstalled ? 'outline' : 'default'}
              onClick={() => (isPackInstalled ? onUninstallPack(pack.id) : onInstallPack(pack))}
            >
              <PackagePlus className="size-3.5" />
              {isPackInstalled ? 'Uninstall pack' : `Install pack${installedCount > 0 ? ` (${installedCount}/${pack.commands.length})` : ''}`}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pack.commands.map((command) => {
              const selected = command.id === activeCommand?.id;
              const installed = installedCommandIds.includes(command.id);
              return (
                <button
                  key={command.id}
                  type="button"
                  className={`mb-1.5 flex w-full min-w-0 cursor-pointer flex-col rounded-md border p-2 text-left transition-colors ${
                    selected ? 'border-primary/40 bg-primary/10' : 'border-border bg-card hover:bg-accent/60'
                  }`}
                  onClick={() => setActiveCommandId(command.id)}
                >
                  <span className="truncate text-xs font-bold text-foreground">{command.title}</span>
                  <span className="mt-1 truncate text-[10px] font-semibold text-muted-foreground">{command.website}</span>
                  {installed && <span className="mt-1 text-[9px] font-extrabold uppercase text-emerald-500">Installed</span>}
                </button>
              );
            })}
          </div>
        </section>

        {activeCommand && (
          <section className="flex min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-foreground">{activeCommand.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activeCommand.description}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={installedCommandIds.includes(activeCommand.id) ? 'destructive' : 'default'}
                  className="h-8 shrink-0 text-xs font-semibold"
                  onClick={() => (
                    installedCommandIds.includes(activeCommand.id)
                      ? onUninstallCommand(activeCommand.id)
                      : onInstallCommand(activeCommand)
                  )}
                >
                  {installedCommandIds.includes(activeCommand.id) ? 'Uninstall' : 'Install'}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{activeCommand.risk} risk</Badge>
                <Badge variant="outline" className="text-[10px]">{activeCommand.trustLevel}</Badge>
                {activeCommand.permissions.map((permission) => (
                  <Badge key={permission} variant="secondary" className="text-[10px]">{permission}</Badge>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  <Code className="size-3.5" />
                  Source preview
                </span>
                <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-sky-500" onClick={() => void copyCode()}>
                  {copiedCode ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="m-0 min-h-[360px] overflow-auto rounded-lg border border-[#1e293b] bg-[#0b0f19] p-3.5 font-mono text-[13px] leading-relaxed text-[#e2e8f0]">
                <code>{highlightJavaScript(activeCommand.code || '// Source code is not available for this command.')}</code>
              </pre>
              <a href={activeCommand.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-500 hover:underline">
                Source repository
                <ExternalLink className="size-3" />
              </a>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
