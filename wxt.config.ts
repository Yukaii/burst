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

  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
    sourcesTemplate: '{{name}}-{{version}}-sources.zip',
    includeSources: [
      'README.md',
      'SOURCE_CODE_REVIEW.md',
      'package.json',
      'bun.lock',
      'tsconfig.json',
      'wxt.config.ts',
      'postcss.config.mjs',
      'src/**',
      'entrypoints/**',
      'public/**',
      'assets/**',
      'apps/registry/package.json',
      'apps/registry/tsconfig.json',
      'apps/registry/vite.config.ts',
      'apps/registry/tailwind.config.ts',
      'apps/registry/wrangler.toml',
      'apps/registry/components.json',
      'apps/registry/index.html',
      'apps/registry/dev.ts',
      'apps/registry/server.ts',
      'apps/registry/worker.ts',
      'apps/registry/migrations/**',
      'apps/registry/src/**',
      'tests/**',
    ],
    excludeSources: [
      'apps/*/dist/**',
      'docs/.vitepress/**',
      '.output/**',
      '.wxt/**',
      'node_modules/**',
      '.env',
      '.env.*',
    ],
  },
});
