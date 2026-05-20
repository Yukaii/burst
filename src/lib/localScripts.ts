export type LocalScriptStatus = 'enabled' | 'disabled' | 'draft';

export type LocalScript = {
  id: string;
  name: string;
  matchPattern: string;
  icon: string;
  status: LocalScriptStatus;
  updatedAt: string;
  code: string;
};

export const seedLocalScripts: LocalScript[] = [
  {
    id: 'local-github-copy-branch',
    name: 'Copy GitHub branch name',
    matchPattern: 'github.com/*',
    icon: 'GH',
    status: 'enabled',
    updatedAt: '2026-05-20',
    code: `export default async function run({ page }) {
  const branch = page.querySelector('[data-hotkey="w"]')?.textContent?.trim();
  await navigator.clipboard.writeText(branch ?? location.href);
}`,
  },
  {
    id: 'local-highlight-capture',
    name: 'Capture selection',
    matchPattern: '<all_urls>',
    icon: 'CS',
    status: 'draft',
    updatedAt: '2026-05-20',
    code: `export default async function run() {
  const selection = window.getSelection()?.toString() ?? '';
  console.log({ selection, url: location.href });
}`,
  },
];
