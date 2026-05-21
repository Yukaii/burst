# Roadmap

## Phase 0: Product Skeleton

- Keep extension and registry website in one monorepo.
- Share command registry types between extension and registry.
- Make discovery, source review, risk, permissions, and publisher identity visible before execution.
- Keep the extension palette focused on local scripts and management commands until registry install data is real.

## In Progress

- Model verified publisher credentials registration and publishing workflow (Phase 2: Identity and Publishing).

## Next Up

- Design sandbox-isolated API primitives (e.g. wrapped page DOM reads, secure selection/clipboard/toast APIs) instead of exposing raw document structures (Phase 4: Install and Runtime).

## Phase 1: Registry Contract

- Define `burst.command.json` manifest schema. Minimal v1 contract is in place.
- Model command metadata: title, description, website match patterns, icon, permissions, risk hints, package source, publisher, version, and integrity hash.
- Add installable package format and versioning rules. Initial source URL, entrypoint, archive integrity, and version checks are in place.
- Decide how commands declare runtime capabilities.
- Add registry API read endpoints for search, command detail, audit report, and publisher profile.

## Phase 2: Identity and Publishing

- Add user sign-in to the registry website.
- Add publisher profiles and verified source ownership.
- Build the publish use case flow.
- Require source URL, manifest validation, permission declaration, and package integrity metadata.
- Create command review status states: submitted, indexed, reviewed, verified, flagged, deprecated.

## Phase 3: Trust and Audit

- Build static checks for host scope, dangerous permissions, remote code loading, network access, and obfuscated bundles. (Done - client-side heuristic audit engine implemented)
- Store audit reports as immutable command-version records. (Done - computed dynamically on registry endpoints and mocked)
- Surface audit summaries in the extension palette and registry website. (Done - integrated checklists in dashboard editor and security consent boundary modal)
- Make source review prominent and avoid implying that platform audit equals complete safety. (Done)

## Phase 4: Install and Runtime

- Add install and pin persistence. (Done - local storage sync relay bridge implemented)
- Sync installed commands between registry website and extension. (Done - content script message bridge implemented)
- Add extension settings for palette behavior while leaving global shortcut assignment in Chrome's shortcut UI.
- Design the command execution boundary. (Done - shadow DOM warning consent boundary overlay implemented)
- Require explicit user consent before granting sensitive permissions. (Done - persistent consent grants storage implemented)
- Add safe runtime APIs for page DOM reads, selected text, clipboard writes, captures, and connector calls.

## Phase 4.1: Local Script Data Model

- Replace dashboard-only seed state with extension local storage. Done.
- Add migration/versioning for local script records. Deferred until extension distribution.
- Add enable/disable/delete actions. Done.
- Expose stored local scripts inside the command palette discovery list. Done for enabled scripts.
- Add import/export for local script backup and review. Done.
- Add runtime execution with an explicit API surface instead of raw page globals. Basic `userScripts` execution is in place; per-capability permission grants remain.

## Phase 5: Quality Loop

- Add unit tests for registry matching and search. Started with host matching, palette ordering, management discovery, local script match conversion, and user script code generation.
- Add browser tests for the content palette and registry website.
- Add CI for typecheck, build, lint, and package validation.
- Add release packaging for Chrome and Firefox.
