# Command Palette Themes

Burst command palette themes live in `src/themes`.

To contribute a website-specific look:

1. Add a theme file, for example `src/themes/notion.ts`.
2. Export a `CommandPaletteTheme` with `matchHosts` for domain matching.
3. Tune spacing, typography, radius, density, and colors through CSS variables.
4. Register lightweight metadata and a lazy loader in `src/lib/paletteThemes.ts`.

Example:

```ts
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
    '--burst-shell-radius': '10px',
    '--burst-command-min-height': '48px',
    '--burst-command-title-weight': '500',
    '--burst-active-bg': 'linear-gradient(180deg, #37352f, #2f2d29)',
  },
};
```

The central registry should expose `id`, `name`, `description`, `matchHosts`, `previewUrl`, `modulePath`, `exportName`, and a dynamic `load` function:

```ts
{
  id: 'notion',
  name: 'Notion',
  description: 'Paper-like palette for notion.so.',
  matchHosts: ['notion.so', '*.notion.so'],
  previewUrl: 'https://notion.so',
  modulePath: 'src/themes/notion.ts',
  exportName: 'notionTheme',
  load: () => import('@/src/themes/notion'),
}
```

Only registry metadata is loaded up front for matching and previews. The full theme variables are loaded on demand when the user selects a theme or opens the command palette on a matching site.

Open a pull request at `https://github.com/Yukaii/burst` with the new theme file and registry entry.
