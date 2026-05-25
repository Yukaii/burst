# Store Submission Draft

## Shared Listing Copy

### Name

Burst

### Short Description

A programmable command palette for running trusted page automations from your browser.

### Summary

Burst adds a fast command palette to every webpage. Use it to run local scripts, install reviewed commands, capture page context, and automate repetitive browser workflows without leaving the current tab.

### Detailed Description

Burst is a browser command palette for webpage automation.

With Burst, you can:

- Open a command palette on any webpage with a keyboard shortcut.
- Run local commands that you control and store in your browser.
- Install registry commands with publisher, permission, and static-audit context.
- Use page selection, safe DOM helpers, clipboard writes, toasts, and list-style command output.
- Manage scripts from a built-in dashboard with editor preferences, command status, and registry controls.

Burst is designed for developer and power-user workflows where small page-specific automations save repeated manual work. Commands run through the browser User Scripts API rather than runtime string evaluation, and installed commands are synchronized with the browser’s native script registry.

### Category

Productivity

### Language

English

### Homepage

https://github.com/Yukaii/burst

### Support URL

https://github.com/Yukaii/burst/issues

### Privacy Policy Draft

Burst stores your local scripts, settings, installed command metadata, consent grants, and registry API token in browser extension storage.

Burst does not include third-party analytics or advertising tracking.

Burst may contact a configured Burst registry server when you search, install, or refresh registry commands. Those requests can include search text, the current page host used for filtering, installed command identifiers, account/session information for publisher features, and API tokens you configure.

If you use hosted AI generation, Burst sends your prompt, current editor code, match patterns, and page title to the configured registry server so it can generate script code. Browser-local AI generation runs locally when supported by the browser.

User scripts can read or act on webpage content only according to the command capabilities and browser permissions you approve. Review command source, match patterns, and audit details before running commands from external publishers.

### Permission Justification

- `storage`: Saves local scripts, settings, installed command metadata, registry tokens, and consent grants.
- `userScripts`: Registers local and installed commands with the browser User Scripts API so they can run on matching pages.
- `<all_urls>` / all sites: Allows the command palette content script to appear on webpages and lets user-approved commands run on their configured match patterns.

## Chrome Web Store

### Single Purpose

Burst provides a programmable command palette for webpage automation. Users can run local commands and installed registry commands on matching pages from a keyboard-driven palette.

### Permission Explanations

Use the shared permission justification above. Chrome may also ask for a justification for broad host access; use:

Burst injects the command palette UI across webpages and registers user-approved commands for their configured URL match patterns. Commands are only shown and executed when their match patterns apply.

### Data Usage Answers

Recommended answers based on current behavior:

- Does the extension collect or transmit user data? Yes, when users interact with registry, account, publishing, or hosted AI features.
- Analytics/tracking: No third-party analytics or advertising tracking.
- Remote code: No remote JavaScript is loaded at runtime. Registry command source is stored and registered as browser user scripts after user installation.
- Data sale/transfer for unrelated purposes: No.

### Review Notes

Burst uses the browser User Scripts API. In Chrome, users may need to enable "Allow user scripts" for the extension or Developer Mode on older Chromium versions.

## Mozilla Add-ons

### Summary

Use the shared summary.

### Description

Use the shared detailed description.

### Notes to Reviewer

Burst uses WXT. Build and verification instructions are in `SOURCE_CODE_REVIEW.md`.

Firefox requires the optional `userScripts` permission for command execution. The extension requests this permission from Burst settings/dashboard before syncing enabled commands.

### Firefox Data Collection Disclosure

For a first AMO listing submitted after November 3, 2025, Firefox requires `browser_specific_settings.gecko.data_collection_permissions`.

Do not declare `required: ["none"]` unless registry and hosted AI network features are disabled or removed for the Firefox build. With the current feature set, the conservative disclosure is:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "data_collection_permissions": {
        "required": ["browsingActivity"],
        "optional": ["websiteContent", "technicalAndInteraction"]
      }
    }
  }
}
```

Rationale:

- `browsingActivity`: registry search/install flows can use the current host for command filtering.
- `websiteContent`: hosted AI generation can transmit page title and user-provided prompt/editor content.
- `technicalAndInteraction`: only if future telemetry or diagnostics are added. Keep this out if no telemetry is shipped.

Before the first AMO submission, choose the final disclosure and update `wxt.config.ts` accordingly.

## Release Workflow Secrets

Add these GitHub Actions secrets before using the publishing workflow:

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`
- `FIREFOX_EXTENSION_ID`
- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

The workflow supports manual dry runs and automatic submission on `v*` tags.
