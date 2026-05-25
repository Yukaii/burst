import type { CommandPaletteTheme } from './types';
import { baseLightVariables } from './base';

export const githubTheme: CommandPaletteTheme = {
  id: 'github',
  name: 'GitHub',
  description: 'Neutral, compact palette for github.com.',
  appearance: 'light',
  matchHosts: ['github.com', '*.github.com'],
  previewUrl: 'https://github.com',
  variables: {
    ...baseLightVariables,
    '--burst-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    '--burst-shell-radius': '12px',
    '--burst-search-padding': '12px 14px 10px',
    '--burst-command-min-height': '48px',
    '--burst-command-radius': '6px',
    '--burst-command-title-size': '13px',
    '--burst-command-subtitle-size': '12px',
    '--burst-icon-size': '30px',
    '--burst-icon-radius': '6px',
    '--burst-overlay-bg': 'rgba(31, 35, 40, 0.24)',
    '--burst-shell-bg': 'rgba(246, 248, 250, 0.94)',
    '--burst-active-bg': 'linear-gradient(180deg, #0969da, #0757b8)',
    '--burst-active-border': 'rgba(9, 105, 218, 0.25)',
    '--burst-icon-text': '#0969da',
    '--burst-status-text': '#0969da',
  },
};
