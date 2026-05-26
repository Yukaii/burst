# Registry & Toolchain Guide

This guide details the structure of the Burst Command Registry, how decentralized Git repositories are configured and parsed, the schema of the registry database used by the Cloudflare Worker backend, and the REST API toolchain used by the registry server.

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
      "value": "🔌"
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

## 2. Official Registry D1 Schema

The official registry backend uses a shared HTTP handler that can run locally through `apps/registry/server.ts` and deploy through `apps/registry/worker.ts`. The persistent data layer is designed for Cloudflare D1 so the same schema can run in development and in production workers.

### Hosted AI Provider Configuration

The registry exposes `POST /api/ai/generate-script` for extension-hosted script generation fallback. The endpoint requires a registry API bearer token created from the registry settings page.

Set `AI_PROVIDER` to choose the provider. Supported values:

- `openai-compatible` (default)
- `openai`
- `anthropic`
- `google`
- `openrouter`
- `workers-ai`

Generic OpenAI-compatible configuration:

```sh
AI_PROVIDER=openai-compatible
AI_API_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Provider-specific configuration:

```sh
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-3-5-haiku-latest

# Google Gemini
AI_PROVIDER=google
GOOGLE_AI_API_KEY=...
GOOGLE_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_AI_MODEL=gemini-1.5-flash

# OpenRouter
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini

# Cloudflare Workers AI REST API
AI_PROVIDER=workers-ai
CLOUDFLARE_AI_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_AI_BASE_URL=https://api.cloudflare.com/client/v4
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
```

The generic `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` values remain as fallbacks for every provider, but provider-specific variables take precedence.

### Database Schema

```sql
-- Publishers Table
CREATE TABLE IF NOT EXISTS publishers (
  handle TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_initials TEXT NOT NULL,
  verified INTEGER NOT NULL,
  verified_sources TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  bio TEXT
);

-- Sessions Table (Publisher login states)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_handle TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_handle) REFERENCES publishers(handle)
);

-- Commands Table (Marketplace indexed entries)
CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT NOT NULL,
  match_patterns TEXT NOT NULL,
  publisher_handle TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  risk TEXT NOT NULL,
  permissions TEXT NOT NULL,
  source_url TEXT NOT NULL,
  installs INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5.0,
  icon TEXT NOT NULL,
  code TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  FOREIGN KEY(publisher_handle) REFERENCES publishers(handle)
);
```

### Publisher Verification Policy
Publishers claim verified status by listing verified source domains in `verified_sources`. The registry uses those declared sources, along with the stored publisher handle, to decide whether the audit signature check can report a verified publisher badge in the web application.

---

## 3. Official Registry REST API

The registry API exposes HTTP endpoints for the extension client and registry web interface.

### Endpoint Specifications

#### 1. Authentication
* **`GET /api/auth/config`**: Returns registry auth availability and the GitHub login URL when OAuth is configured.
* **`GET /api/auth/github/start`**: Starts the GitHub OAuth redirect flow and stores the CSRF state plus return URL cookies.
* **`GET /api/auth/github/callback`**: Completes the OAuth exchange, creates the registry session, and redirects back into the app.
* **`POST /api/auth/logout`**: Clears session credentials.
* **`GET /api/auth/me`**: Returns the current authenticated publisher profile, or `null`.

Set `REGISTRY_ADMIN_GITHUB_LOGINS` to a comma-separated list of GitHub logins that should be promoted to registry admin during OAuth sign-in. New authenticated users default to `publisher`; there is no implicit root or first-user admin grant.

#### 2. Commands Management
* **`GET /api/commands`**: Lists all indexed marketplace commands. Accepts a query parameter `?q=searchterm` for client filtering.
* **`GET /api/commands/:id`**: Retrieves detailed metadata and source code for a specific command ID.
* **`POST /api/commands`**: Publishes a new command or updates an existing version.
  * *Request Body*: JSON manifest fields + script source code.
  * *Security Gate*: Validates session token, matches publisher permissions, and triggers static analysis audit routines before saving to the registry store.

#### 3. Publisher Management
* **`GET /api/users`**: Lists publisher accounts for admin sessions only.
* **`GET /api/users/:handle`**: Returns a private publisher management record to that user or an admin.
* **`PATCH /api/users/:handle`**: Lets admins update role, verification, verified sources, and profile fields. Non-admin users can only update their own non-privileged profile fields; role and verification escalation is ignored server-side.

#### 4. Client Integrations
* **`GET /api/audit-reports/:commandId`**: Fetches the computed audit verification report, which lists checklist evaluations for dangerous operations, remote connections, and obfuscation.

---

## 4. Development & Maintainer Flow

### Pre-release Validation Scanner
When a command manifest is uploaded to the registry, the server triggers the static scanner engine located in `src/lib/staticAnalysis.ts`.
This analyzes the JavaScript source code for high-risk signals:
1. **Network Scanner**: Flags uses of `fetch()`, `XMLHttpRequest`, or websockets.
2. **Obfuscation Detection**: Heuristic scanning for heavy base64 strings, Unicode escaping sequences, or nested hex patterns.
3. **API Access Boundaries**: Assures capabilities declared in `burst.command.json` match the methods invoked in the source code wrapper.
