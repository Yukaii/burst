# Burst

Burst is a browser command palette for every webpage. It is inspired by Omni-style launchers, but the core product is an extension registry where people can publish narrow website use cases, discover commands in context, inspect source, and decide what they trust before running anything.

## Current Scope

- WXT + React extension scaffold using Bun.
- Shadow DOM content-script palette so webpage CSS does not pollute the UI.
- `Mod+K` launcher with command search, keyboard navigation, pinned commands, site-aware discovery, publisher metadata, permissions, risk, audit state, and source links.
- Popup surface for sign-in direction, local registry posture, publishing entry points, and seed registry metrics.
- Typed seed command registry in `src/lib/commands.ts` to shape the early product contract.

## Development

Install dependencies:

```sh
bun install
```

Run Chrome extension dev mode:

```sh
bun run dev
```

Run type checking:

```sh
bun run compile
```

Build the extension:

```sh
bun run build
```

## Product Direction

Burst should make user-published browser automation discoverable without implying blind trust. The platform can provide command discovery, source links, publisher identity, permission summaries, static analysis, and audit labels. The user still needs a clear path to review source and decide what code can run in their browser.

Near-term architecture work:

- Replace seed registry data with a signed registry API.
- Define the command package manifest and permission model.
- Add account sign-in and publisher flows.
- Add source review, audit reports, and install/pin workflows.
- Add a command runtime boundary that can execute reviewed commands with explicit user consent.
