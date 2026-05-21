import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  manifest: {
    minimum_chrome_version: '120',
    permissions: ['storage', 'userScripts'],
    host_permissions: ['<all_urls>'],
    commands: {
      'toggle-palette': {
        suggested_key: {
          default: 'Ctrl+Shift+K',
          mac: 'Command+Shift+K',
        },
        description: 'Open Burst command palette',
      },
    },
  },
});
