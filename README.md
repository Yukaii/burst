# Burst

Burst makes every website a command palette.

It is a browser extension and registry for turning narrow website workflows into searchable commands. Users can discover commands in the context of the page they are on, inspect the source and permissions, install what they trust, then fork or customize scripts for their own workflow.

For developers and power users, Burst is a lightweight way to ship live website features without owning the website. A command declares where it runs, what capabilities it needs, where its source lives, and how it uses the Burst runtime API for page reads, selected text, clipboard writes, toasts, and command-owned lists.

## Product Loop

1. **Discover** commands matched to the active website, publisher, permission set, and task.
2. **Inspect** the manifest, source URL, risk level, declared capabilities, and audit state.
3. **Install** commands that should be available from the page command palette.
4. **Fork and customize** live scripts when a workflow needs to be local, private, or adapted.
5. **Publish** reusable commands back to a registry so other users can find and review them.

## Current Scope

- WXT + React extension scaffold using Bun.
- Shadow DOM content-script palette so webpage CSS does not pollute the UI.
- Minimal command palette with command search, keyboard navigation, and site-aware discovery.
- Built-in management commands for local script install/list/manage flows.
- Enabled local scripts from the dashboard appear in the palette and execute through Chrome `userScripts`.
- Chrome extension command shortcut for opening the palette. The default is `Command+Shift+K` on macOS and `Ctrl+Shift+K` elsewhere.
- Popup surface for sign-in direction, local registry posture, and publishing entry points.
- Options page explaining keyboard shortcut configuration.
- Extension dashboard page for local script creation, testing, and management with CodeMirror 6 editing and font controls.
- Command icon metadata for favicon, initials, emoji, URL, or packaged assets.
- Registry website in `apps/registry` for command discovery, audit review, publisher profiles, and publishing entry points.

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

- [Docs home](docs/index.md)
- [Project status](docs/project-status.md)
- [Roadmap](docs/roadmap.md)
- [API guide](docs/api-guide.md)
- [Registry toolchain](docs/registry-toolchain.md)

## Product Direction

Burst should make user-published browser automation discoverable without implying blind trust. The platform can provide contextual discovery, source links, publisher identity, permission summaries, static analysis, audit labels, and forkable scripts. The user still needs a clear path to review source and decide what code can run in their browser.

Near-term architecture work:

- Define `burst.command.json` and validate package manifests.
- Replace empty registry data with a signed registry API.
- Define the command package manifest and permission model.
- Add account sign-in and publisher flows.
- Add source review, audit reports, and install/pin workflows.
- Keep tightening the command runtime boundary so reviewed commands execute only with explicit user consent and declared capabilities.
