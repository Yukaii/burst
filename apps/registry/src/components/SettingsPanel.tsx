import { useState } from 'react';
import { Button } from './ui/button';

interface SettingsPanelProps {
  bridgeConnected: boolean;
}

export function SettingsPanel({ bridgeConnected }: SettingsPanelProps) {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('burst-theme');
    return savedTheme === 'dark' || (savedTheme !== 'light' && document.querySelector('.registry-app-shell')?.classList.contains('dark'));
  });

  const toggleTheme = () => {
    const nextTheme = !darkMode ? 'dark' : 'light';
    setDarkMode(!darkMode);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('burst-theme', nextTheme);
    document.querySelector('.registry-app-shell')?.classList.toggle('dark', nextTheme === 'dark');
  };

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
    <div className="flex min-h-0 flex-1 flex-col gap-3 max-w-3xl">
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
            <Button
              variant="outline"
              onClick={toggleTheme}
              type="button"
              className="font-bold text-xs h-9 cursor-pointer select-none"
            >
              {darkMode ? 'Use light mode' : 'Use dark mode'}
            </Button>
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
  );
}
