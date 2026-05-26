# API Guide

Burst commands turn website features into command palette actions. A command declares where it runs, what it needs, where the source lives, and which runtime capabilities it can use. Users can then discover the command on matching websites, inspect it before installing, fork it into a live local script, or publish a customized version back to a registry.

This guide captures the current intended contracts. Treat this as a working draft rather than a stable public API.

## Authoring Model

Every command has three pieces:

1. A `burst.command.json` manifest that describes identity, website matching, publisher metadata, source, permissions, runtime entrypoint, risk, and version.
2. A script entrypoint that receives a sandboxed runtime context instead of raw page globals.
3. A review path through the registry or local dashboard so users can inspect, install, fork, customize, and update the command.

Burst is designed for narrow website actions rather than broad extensions. Good commands should be easy to read, declare only the capabilities they need, and do one workflow well.

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
- `lucide`: Render a named Lucide icon from the extension icon set.
- `url`: Render an externally hosted image URL.
- `asset`: Render an extension-packaged or command-package asset path.

Recommended defaults:

- Website-specific commands should use `favicon`.
- If `favicon.host` is omitted, Burst will try to infer the host from the command's `matchPatterns` before falling back to `website`.
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
  matchPatterns: string[];
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
  toast: (message: string | ToastOptions, options?: ToastOptions) => void;
  list: (definition: ListDefinition) => void;
};

type ToastOptions = {
  message?: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  animation?: 'slide' | 'fade' | 'pop' | 'none';
  duration?: number | false;
  dismissible?: boolean;
  showProgress?: boolean;
};

type ListDefinition = {
  id?: string;
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  emptyState?: string;
  items: ListItem[];
};

type ListItem = {
  id?: string;
  title: string;
  subtitle?: string;
  accessories?: string[];
  keywords?: string[];
  icon?: CommandIcon;
  actions?: ListAction[];
};

type ListAction = {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: CommandIcon;
  style?: 'default' | 'destructive';
  onAction?: (item: ListItem) => void | Promise<void>;
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
     - `toast(message, options)`: customizes the toast variant, position, animation, duration, and controls.
     - `toast({ message, title, ...options })`: object form for richer command feedback.
   - Options:
     - `variant`: `default`, `info`, `success`, `warning`, or `error`.
     - `position`: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, or `bottom-right`.
     - `animation`: `slide`, `fade`, `pop`, or `none`.
     - `duration`: milliseconds before auto-dismiss; use `false` or `0` for persistent.
     - `dismissible`: shows or hides the close button.
     - `showProgress`: shows or hides the timeout progress bar.

5. **`list` Capability**:
   - Required to show a command-owned result list in the palette.
   - Methods:
     - `list(definition)`: replaces the command results with a searchable custom list.
   - List items support title, subtitle, icon, accessories, keywords, and actions.
   - Pressing Enter on a list item runs the first action in `actions`.
   - Action callbacks stay inside the sandboxed command listener; the palette only sends `listId`, `itemId`, and `actionId` back to the command runtime.

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

### Example Custom List

```ts
export default async function run({ page, clipboard, toast, list }) {
  const links = page.querySelectorAll('a')
    .slice(0, 20)
    .map((link, index) => {
      const label = link.innerText?.trim() || link.getAttribute('href') || 'Untitled link';
      const href = link.getAttribute('href') || '';

      return {
        id: String(index),
        title: label,
        subtitle: href,
        accessories: [href],
        keywords: [href],
        actions: [
          {
            id: 'copy-url',
            title: 'Copy URL',
            async onAction() {
              await clipboard.writeText(href);
              toast({ title: 'Copied', message: label, variant: 'success' });
            },
          },
        ],
      };
    });

  list({
    id: 'page-links',
    title: 'Page links',
    searchPlaceholder: 'Search links',
    emptyState: 'No links found.',
    items: links,
  });
}
```

## Runtime Direction

- Run only after explicit install and user consent.
- Separate registry discovery from local execution.
- Expose narrow APIs for page DOM reads, selected text, clipboard writes, toast notifications, custom lists, captures, and connector calls.
- Show permissions, source, publisher identity, and audit state before install.
