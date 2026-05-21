# API Guide

This guide captures the current intended contracts. Treat this as a working draft rather than a stable public API.

## Command Manifest

Registry commands should publish a `burst.command.json` manifest shaped like:

```json
{
  "schemaVersion": 1,
  "id": "example-command",
  "title": "Example command",
  "description": "A narrow website action with declared source and permissions.",
  "website": "github.com",
  "matchPatterns": ["github.com/*"],
  "publisher": {
    "name": "Example Publisher",
    "handle": "@example",
    "avatarInitials": "EX"
  },
  "icon": {
    "type": "favicon",
    "host": "github.com"
  },
  "permissions": ["Read page DOM", "Read selected text"],
  "source": {
    "type": "git",
    "url": "https://github.com/example/example-command"
  },
  "runtime": {
    "entrypoint": "src/index.ts",
    "capabilities": ["page-dom", "selection", "toast"]
  },
  "risk": "medium",
  "version": "0.1.0"
}
```

The first validator lives in `src/lib/manifest.ts`. It checks required metadata, publisher identity shape, icon shape, HTTPS source URL, safe relative runtime entrypoint, runtime capabilities, semantic version format, and declared risk. Archive packages must include `source.integrity` in `sha256-<base64>` form. Sample manifests are validated in the registry website but are not shown as marketplace rows yet.

## Iconography

Every command should define an `icon`. The extension should prefer small, recognizable command icons without adding heavy UI.

Supported icon types:

- `favicon`: Use the matched website favicon. Optional `host` overrides `website`.
- `initials`: Render a short text mark, usually 1-3 characters.
- `emoji`: Render a symbolic local action mark.
- `url`: Render an externally hosted image URL.
- `asset`: Render an extension-packaged or command-package asset path.

Recommended defaults:

- Website-specific commands should use `favicon`.
- Registry or publisher-neutral commands can use `initials`.
- Local management commands can use `emoji` or `initials`.
- User-created local scripts should let the user choose initials first; custom uploaded assets can come later.

The current dashboard uses a small dropdown with preview for local script icons. That keeps editor layout stable and avoids freeform icon parsing until packaged assets exist.

## Management Commands

Burst reserves local commands for extension management:

- `Install script from registry`
- `Manage installed scripts`
- `Create local script`
- `List installed scripts`

These commands are available on every page and route to the extension dashboard. They do not execute webpage scripts directly.

## Local Script Draft

Local scripts are stored in extension local storage with this shape:

```ts
type LocalScript = {
  id: string;
  name: string;
  matchPattern: string;
  icon: CommandIcon;
  status: 'enabled' | 'disabled' | 'draft';
  updatedAt: string;
  code: string;
};
```

Enabled local scripts are registered with Chrome's `userScripts` API. After saving or enabling a script, matching already-open pages may need a reload before the registered listener is present.

Local script backups use a versioned JSON envelope:

```ts
type LocalScriptBackup = {
  version: 1;
  exportedAt: string;
  scripts: LocalScript[];
};
```

Importing a backup validates each script record and replaces the current local script list after user confirmation.

## Sandboxed Runtime API

Local and registry scripts execute inside a sandbox-isolated context. Lexical variable references to page globals (`document`, `window`, `navigator`, `location`) are shadowed via parameter-bound IIFE arguments and redirected to capability-gated proxy wrappers.

### Sandboxed Context Type

```ts
type SandboxedRuntimeContext = {
  page: SandboxedPage;
  window: SandboxedWindow;
  location: SandboxedLocation;
  navigator: SandboxedNavigator;
  selection: string;
  clipboard: SandboxedClipboard;
  url: string;
  title: string;
  toast: (message: string) => void;
};
```

### Capability Specifications

1. **`page-dom` Capability**:
   - Required to read the DOM or retrieve page location info.
   - Enables `page`, `location`, `url`, and `title` variables.
   - Methods:
     - `page.querySelector(selector)`: returns a sandboxed read-only element proxy, or `null`.
     - `page.querySelectorAll(selector)`: returns an array of sandboxed read-only element proxies.
     - `page.title`: returns the document title.
   - Sandboxed element proxies support:
     - `textContent` (read-only)
     - `innerText` (read-only)
     - `value` (read-only)
     - `getAttribute(name)`
     - `hasAttribute(name)`
     - `querySelector(selector)`
     - `querySelectorAll(selector)`

2. **`clipboard-write` Capability**:
   - Required to write text to the user's clipboard.
   - Methods:
     - `clipboard.writeText(text)` (returns a Promise)
     - Can also be accessed via shadowed `navigator.clipboard.writeText(text)`.

3. **`selection` Capability**:
   - Required to access user selected text.
   - Provides access to:
     - `context.selection` string.
     - `window.getSelection().toString()` which returns the pre-captured selection (avoiding focus resets).

4. **`toast` Capability**:
   - Required to trigger command feedback toasts.
   - Methods:
     - `toast(message)`: displays an auto-dismissing toast notification on the page.

### Example Sandboxed Script

```ts
export default async function run({ page, navigator, toast }) {
  // Accessing the DOM (requires 'page-dom' capability)
  const branchEl = page.querySelector('[data-icv-name="Switch branches/tags"]');
  const branch = branchEl?.textContent?.trim();

  // Writing to clipboard (requires 'clipboard-write' capability)
  await navigator.clipboard.writeText(branch ?? 'main');

  // Triggering feedback toast (requires 'toast' capability)
  toast(branch ? `Copied branch: ${branch}` : 'Copied default branch');
}
```

## Runtime Direction

- Run only after explicit install and user consent.
- Separate registry discovery from local execution.
- Expose narrow APIs for page DOM reads, selected text, clipboard writes, toast notifications, captures, and connector calls.
- Show permissions, source, publisher identity, and audit state before install.
