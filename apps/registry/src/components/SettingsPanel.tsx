import { useState } from 'react';
import { Button } from './ui/button';

export function SettingsPanel() {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('burst-theme') === 'dark';
  });
  const [autoUpdate, setAutoUpdate] = useState(true);

  const toggleTheme = () => {
    const nextTheme = !darkMode ? 'dark' : 'light';
    setDarkMode(!darkMode);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('burst-theme', nextTheme);
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
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/60 pb-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Registry Settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Configure interface options, developer tools, and view synchronization posture.</p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800/60 pb-2">Interface Preferences</h3>
          <div className="flex items-center justify-between gap-6 py-2">
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
              {darkMode ? 'Dark Mode On' : 'Light Mode On'}
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800/60 pb-2">Extension Connectivity</h3>
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-6 py-4 border-b border-slate-100 dark:border-slate-800/60">
              <div className="flex-1">
                <strong className="text-sm font-bold text-slate-900 dark:text-white">Burst Bridge Connection</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">Shows current handshake state with the local browser extension context.</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ✓ Connected
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 pt-4">
              <div className="flex-1">
                <strong className="text-sm font-bold text-slate-900 dark:text-white">Background Live Update Sync</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">Automatically propagate newly installed commands directly into extension memory.</span>
              </div>
              <Button
                variant={autoUpdate ? 'default' : 'outline'}
                onClick={() => setAutoUpdate(!autoUpdate)}
                type="button"
                className="font-bold text-xs h-9 cursor-pointer select-none"
              >
                {autoUpdate ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800/60 pb-2">Developer & System Actions</h3>
          <div className="flex items-center justify-between gap-6 py-2">
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
