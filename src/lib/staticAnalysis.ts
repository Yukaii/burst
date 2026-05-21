export type Severity = 'pass' | 'warning' | 'fail';

export type StaticCheck = {
  status: Severity;
  detail: string;
};

export type StaticAnalysisReport = {
  status: Severity;
  checks: {
    hostScope: StaticCheck;
    permissions: StaticCheck;
    remoteCode: StaticCheck;
    networkAccess: StaticCheck;
    obfuscation: StaticCheck;
  };
  summary: string;
};

export function analyzeScriptCode(code: string, matchPatterns: string[] = []): StaticAnalysisReport {
  // 1. Host Scope check
  let hostScopeStatus: Severity = 'pass';
  let hostScopeDetail = 'Restricted to specific match patterns.';
  
  const isBroad = matchPatterns.some((pattern) => {
    const p = pattern.trim().toLowerCase();
    return (
      p === '<all_urls>' ||
      p === '*://*/*' ||
      p === 'http://*/*' ||
      p === 'https://*/*' ||
      p === '*://*' ||
      p === '*'
    );
  });

  if (isBroad) {
    hostScopeStatus = 'warning';
    hostScopeDetail = 'Requests global access to <all_urls> or overly broad hosts. This script can run on any website.';
  } else if (matchPatterns.length > 0) {
    hostScopeDetail = `Restricted to specific patterns: ${matchPatterns.join(', ')}`;
  } else {
    hostScopeDetail = 'No match patterns defined.';
  }

  // Helper to remove comments for scanner accuracy
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove multi-line comments
    .replace(/\/\/.*/g, '');           // remove single-line comments

  // 2. Permissions check
  let permissionsStatus: Severity = 'pass';
  let permissionsDetail = 'No sensitive global API access detected.';

  const hasCookie = /document\.cookie\b|cookie\b/i.test(cleanCode);
  const hasChromeStorage = /chrome\.storage\b/i.test(cleanCode);
  const hasClipboardRead = /readText\b|clipboard\.read\b/i.test(cleanCode);
  const hasWebStorage = /localStorage\b|sessionStorage\b/i.test(cleanCode);
  const hasHistory = /history\.(pushState|replaceState)\b/i.test(cleanCode);
  const hasClipboardWrite = /writeText\b|clipboard\.write\b/i.test(cleanCode);
  const hasCredentials = /password|credential|token|apiKey/i.test(cleanCode);

  if (hasCookie || hasChromeStorage || hasClipboardRead) {
    permissionsStatus = 'fail';
    const flagged = [
      hasCookie && 'document.cookie',
      hasChromeStorage && 'chrome.storage',
      hasClipboardRead && 'clipboard.readText',
    ].filter(Boolean);
    permissionsDetail = `Critical security APIs flagged: ${flagged.join(', ')}. Script can access private user context or credentials.`;
  } else if (hasWebStorage || hasHistory || hasClipboardWrite || hasCredentials) {
    permissionsStatus = 'warning';
    const flagged = [
      hasWebStorage && 'localStorage/sessionStorage',
      hasHistory && 'history pushState',
      hasClipboardWrite && 'clipboard write',
      hasCredentials && 'potential sensitive keywords (password/token)',
    ].filter(Boolean);
    permissionsDetail = `Access to medium-risk indicators detected: ${flagged.join(', ')}. Review data protection posture.`;
  }

  // 3. Remote Code check
  let remoteCodeStatus: Severity = 'pass';
  let remoteCodeDetail = 'No dynamic execution or remote code loading detected.';

  const hasEval = /eval\s*\(/i.test(cleanCode);
  const hasFunctionCtor = /new\s+Function\b|Function\s*\(/i.test(cleanCode);
  const hasDocWrite = /document\.write\s*\(/i.test(cleanCode);
  const hasScriptElem = /createElement\s*\(\s*['"]script['"]\s*\)/i.test(cleanCode);

  if (hasEval || hasFunctionCtor || hasDocWrite || hasScriptElem) {
    remoteCodeStatus = 'fail';
    const flagged = [
      hasEval && 'eval()',
      hasFunctionCtor && 'new Function()',
      hasDocWrite && 'document.write()',
      hasScriptElem && 'createElement(script)',
    ].filter(Boolean);
    remoteCodeDetail = `Dynamic code compilation or execution detected: ${flagged.join(', ')}. This violates safety policies.`;
  }

  // 4. Network Access check
  let networkAccessStatus: Severity = 'pass';
  let networkAccessDetail = 'No outgoing network APIs detected.';

  const hasFetch = /fetch\s*\(/i.test(cleanCode);
  const hasXhr = /XMLHttpRequest\b/i.test(cleanCode);
  const hasWs = /WebSocket\b/i.test(cleanCode);
  const hasBeacon = /sendBeacon\b/i.test(cleanCode);
  const hasEventSource = /EventSource\b/i.test(cleanCode);

  if (hasFetch || hasXhr || hasWs || hasBeacon || hasEventSource) {
    networkAccessStatus = 'warning';
    const flagged = [
      hasFetch && 'fetch()',
      hasXhr && 'XMLHttpRequest',
      hasWs && 'WebSocket',
      hasBeacon && 'sendBeacon()',
      hasEventSource && 'EventSource',
    ].filter(Boolean);
    networkAccessDetail = `Outgoing network request APIs detected: ${flagged.join(', ')}. This script can transmit data to external servers.`;
  }

  // 5. Obfuscation check
  let obfuscationStatus: Severity = 'pass';
  let obfuscationDetail = 'Script is cleanly readable.';

  const lines = code.split('\n');
  const hasLongLine = lines.some((line) => line.length > 500);
  
  // Count hex / unicode escape sequences
  const hexEscapes = (code.match(/\\x[0-9a-fA-F]{2}/g) || []).length;
  const unicodeEscapes = (code.match(/\\u[0-9a-fA-F]{4}/g) || []).length;
  const hasHighEscapes = hexEscapes + unicodeEscapes > 5;

  const hasDynamicGlobals = /window\s*\[\s*['"`]/i.test(cleanCode);

  if (hasLongLine || hasHighEscapes || hasDynamicGlobals) {
    obfuscationStatus = 'warning';
    const flagged = [
      hasLongLine && 'extremely long lines (> 500 chars)',
      hasHighEscapes && `high density of escape sequences (hex: ${hexEscapes}, unicode: ${unicodeEscapes})`,
      hasDynamicGlobals && 'dynamic window properties lookups',
    ].filter(Boolean);
    obfuscationDetail = `Potential obfuscation or minification detected: ${flagged.join(', ')}. Recommended review of original source.`;
  }

  // Overall status resolution: worst status of all checks
  const statuses = [
    hostScopeStatus,
    permissionsStatus,
    remoteCodeStatus,
    networkAccessStatus,
    obfuscationStatus,
  ];

  let overallStatus: Severity = 'pass';
  if (statuses.includes('fail')) {
    overallStatus = 'fail';
  } else if (statuses.includes('warning')) {
    overallStatus = 'warning';
  }

  // Summary generation
  let summary = 'This script passes all static security audit checks.';
  if (overallStatus === 'fail') {
    summary = 'Critical security failures detected. This script is unsafe to run.';
  } else if (overallStatus === 'warning') {
    const warningsCount = statuses.filter((s) => s === 'warning').length;
    summary = `Static audit flags ${warningsCount} warning(s). Review declarations before running.`;
  }

  return {
    status: overallStatus,
    checks: {
      hostScope: { status: hostScopeStatus, detail: hostScopeDetail },
      permissions: { status: permissionsStatus, detail: permissionsDetail },
      remoteCode: { status: remoteCodeStatus, detail: remoteCodeDetail },
      networkAccess: { status: networkAccessStatus, detail: networkAccessDetail },
      obfuscation: { status: obfuscationStatus, detail: obfuscationDetail },
    },
    summary,
  };
}
