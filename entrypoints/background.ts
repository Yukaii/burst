export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isManagementMessage(message)) return;

    const path = message.action === 'create-local-script'
      ? '/dashboard.html?mode=new'
      : '/dashboard.html';

    void browser.tabs.create({ url: browser.runtime.getURL(path) });
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-palette') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    await browser.tabs.sendMessage(tab.id, { type: 'burst:toggle-palette' }).catch(() => {
      // Some browser pages cannot receive content-script messages.
    });
  });
});

function isManagementMessage(
  message: unknown,
): message is { type: 'burst:run-management-command'; action: 'open-dashboard' | 'open-installed' | 'create-local-script' } {
  return typeof message === 'object'
    && message !== null
    && 'type' in message
    && message.type === 'burst:run-management-command'
    && 'action' in message
    && ['open-dashboard', 'open-installed', 'create-local-script'].includes(String(message.action));
}
