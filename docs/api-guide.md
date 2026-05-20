# API Guide

This guide captures the current intended contracts. The implementation still uses seed data, so treat this as the product/API direction rather than a stable public API.

## Command Manifest

Registry and local commands should converge on a manifest shaped like:

```json
{
  "id": "github-pr-summary",
  "title": "Summarize pull request",
  "description": "Collect changed files, review comments, and CI status.",
  "website": "github.com",
  "matchPatterns": ["github.com/*/pull/*"],
  "publisher": {
    "name": "Burst Labs",
    "handle": "@burst",
    "avatarInitials": "BL"
  },
  "icon": {
    "type": "favicon",
    "host": "github.com"
  },
  "permissions": ["Read page DOM", "Read selected text"],
  "sourceUrl": "https://github.com/burst-registry/github-pr-summary",
  "version": "0.1.0"
}
```

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

## Management Commands

Burst reserves local commands for extension management:

- `Install script from registry`
- `Manage installed scripts`
- `Create local script`
- `List installed scripts`

These commands are available on every page and route to the extension dashboard. They do not execute webpage scripts directly.

## Local Script Draft

Local scripts currently use this seed shape:

```ts
type LocalScript = {
  id: string;
  name: string;
  matchPattern: string;
  icon: string;
  status: 'enabled' | 'disabled' | 'draft';
  updatedAt: string;
  code: string;
};
```

The dashboard should eventually persist this data in extension storage and validate it before execution.

## Runtime Direction

Command runtime APIs are not implemented yet. The intended direction is:

- Run only after explicit install and user consent.
- Separate registry discovery from local execution.
- Expose narrow APIs for page DOM reads, selected text, clipboard writes, captures, and connector calls.
- Show permissions, source, publisher identity, and audit state before install.
