import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  manifest: ({ browser, manifestVersion }) => ({
    minimum_chrome_version: browser === 'firefox' ? undefined : '120',
    permissions: browser === 'firefox' ? ['storage'] : ['storage', 'userScripts'],
    optional_permissions: browser === 'firefox' ? ['userScripts'] : undefined,
    user_scripts: browser === 'firefox' && manifestVersion === 2 ? { api_script: 'firefox-user-script-api.js' } : undefined,
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
  }),
});
