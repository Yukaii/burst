import React from 'react';
import ReactDOM from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { BurstPalette } from '@/src/ui/BurstPalette';
import '@/src/ui/BurstPalette.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'burst-command-palette',
      position: 'inline',
      anchor: 'body',
      isolateEvents: true,
      onMount(container) {
        const app = document.createElement('div');
        container.append(app);

        const root = ReactDOM.createRoot(app);
        root.render(<BurstPalette pageUrl={window.location.href} pageTitle={document.title} />);

        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();

    // Bidirectional postMessage event bridge between page and background extension.
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || !('type' in data)) return;

      const type = String(data.type);
      if (!type.startsWith('burst:')) return;
      if (isBridgeResponseType(type)) return;

      const bridgeClientId = typeof data.bridgeClientId === 'string' ? data.bridgeClientId : undefined;
      const bridgeRequestId = typeof data.bridgeRequestId === 'string' ? data.bridgeRequestId : undefined;
      const bridgeMeta = { bridgeClientId, bridgeRequestId };

      if (type === 'burst:bridge-ping') {
        window.postMessage({
          type: 'burst:bridge-ready',
          extensionId: browser.runtime.id,
          bridgeSender: 'burst-extension',
          ...bridgeMeta,
        }, '*');
        return;
      }

      if (type === 'burst:get-installed-commands') {
        browser.runtime.sendMessage({ type })
          .then((response) => {
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:get-local-scripts') {
        browser.runtime.sendMessage({ type })
          .then((response) => {
            window.postMessage({ type: 'burst:local-scripts-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:install-command') {
        const { command } = data as { command: any };
        browser.runtime.sendMessage({ type, command })
          .then((response) => {
            window.postMessage({ type: 'burst:install-success', commandId: command.id, ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:install-command-pack') {
        const { pack } = data as { pack: any };
        browser.runtime.sendMessage({ type, pack })
          .then((response) => {
            window.postMessage({ type: 'burst:install-pack-success', packId: pack.id, ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:uninstall-command') {
        const { commandId } = data as { commandId: string };
        browser.runtime.sendMessage({ type, commandId })
          .then((response) => {
            window.postMessage({ type: 'burst:uninstall-success', commandId, ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:uninstall-command-pack') {
        const { packId } = data as { packId: string };
        browser.runtime.sendMessage({ type, packId })
          .then((response) => {
            window.postMessage({ type: 'burst:uninstall-pack-success', packId, ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:pin-command') {
        const { commandId } = data as { commandId: string };
        browser.runtime.sendMessage({ type, commandId })
          .then((response) => {
            window.postMessage({ type: 'burst:pin-success', commandId, ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      } else if (type === 'burst:unpin-command') {
        const { commandId } = data as { commandId: string };
        browser.runtime.sendMessage({ type, commandId })
          .then((response) => {
            window.postMessage({ type: 'burst:unpin-success', commandId, ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
            window.postMessage({ type: 'burst:installed-commands-response', ...response, bridgeSender: 'burst-extension', ...bridgeMeta }, '*');
          })
          .catch((err) => postBridgeError(type, err, bridgeMeta));
      }
    });
  },
});

function isBridgeResponseType(type: string) {
  return [
    'burst:bridge-ready',
    'burst:bridge-error',
    'burst:installed-commands-response',
    'burst:local-scripts-response',
    'burst:install-success',
    'burst:install-pack-success',
    'burst:uninstall-success',
    'burst:uninstall-pack-success',
    'burst:pin-success',
    'burst:unpin-success',
  ].includes(type);
}

function postBridgeError(
  requestType: string,
  err: unknown,
  bridgeMeta: { bridgeClientId?: string; bridgeRequestId?: string },
) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[Burst] ${requestType} message failed`, err);
  window.postMessage({
    type: 'burst:bridge-error',
    requestType,
    message,
    bridgeSender: 'burst-extension',
    ...bridgeMeta,
  }, '*');
}
