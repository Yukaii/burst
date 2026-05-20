# Burst

Burst is a browser command palette for every webpage. It is inspired by Omni-style launchers, but the core product is an extension registry where people can publish narrow website use cases, discover commands in context, inspect source, and decide what they trust before running anything.

## Current Scope

- WXT + React extension scaffold using Bun.
- Shadow DOM content-script palette so webpage CSS does not pollute the UI.
- Minimal dark command palette with command search, keyboard navigation, and site-aware discovery.
- Chrome extension command shortcut for opening the palette. The default is `Command+Shift+K` on macOS and `Ctrl+Shift+K` elsewhere.
- Popup surface for sign-in direction, local registry posture, publishing entry points, and seed registry metrics.
- Options page explaining keyboard shortcut configuration.
- Registry website scaffold in `apps/registry` for command discovery, audit review, and publishing entry points.
- Typed seed command registry in `src/lib/commands.ts` to shape the early product contract.

## Development

Install dependencies:

```sh
bun install
```

Run Chrome extension dev mode:

```sh
bun run dev:extension
```

Run registry website dev mode:

```sh
bun run dev:registry
```

Run type checking:

```sh
bun run compile
```

Build the extension:

```sh
bun run build
```

Build only one surface:

```sh
bun run build:extension
bun run build:registry
```

## Extension Shortcut

Burst uses Chrome's extension `commands` API for the global trigger. The extension provides a default shortcut, but users configure it through the browser at:

```text
chrome://extensions/shortcuts
```

The options page can explain this, but Chrome owns the actual shortcut assignment UI.

## Docs

- [Project status](docs/project-status.md)
- [Roadmap](docs/roadmap.md)

## Product Direction

Burst should make user-published browser automation discoverable without implying blind trust. The platform can provide command discovery, source links, publisher identity, permission summaries, static analysis, and audit labels. The user still needs a clear path to review source and decide what code can run in their browser.

Near-term architecture work:

- Replace seed registry data with a signed registry API.
- Define the command package manifest and permission model.
- Add account sign-in and publisher flows.
- Add source review, audit reports, and install/pin workflows.
- Add a command runtime boundary that can execute reviewed commands with explicit user consent.
