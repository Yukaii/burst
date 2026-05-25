---
layout: home

hero:
  name: "Burst"
  text: "Make every website a command palette"
  tagline: "Discover, install, fork, and customize website features with live scripts and a small browser runtime API."
  image:
    src: /logo.svg
    alt: Burst Logo
  actions:
    - theme: brand
      text: Write Commands
      link: /api-guide
    - theme: alt
      text: Registry Toolchain
      link: /registry-toolchain

features:
  - icon: 🔎
    title: Discover in Context
    details: Find commands matched to the active website, task, publisher, permissions, and registry trust signals.
  - icon: ✅
    title: Install With Review
    details: Inspect the manifest, source URL, declared capabilities, risk level, and audit state before anything runs.
  - icon: 🍴
    title: Fork and Customize
    details: Start from a registry command, adapt the live script locally, or publish a reusable version for others.
  - icon: ⚡
    title: Extend With APIs
    details: Build commands with narrow runtime capabilities for page reads, selected text, clipboard writes, toasts, and custom lists.
---

## What Burst Is

Burst is a browser extension, registry, and runtime for website-specific commands. It lets users open a palette on any page, discover useful actions for that site, inspect what those actions can do, and install only the commands they trust.

For command authors, Burst is a way to ship small website features as live scripts. A command can read declared parts of the page, use selected text, write to the clipboard, show feedback, and render command-owned lists without becoming a full extension.

## Product Loop

1. Discover commands matched to the current website.
2. Inspect publisher identity, source, permissions, risk, and audit state.
3. Install commands into the page palette.
4. Fork and customize scripts for private workflows.
5. Publish reusable commands back to a registry.

## Repository Shape

Burst is structured as a small monorepo:

- **Extension (`entrypoints/`)**: WXT-based Chrome and Firefox extension.
- **Shared Library (`src/lib/`)**: Shared logic and static analysis rules.
- **Registry Website (`apps/registry/`)**: An audited registry marketplace built with Vite + React, backed by a worker-compatible API and D1 storage path.

### Getting Started

- Read the **[API Guide](/api-guide)** to learn how command manifests, capabilities, and live scripts work.
- Read the **[Registry & Toolchain Guide](/registry-toolchain)** to learn about the backend database, GitHub-authenticated publishing flows, and custom Git registries.
- Review the **[Project Status](/project-status)** and the **[Roadmap](/roadmap)** for project milestones and active phases.
