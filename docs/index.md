---
layout: home

hero:
  name: "Burst Docs"
  text: "Audited Extension Registry & Palette"
  tagline: "A site-aware command palette and decentralized registry for every webpage."
  image:
    src: /logo.svg
    alt: Burst Logo
  actions:
    - theme: brand
      text: Extension API Guide
      link: /api-guide
    - theme: alt
      text: Registry Toolchain
      link: /registry-toolchain

features:
  - icon: 🛠️
    title: Site-Aware Command Palette
    details: Instant access to productivity scripts customized specifically for your active tab's domain.
  - icon: 🔒
    title: Sandbox Isolation
    details: Shadows page globals and gates sensitive capability access (DOM, clipboard, selection, toasts) to keep pages safe.
  - icon: 🌐
    title: Decentralized Git Registries
    details: Connect custom Git repositories via GitHub raw manifests to install, run, and update local user scripts.
  - icon: 🔄
    title: Unified Update Checker
    details: Automated checker tracking downstream script versions, offering one-click upgrades for official and custom Git registry scripts.
---

## Welcome to Burst

Burst is a powerful, site-aware productivity companion designed to bring custom scripting and command palette capabilities to every webpage. It is structured as a small monorepo:

- **Extension (`entrypoints/`)**: WXT-based Chrome and Firefox extension.
- **Shared Library (`src/lib/`)**: Shared logic and static analysis rules.
- **Registry Website (`apps/registry/`)**: An audited registry marketplace built with Vite + React, backed by a worker-compatible API and D1 storage path.

### Getting Started

- Read the **[Extension API Guide](/api-guide)** to learn how to write custom scripts and capabilities.
- Read the **[Registry & Toolchain Guide](/registry-toolchain)** to learn about the backend database, GitHub-authenticated publishing flows, and setting up custom third-party Git repositories.
- Review the **[Project Status](/project-status)** and the **[Roadmap](/roadmap)** for project milestones and active phases.
