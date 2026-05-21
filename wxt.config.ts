import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),

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
