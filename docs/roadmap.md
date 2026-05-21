# Roadmap

## Phase 0: Product Skeleton

- Keep extension and registry website in one monorepo.
- Share command registry types between extension and registry.
- Make discovery, source review, risk, permissions, and publisher identity visible before execution.
- Use seed data until the registry contract is stable.

## Phase 1: Registry Contract

- Define `burst.command.json` manifest schema.
- Model command metadata: title, description, website match patterns, icon, permissions, risk hints, package source, publisher, version, and integrity hash.
- Add installable package format and versioning rules.
- Decide how commands declare runtime capabilities.
- Add registry API read endpoints for search, command detail, audit report, and publisher profile.

## Phase 2: Identity and Publishing

- Add user sign-in to the registry website.
- Add publisher profiles and verified source ownership.
- Build the publish use case flow.
- Require source URL, manifest validation, permission declaration, and package integrity metadata.
- Create command review status states: submitted, indexed, reviewed, verified, flagged, deprecated.

## Phase 3: Trust and Audit

- Build static checks for host scope, dangerous permissions, remote code loading, network access, and obfuscated bundles.
- Store audit reports as immutable command-version records.
- Surface audit summaries in the extension palette and registry website.
- Make source review prominent and avoid implying that platform audit equals complete safety.

## Phase 4: Install and Runtime

- Add install and pin persistence.
- Sync installed commands between registry website and extension.
- Add extension settings for palette behavior while leaving global shortcut assignment in Chrome's shortcut UI.
- Persist local scripts from the extension dashboard. Done for extension-local records.
- Add dashboard test harnesses for page context, selected text, DOM reads, and permission previews.
- Design the command execution boundary.
- Require explicit user consent before granting sensitive permissions.
- Add safe runtime APIs for page DOM reads, selected text, clipboard writes, captures, and connector calls.

## Phase 4.1: Local Script Data Model

- Replace dashboard-only seed state with extension local storage. Done.
- Add migration/versioning for local script records.
- Add enable/disable/delete actions.
- Expose stored local scripts inside the command palette discovery list. Done for enabled scripts.
- Add import/export for local script backup and review.
- Add runtime execution with an explicit API surface instead of raw page globals. Basic content-context execution is in place; sandboxed APIs remain.

## Phase 5: Quality Loop

- Add unit tests for registry matching and search.
- Add browser tests for the content palette and registry website.
- Add CI for typecheck, build, lint, and package validation.
- Add release packaging for Chrome and Firefox.
