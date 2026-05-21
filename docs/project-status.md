# Project Status

Last updated: 2026-05-20

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
- Site-aware command discovery using typed seed registry data.
- Local management commands in the palette for opening the dashboard, creating scripts, and listing installed scripts.
- Command icon metadata for website favicons, initials, emoji, URLs, and packaged assets.
- Command details for publisher, trust level, risk, permissions, installs, rating, and source URL.
- Popup status panel for account/registry posture.
- Extension dashboard page with CodeMirror-based local script editing/testing/management and editor font controls.
- Local script persistence through extension local storage, including first-run seed data, draft creation, and explicit saves.
- Enabled local scripts are surfaced in the webpage command palette ahead of registry suggestions when their match pattern fits the current host.
- Enabled local scripts execute from the command palette in the content-script context with page, selection, URL, title, window, location, and navigator context.
- Dashboard syntax test action for the current script source.
- Registry website scaffold with marketplace search, command rows, audit labels, and a selected-command inspector.
- Root scripts for separate extension and registry development/build flows.

## Not Implemented Yet

- Real registry API.
- Account sign-in.
- Command publishing flow.
- Command install/pin persistence shared between website and extension.
- Sandboxed local script execution with explicit permission grants.
- Signed command package manifest.
- Static analysis or audit pipeline.
- Runtime sandbox/permission execution model.
- Persisted user settings beyond Chrome-managed shortcut assignment.
- Browser extension icons and brand assets.
- Stable public command API.

## Known Tradeoffs

- Seed local scripts are copied into storage on first launch so the dashboard has useful starter data; after that, the dashboard reads and writes the stored records.
- Local script execution is functional but not yet sandboxed behind explicit runtime permissions.
- Dashboard Test currently performs syntax validation only. It does not execute code in a page-context sandbox yet.
- The dashboard bundle is larger after adding CodeMirror 6. It is isolated to the dashboard page, not the content script.

## Verification Baseline

Expected checks:

```sh
bun run compile
bun run build
```

Development commands:

```sh
bun run dev:extension
bun run dev:registry
```
