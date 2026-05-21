# Registry & Toolchain Guide

This guide details the structure of the Burst Command Registry, how decentralized Git repositories are configured and parsed, the schema of the SQLite registry database, and the REST API toolchain used by the registry server.

---

## 1. Decentralized Git Registry Architecture

Burst supports a **decentralized command registry model**. Instead of forcing all scripts to be hosted on the official Burst marketplace, developers can host commands in standard Git repositories and users can import them directly from the dashboard.

### Git Repository Layout

A Git repository serving as a Burst registry must contain a registry manifest file at the root:

- **`burst.commands.json`** (Recommended): An array of command manifest objects.
- **`burst.command.json`**: A single command manifest object.

For a multi-command repository, `burst.commands.json` should have this structure:

```json
[
  {
    "schemaVersion": 1,
    "id": "github-pr-checkout",
    "title": "PR Checkout Helper",
    "description": "Copy git checkout command for the active pull request.",
    "website": "github.com",
    "matchPatterns": ["github.com/*/pull/*"],
    "publisher": {
      "name": "Dev Tools Hub",
      "handle": "@devtoolshub",
      "avatarInitials": "DT"
    },
    "icon": {
      "type": "emoji",
      "host": "🔌"
    },
    "permissions": ["Read page DOM", "Read selected text"],
    "source": {
      "type": "git",
      "url": "https://github.com/devtoolshub/burst-commands"
    },
    "runtime": {
      "entrypoint": "scripts/pr-checkout.js",
      "capabilities": ["page-dom", "selection", "toast"]
    },
    "risk": "medium",
    "version": "1.2.0"
  },
  {
    "schemaVersion": 1,
    "id": "github-stars-exporter",
    "title": "Star Exporter",
    "description": "Export repository star lists to CSV.",
    "website": "github.com",
    "matchPatterns": ["github.com/*"],
    "publisher": {
      "name": "Dev Tools Hub",
      "handle": "@devtoolshub",
      "avatarInitials": "DT"
    },
    "icon": {
      "type": "favicon",
      "host": "github.com"
    },
    "permissions": ["Read page DOM", "Write clipboard"],
    "source": {
      "type": "git",
      "url": "https://github.com/devtoolshub/burst-commands"
    },
    "runtime": {
      "entrypoint": "scripts/star-exporter.js",
      "capabilities": ["page-dom", "clipboard", "toast"]
    },
    "risk": "medium",
    "version": "0.8.4"
  }
]
```

### Script Code Resolution

When a command is loaded or installed from a Git registry, the script code is fetched from the repository using GitHub's Raw content CDN.
The raw address resolves based on the repository's configuration:

1. **Base URL Conversion**: The user input (e.g. `owner/repo` or a full repository URL) is parsed to extract the `owner`, `repo`, and target `branch` (defaulting to `main`).
2. **Manifest Fetch**:
   - `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/burst.commands.json`
   - Fallback: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/burst.command.json`
3. **Script Code Fetch**: The runtime entrypoint declared in the manifest (e.g. `scripts/pr-checkout.js`) is fetched relative to the repository root:
   - `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{entrypoint}`

---

## 2. Official Registry SQLite Schema

The official registry server (`apps/registry/server.ts`) is powered by `bun:sqlite` to manage users, publishers, verified domains, package releases, and cryptographic audits. The SQLite file is saved at `apps/registry/registry.db`.

### Database Schema

```sql
-- Publishers Table
CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  avatar_initials TEXT NOT NULL,
  verified_domain TEXT UNIQUE
);

-- Sessions Table (Publisher login states)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

-- Commands Table (Marketplace indexed entries)
CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT NOT NULL,
  match_patterns TEXT NOT NULL, -- JSON string array
  publisher_id TEXT NOT NULL,
  icon_type TEXT NOT NULL,
  icon_host TEXT NOT NULL,
  permissions TEXT NOT NULL,    -- JSON string array
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  entrypoint TEXT NOT NULL,
  capabilities TEXT NOT NULL,   -- JSON string array
  risk TEXT NOT NULL,
  version TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);
```

### Publisher Verification Policy
Publishers can claim verified status by linking their profiles to a domain they own (e.g., `github.com` or `mycompany.dev`). Verified domains display a green badge in the Registry web application, guaranteeing that the publisher handles are officially associated with that web namespace.

---

## 3. Official Registry REST API

The Bun server exposes HTTP endpoints for the extension client and registry web interface.

### Endpoint Specifications

#### 1. Authentication
* **`POST /api/auth/login`**: Simulates publisher authentication. Validates publisher handle, sets a cookie header, and returns the session details.
* **`POST /api/auth/logout`**: Clears session credentials.
* **`GET /api/auth/me`**: Returns the current authenticated publisher profile, or `null`.

#### 2. Commands Management
* **`GET /api/commands`**: Lists all indexed marketplace commands. Accepts a query parameter `?q=searchterm` for client filtering.
* **`GET /api/commands/:id`**: Retrieves detailed metadata and source code for a specific command ID.
* **`POST /api/commands`**: Publishes a new command or updates an existing version.
  * *Request Body*: JSON manifest fields + script source code.
  * *Security Gate*: Validates session token, matches publisher permissions, and triggers static analysis audit routines before saving to SQLite.

#### 3. Client Integrations
* **`GET /api/audit-reports/:commandId`**: Fetches the computed audit verification report, which lists checklist evaluations for dangerous operations, remote connections, and obfuscation.

---

## 4. Development & Maintainer Flow

### Pre-release Validation Scanner
When a command manifest is uploaded to the registry, the server triggers the static scanner engine located in `src/lib/staticAnalysis.ts`.
This analyzes the JavaScript source code for high-risk signals:
1. **Network Scanner**: Flags uses of `fetch()`, `XMLHttpRequest`, or websockets.
2. **Obfuscation Detection**: Heuristic scanning for heavy base64 strings, Unicode escaping sequences, or nested hex patterns.
3. **API Access Boundaries**: Assures capabilities declared in `burst.command.json` match the methods invoked in the source code wrapper.
