import { dracula, nord, atomone, vscodeDark, githubLight, githubDark } from '@uiw/codemirror-themes-all';
import type { CommandIcon } from '@/src/lib/commands';

export const iconOptions: Array<{ icon: CommandIcon; label: string; hint: string }> = [
  { icon: { type: 'lucide', name: 'Code' }, label: 'Code', hint: 'Lucide Code icon' },
  { icon: { type: 'lucide', name: 'Terminal' }, label: 'Terminal', hint: 'Lucide Terminal icon' },
  { icon: { type: 'lucide', name: 'Database' }, label: 'Database', hint: 'Lucide Database icon' },
  { icon: { type: 'lucide', name: 'Shield' }, label: 'Shield', hint: 'Lucide Shield icon' },
  { icon: { type: 'lucide', name: 'Folder' }, label: 'Folder', hint: 'Lucide Folder icon' },
  { icon: { type: 'lucide', name: 'Play' }, label: 'Play', hint: 'Lucide Play icon' },
  { icon: { type: 'lucide', name: 'Globe' }, label: 'Globe', hint: 'Lucide Globe icon' },
  { icon: { type: 'lucide', name: 'Sparkles' }, label: 'Sparkles', hint: 'Lucide Sparkles icon' },
  { icon: { type: 'lucide', name: 'Activity' }, label: 'Activity', hint: 'Lucide Activity icon' },
  { icon: { type: 'lucide', name: 'FileText' }, label: 'FileText', hint: 'Lucide FileText icon' },
  { icon: { type: 'lucide', name: 'WandSparkles' }, label: 'Magic', hint: 'Lucide WandSparkles icon' },
  { icon: { type: 'favicon' }, label: 'Favicon', hint: 'Infer from match patterns' },
  { icon: { type: 'favicon', host: 'github.com' }, label: 'GitHub', hint: 'github.com favicon' },
  { icon: { type: 'emoji', value: '🔗' }, label: 'Link', hint: 'Link emoji' },
  { icon: { type: 'emoji', value: '✨' }, label: 'Sparkle', hint: 'Sparkle emoji' },
  { icon: { type: 'initials', value: 'JS' }, label: 'Script', hint: 'JS initials' },
];

export const fontFamilyOptions = [
  { value: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', label: 'Monospace' },
  { value: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace', label: 'JetBrains' },
  { value: '"Fira Code", "SFMono-Regular", Consolas, monospace', label: 'Fira Code' },
  { value: 'ui-monospace, "SFMono-Regular", Consolas, monospace', label: 'System Mono' },
];

export const fontSizeOptions = [12, 13, 14, 15, 16, 18];

export const themesMap: Record<string, object> = {
  dracula,
  nord,
  atomone,
  vscodeDark,
  githubLight,
  githubDark,
};

export const editorThemeOptions = [
  { value: 'default', label: 'Default Theme' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' },
  { value: 'atomone', label: 'One Dark' },
  { value: 'vscodeDark', label: 'VS Code Dark' },
  { value: 'githubLight', label: 'GitHub Light' },
  { value: 'githubDark', label: 'GitHub Dark' },
];

export const editorKeymapOptions = [
  { value: 'default', label: 'Default (Standard)' },
  { value: 'vim', label: 'Vim' },
  { value: 'emacs', label: 'Emacs' },
];
