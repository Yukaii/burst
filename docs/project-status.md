# Project Status

Last updated: 2026-05-21

## Repository Shape

Burst is now structured as a small monorepo:

- `entrypoints/`: WXT extension entrypoints for background, content script, and popup.
- `src/lib/`: shared product/domain code used by both the extension and registry website.
- `src/ui/`: extension UI components and isolated content-script styling.
- `apps/registry/`: registry website scaffold built with Vite + React.
- `docs/`: product status, roadmap, and architecture notes.

The registry website should live outside WXT entrypoints because it is a normal web app with different routing, deployment, authentication, and server/API needs. Keeping it in `apps/registry` lets the extension and website share types while avoiding extension build constraints.

## Implemented

- WXT + React extension scaffold using Bun.
- Shadow DOM command palette mounted on every webpage and opened through Chrome extension commands.
- Minimal dark command palette with no injected floating launcher button.
- Site-aware command discovery for enabled local scripts and built-in management commands.
- Local management commands in the palette for opening the dashboard, creating scripts, and listing installed scripts.
- Command icon metadata for website favicons, initials, emoji, URLs, and packaged assets.
- Command details for publisher, trust level, risk, permissions, installs, rating, and source URL.
- Popup status panel for account/registry posture.
- Extension dashboard page with CodeMirror-based local script editing/testing/management and editor font controls.
- Local script persistence through extension local storage, including first-run seed data, draft creation, and explicit saves.
- Local script status controls for enabling, disabling, draft state, and deletion.
- Local script JSON import/export for backup and source review.
- Enabled local scripts are surfaced in the webpage command palette when their match pattern fits the current host.
- Enabled local scripts execute through Chrome's `userScripts` API and are triggered from the command palette without runtime string evaluation.
- Palette-triggered local scripts report started/complete/error status back to the palette; pages loaded before registration now show a reload instruction instead of failing silently.
- Dashboard source check confirms the required `export default function run(context) { ... }` shape without using `eval`.
- Interactive Dashboard Test Harness with Mock URL, Mock Title, Mock Selection, Mock DOM HTML, real-time capability badges, and scrollable console/execution log terminal.
- Registry website scaffold with marketplace layout, dynamic mock command listings, and query-based search.
- Async Registry API Client layer in `src/lib/registryApi.ts` simulating network latency with mock commands, audit reports, and publisher profiles.
- Tabbed Command Inspector in Registry Web App showing Details, Audit Report verification checklists, and verified Publisher profiles.
- Minimal `burst.command.json` v1 manifest contract with sample manifest validation.
- Manifest package checks for HTTPS source URLs, safe relative entrypoints, archive integrity metadata, and semantic versions.
- Bun test coverage for host matching, local script match conversion, user script code generation, palette ordering, management command discovery, script capabilities detection, and mock Registry API calls.
- Root scripts for separate extension and registry development/build flows.
- Bidirectional registry-to-extension postMessage sync relay bridge for installing, uninstalling, pinning, and unpinning registry scripts.
- Installed registry command persistence in extension local storage, integrated into Chrome's userScripts API dynamically.
- Dynamic user scripts execution routing in background.ts.
- Command execution consent boundary warning modal overlay in the shadow DOM palette gating medium/high risk script execution.
- Persistent security permission grants storage avoiding repetitive prompts.
- Page text selection capture fix resolving autofocus-triggered selection reset in the command palette UI.
- Static analysis audit engine (Phase 3: Trust and Audit) implementing client-side regex heuristics for host scope, sensitive APIs, remote code evaluation, outgoing network requests, and obfuscation signatures.
- Static Security Audit checklist UI panels integrated dynamically inside the extension dashboard script editor and the command palette warning consent overlay.
- Verified publisher credentials registration and publishing workflow (Phase 2) with verified sources checks.
- Command publishing flow UI wizard with live static audit analysis and pre-release scanner checklists.
- Simulated cryptographic package signature verification and manifest integrity checks in the registry audit console.
- Persisted user settings (dark mode theme preferences, update updates configuration, local cache resets) on the settings dashboard.
- Browser extension premium brand logo SVG asset integrated into the popup, dashboard, and registry header views.
- Sandbox-isolated user script runtime execution wrappers shadowing page globals (`document`, `window`, `navigator`, `location`) using parameter-bound IIFE scopes and capability-gated explicit APIs (page, selection, clipboard, toast).
- Premium extension options settings page and syncing mechanism for Theme (Light/Dark/System), Alignment (Top/Center), Backdrop Close, Developer Logging, and Consent Revocation.
- Stable public command API documented and capability-gated in sandboxed runtime executions.
- Worker-compatible registry backend with shared API handlers and D1-backed persistence for commands, publishers, and session-based authentication.
- Decentralized custom Git registries list in the Extension Dashboard, stored in Chrome local storage.
- GitHub Raw manifest parser fetching and installing commands from external git repositories.
- Unified Update Checker dashboard panel checking versions and providing one-click updates for official and custom Git registry scripts.
- Sleek macOS-inspired visual redesign across all user-facing pages (Popup, Options, Dashboard, Shadow DOM Command Palette, and Registry Web App) featuring dynamic light/dark/system theme propagation, CodeMirror theme synchronization, glassmorphism, and keycap badges.
- Dashboard layout redesigned into a split-pane IDE workspace resolving editor overlapping issues.
- Refactored dropdown controls like IconSelect and LocalScriptIcon using Tailwind CSS to emulate premium Shadcn UI select patterns.
- Expanded VitePress documentation with comprehensive guides covering decentralized Git registries, D1-backed registry schemas, REST API endpoints, and a new Project Architecture & Developer Guide.

## In Progress

- Registry dashboard UI refinement: stronger workspace hierarchy, session header, and user-management polish.
- Registry account sign-in: GitHub OAuth session status endpoints are in place, and the registry now uses the real OAuth flow.

## Not Implemented Yet

- None.

## Known Tradeoffs

- Seed local scripts are copied into storage on first launch so the dashboard has useful starter data; after that, the dashboard reads and writes the stored records.
- Newly registered or edited user scripts apply to matching page loads after registration. Existing tabs may need a reload before the listener is present.
- Dashboard Test validates the expected export shape only. Full syntax diagnostics should come from a dedicated parser or registration dry run.
- Local script import currently replaces the full local script list after confirmation instead of merging records.
- The dashboard bundle is larger after adding CodeMirror 6. It is isolated to the dashboard page, not the content script.
- GitHub OAuth secrets are still required in production before sign-in becomes active on the deployed Worker.

## Verification Baseline

Expected checks:

```sh
bun run test
bun run compile
bun run build
```

Development commands:

```sh
bun run dev:extension
bun run dev:registry
```
