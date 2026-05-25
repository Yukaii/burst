import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { ExternalLink, GitPullRequest, KeyRound, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createRegistryApiToken, deleteRegistryApiToken, listRegistryApiTokens, type RegistryApiToken } from '@/src/lib/registryApi';

interface SettingsPanelProps {
  bridgeConnected: boolean;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export function SettingsPanel({ bridgeConnected, theme, onThemeChange }: SettingsPanelProps) {
  const darkMode = theme === 'dark';
  const [tokens, setTokens] = useState<RegistryApiToken[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState('');

  useEffect(() => {
    void refreshTokens();
  }, []);

  async function refreshTokens() {
    try {
      setTokens(await listRegistryApiTokens());
    } catch {
      setTokens([]);
    }
  }

  async function handleCreateToken() {
    setTokenStatus('Creating token...');
    try {
      const created = await createRegistryApiToken('Extension hosted AI fallback');
      setNewToken(created.token);
      await refreshTokens();
      setTokenStatus('Token created. Copy it now; it will not be shown again.');
    } catch (error) {
      setTokenStatus(error instanceof Error ? error.message : 'Failed to create token.');
    }
  }

  async function handleDeleteToken(tokenId: string) {
    setTokenStatus('Revoking token...');
    try {
      await deleteRegistryApiToken(tokenId);
      await refreshTokens();
      setTokenStatus('Token revoked.');
    } catch (error) {
      setTokenStatus(error instanceof Error ? error.message : 'Failed to revoke token.');
    }
  }
  const handleResetStorage = () => {
    if (confirm('Are you sure you want to clear simulated installation states? This will uninstall all packages from this window.')) {
      window.postMessage({ type: 'burst:uninstall-command', commandId: '*' }, '*');
      localStorage.removeItem('burst.installedRegistryCommands.v1');
      localStorage.removeItem('burst.pinnedRegistryCommands.v1');
      alert('Installation caches cleared.');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-1">
      <div className="flex max-w-3xl flex-col gap-3">
        <div className="grid gap-1 border-b border-border pb-2.5">
          <h2 className="m-0 text-foreground text-[15px] font-semibold leading-normal">Registry Settings</h2>
          <p className="m-0 text-muted-foreground text-xs leading-normal">Configure interface options, developer tools, and view synchronization posture.</p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4">
          <h3 className="m-0 border-b border-border text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none pb-2.5 uppercase">Interface Preferences</h3>
          <div className="flex items-center justify-between gap-4.5 py-2">
            <div className="flex-1">
              <strong className="text-sm font-bold text-slate-900 dark:text-white">Dark Color Scheme</strong>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">Toggle between high-contrast dark mode and premium light theme.</span>
            </div>
            <Switch
              checked={darkMode}
              onCheckedChange={(checked) => onThemeChange(checked ? 'dark' : 'light')}
              aria-label="Toggle dark color scheme"
              className="cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4">
          <h3 className="m-0 border-b border-border text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none pb-2.5 uppercase">Extension Connectivity</h3>
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4.5 py-2 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex-1">
                <strong className="text-sm font-bold text-slate-900 dark:text-white">Burst Bridge Connection</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">
                  {bridgeConnected
                    ? 'The registry received a response from the installed Burst extension.'
                    : 'No extension response has been detected in this browser session.'}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                bridgeConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
              }`}>
                {bridgeConnected ? '✓ Connected' : 'Not detected'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4">
          <h3 className="m-0 border-b border-border text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none pb-2.5 uppercase">Theme Contributions</h3>
          <div className="flex items-start justify-between gap-4.5 py-2">
            <div className="flex-1">
              <strong className="text-sm font-bold text-slate-900 dark:text-white">Command Palette Website Themes</strong>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">
                Theme configs live in <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">src/themes/*.ts</code> and include domain matching through <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">matchHosts</code>.
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button asChild variant="outline" type="button" className="h-9 cursor-pointer gap-2 text-xs font-bold">
                <a href="https://github.com/Yukaii/burst/tree/main/src/themes" target="_blank" rel="noreferrer">
                  <GitPullRequest className="size-3.5" />
                  Theme Files
                </a>
              </Button>
              <Button asChild variant="outline" type="button" className="h-9 cursor-pointer gap-2 text-xs font-bold">
                <a href="https://github.com/Yukaii/burst/blob/main/docs/command-palette-themes.md" target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Guide
                </a>
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            Start from <code className="text-foreground">src/themes/notion.ts</code>, tune spacing and typography variables for the target website, then add the export to <code className="text-foreground">src/lib/paletteThemes.ts</code>.
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4">
          <h3 className="m-0 border-b border-border text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none pb-2.5 uppercase">Extension API Tokens</h3>
          <div className="flex items-start justify-between gap-4.5 py-2">
            <div className="flex-1">
              <strong className="text-sm font-bold text-slate-900 dark:text-white">Hosted AI Fallback Token</strong>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">
                Generate a bearer token for the extension to call this registry app when Chrome built-in AI is unavailable.
              </span>
            </div>
            <Button onClick={() => void handleCreateToken()} type="button" className="h-9 cursor-pointer gap-2 text-xs font-bold">
              <KeyRound className="size-3.5" />
              Generate Token
            </Button>
          </div>

          {newToken ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-300">Copy once</span>
              <code className="block overflow-x-auto rounded bg-background px-2 py-2 text-xs text-foreground">{newToken}</code>
            </div>
          ) : null}

          {tokenStatus ? <p className="m-0 text-xs text-muted-foreground">{tokenStatus}</p> : null}

          <div className="flex flex-col gap-2">
            {tokens.length === 0 ? (
              <span className="text-xs text-muted-foreground">No API tokens created yet.</span>
            ) : tokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <strong className="block truncate text-xs text-foreground">{token.name}</strong>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Created {new Date(token.createdAt).toLocaleDateString()} {token.lastUsedAt ? `· Used ${new Date(token.lastUsedAt).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleDeleteToken(token.id)}
                  type="button"
                  aria-label={`Revoke ${token.name}`}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0 border border-border rounded-lg bg-card p-4">
          <h3 className="m-0 border-b border-border text-muted-foreground text-[10px] font-bold tracking-[0.1em] leading-none pb-2.5 uppercase">Developer & System Actions</h3>
          <div className="flex items-center justify-between gap-4.5 py-2">
            <div className="flex-1">
              <strong className="text-sm font-bold text-slate-900 dark:text-white">Clear Cache States</strong>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">Purge extension installed registry script mapping keys from browser storage.</span>
            </div>
            <Button
              variant="destructive"
              onClick={handleResetStorage}
              type="button"
              className="font-bold text-xs h-9 cursor-pointer border-none"
            >
              Reset Installed Cache
            </Button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
