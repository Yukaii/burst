import type { CommandPaletteTheme } from './types';
import { baseDarkVariables } from './base';

export const linearTheme: CommandPaletteTheme = {
  id: 'linear',
  name: 'Linear',
  description: 'Dense graphite palette for linear.app.',
  matchHosts: ['linear.app', '*.linear.app'],
  previewUrl: 'https://linear.app',
  variables: {
    ...baseDarkVariables,
    '--burst-font-family': 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    '--burst-shell-width': 'min(600px, calc(100vw - 32px))',
    '--burst-shell-radius': '14px',
    '--burst-search-padding': '13px 14px 10px',
    '--burst-input-size': '18px',
    '--burst-command-min-height': '46px',
    '--burst-command-padding': '7px 10px',
    '--burst-command-radius': '7px',
    '--burst-command-title-size': '13px',
    '--burst-icon-size': '30px',
    '--burst-icon-radius': '6px',
    '--burst-overlay-bg': 'rgba(8, 8, 11, 0.46)',
    '--burst-shell-bg': 'rgba(24, 24, 29, 0.9)',
    '--burst-active-bg': 'linear-gradient(180deg, #8b5cf6, #6d5dfc)',
    '--burst-active-border': 'rgba(139, 92, 246, 0.28)',
    '--burst-icon-text': '#a78bfa',
    '--burst-status-text': '#ddd6fe',
  },
};
