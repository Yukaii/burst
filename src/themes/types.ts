export type CommandPaletteThemeId =
  | 'auto'
  | 'burst-dark'
  | 'burst-light'
  | 'github'
  | 'linear'
  | 'notion';

export type CommandPaletteTheme = {
  id: Exclude<CommandPaletteThemeId, 'auto'>;
  name: string;
  description: string;
  appearance: 'dark' | 'light';
  matchHosts?: string[];
  previewUrl: string;
  variables: Record<string, string>;
};

export type CommandPaletteThemeMeta = Omit<CommandPaletteTheme, 'variables'> & {
  modulePath: string;
};
