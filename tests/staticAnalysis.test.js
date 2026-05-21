import { describe, expect, test } from 'bun:test';
import { analyzeScriptCode } from '../src/lib/staticAnalysis.ts';

describe('static analysis engine', () => {
  test('detects pass posture for a clean script', () => {
    const code = `
      export default async function run({ page, selection, toast }) {
        const title = page.title;
        toast("Hello: " + selection);
      }
    `;
    const report = analyzeScriptCode(code, ['example.com/*']);
    expect(report.status).toBe('pass');
    expect(report.checks.hostScope.status).toBe('pass');
    expect(report.checks.permissions.status).toBe('pass');
    expect(report.checks.remoteCode.status).toBe('pass');
    expect(report.checks.networkAccess.status).toBe('pass');
    expect(report.checks.obfuscation.status).toBe('pass');
  });

  test('detects warning for broad match patterns', () => {
    const code = `
      export default async function run({ toast }) {
        toast("Running");
      }
    `;
    const report = analyzeScriptCode(code, ['<all_urls>']);
    expect(report.status).toBe('warning');
    expect(report.checks.hostScope.status).toBe('warning');
  });

  test('detects warning for clipboard write or localStorage access', () => {
    const code = `
      export default async function run({ page }) {
        localStorage.setItem('visited', 'true');
        await navigator.clipboard.writeText('Copied!');
      }
    `;
    const report = analyzeScriptCode(code, ['github.com/*']);
    expect(report.status).toBe('warning');
    expect(report.checks.permissions.status).toBe('warning');
    expect(report.checks.permissions.detail).toContain('localStorage/sessionStorage');
    expect(report.checks.permissions.detail).toContain('clipboard write');
  });

  test('detects fail for cookies, chrome storage, or clipboard read', () => {
    const code1 = `const key = document.cookie;`;
    const report1 = analyzeScriptCode(code1, []);
    expect(report1.status).toBe('fail');
    expect(report1.checks.permissions.status).toBe('fail');

    const code2 = `chrome.storage.local.get('x');`;
    const report2 = analyzeScriptCode(code2, []);
    expect(report2.status).toBe('fail');
    expect(report2.checks.permissions.status).toBe('fail');

    const code3 = `await navigator.clipboard.readText();`;
    const report3 = analyzeScriptCode(code3, []);
    expect(report3.status).toBe('fail');
    expect(report3.checks.permissions.status).toBe('fail');
  });

  test('detects fail for eval, new Function, document.write, script insertion', () => {
    const code1 = `eval("console.log(1)");`;
    const report1 = analyzeScriptCode(code1, []);
    expect(report1.status).toBe('fail');
    expect(report1.checks.remoteCode.status).toBe('fail');

    const code2 = `new Function("return 1")();`;
    const report2 = analyzeScriptCode(code2, []);
    expect(report2.status).toBe('fail');
    expect(report2.checks.remoteCode.status).toBe('fail');

    const code3 = `document.write("<h1>Hello</h1>");`;
    const report3 = analyzeScriptCode(code3, []);
    expect(report3.status).toBe('fail');
    expect(report3.checks.remoteCode.status).toBe('fail');

    const code4 = `document.createElement("script");`;
    const report4 = analyzeScriptCode(code4, []);
    expect(report4.status).toBe('fail');
    expect(report4.checks.remoteCode.status).toBe('fail');
  });

  test('detects warning for outgoing network requests', () => {
    const code = `
      await fetch('https://api.example.com/data');
    `;
    const report = analyzeScriptCode(code, []);
    expect(report.status).toBe('warning');
    expect(report.checks.networkAccess.status).toBe('warning');
  });

  test('detects warning for obfuscation signals', () => {
    const code = `
      // Obfuscated helper
      const _0x1a2b = ["\\x54\\x61\\x69\\x6c\\x77\\x69\\x6e\\x64", "\\x65\\x78\\x70\\x6f\\x72\x74"];
    `;
    const report = analyzeScriptCode(code, []);
    expect(report.status).toBe('warning');
    expect(report.checks.obfuscation.status).toBe('warning');
  });
});
