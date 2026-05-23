UPDATE commands
SET
  code = 'export default async function run({ title, url, toast }) {
  const link = `[${title}](${url})`;
  await navigator.clipboard.writeText(link);
  toast(''Copied Markdown link: '' + link);
}',
  version = '1.0.1'
WHERE id = 'markdown-link-builder';
