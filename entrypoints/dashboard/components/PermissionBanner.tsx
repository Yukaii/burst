import React from 'react';

function isChromeLikeBrowser() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent;
  return /\b(Chrome|Chromium|Edg|OPR|Brave)\b/i.test(userAgent) && !/Firefox/i.test(userAgent);
}

export function PermissionBanner() {
  async function handleEnableUserScripts() {
    if (typeof browser === 'undefined') return;

    if (!isChromeLikeBrowser()) {
      try {
        const granted = await browser.permissions?.request?.({ permissions: ['userScripts'] });
        if (granted) {
          await browser.runtime.sendMessage({ type: 'burst:sync-local-scripts' }).catch(() => undefined);
          window.location.reload();
          return;
        }
      } catch {
        // Chrome exposes userScripts through extension details instead of permissions.request().
      }
    }

    if (browser.tabs?.create) {
      void browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
    }
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/25 px-6 py-4 flex gap-4 shrink-0 items-start select-none">
      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-500">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label="Warning">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-amber-500 tracking-tight">
          Action Required: Enable User Scripts Permission
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          To run local scripts and execute automations on your web pages, your browser requires the User Scripts permission to be active.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-amber-500/10">
          <div>
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Firefox</h4>
            <ol className="list-decimal pl-4 mt-1.5 space-y-1 text-xs text-muted-foreground">
              <li>Click the button on the right.</li>
              <li>Approve the <strong>User Scripts</strong> permission prompt.</li>
            </ol>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Chrome / Chromium</h4>
            <ol className="list-decimal pl-4 mt-1.5 space-y-1 text-xs text-muted-foreground">
              <li>Open Burst in <strong>chrome://extensions</strong>.</li>
              <li>Manually switch <strong>&quot;Allow user scripts&quot;</strong> to <strong>ON</strong>.</li>
            </ol>
          </div>
        </div>
      </div>
      <div className="shrink-0 flex flex-col gap-2 self-center">
        <button
          onClick={() => void handleEnableUserScripts()}
          type="button"
          className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-amber-500 text-black shadow hover:bg-amber-400 cursor-pointer transition-colors"
        >
          {isChromeLikeBrowser() ? 'Open Extension Page' : 'Enable User Scripts'}
        </button>
        <div className="text-[10px] text-center text-muted-foreground font-medium italic">
          Return after enabling
        </div>
      </div>
    </div>
  );
}
