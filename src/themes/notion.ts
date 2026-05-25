import type { CommandPaletteTheme } from './types';
import { baseLightVariables } from './base';

export const notionTheme: CommandPaletteTheme = {
  id: 'notion',
  name: 'Notion',
  description: 'Paper-like palette for notion.so.',
  matchHosts: ['notion.so', '*.notion.so'],
  previewUrl: 'https://notion.so',
  variables: {
    ...baseLightVariables,
    '--burst-font-family': 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
    '--burst-shell-width': 'min(620px, calc(100vw - 32px))',
    '--burst-shell-radius': '10px',
    '--burst-shell-blur': 'blur(18px) saturate(140%)',
    '--burst-search-padding': '13px 14px 11px',
    '--burst-input-size': '18px',
    '--burst-input-weight': '500',
    '--burst-command-min-height': '48px',
    '--burst-command-padding': '7px 10px',
    '--burst-command-radius': '5px',
    '--burst-command-title-size': '14px',
    '--burst-command-title-weight': '500',
    '--burst-icon-size': '30px',
    '--burst-icon-radius': '5px',
    '--burst-overlay-bg': 'rgba(55, 53, 47, 0.16)',
    '--burst-shell-bg': 'rgba(255, 255, 255, 0.96)',
    '--burst-shell-border': 'rgba(55, 53, 47, 0.12)',
    '--burst-active-bg': 'linear-gradient(180deg, #37352f, #2f2d29)',
    '--burst-active-border': 'rgba(55, 53, 47, 0.18)',
    '--burst-icon-text': '#a16207',
  },
};
