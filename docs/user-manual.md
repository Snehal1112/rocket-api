# Rocket User Manual

This manual explains the end-user features available in Rocket and how to use them.

## 1. What Rocket Supports

Rocket supports:
- Collection-based API request management
- Folder and request organization (Postman/Bruno style)
- Multi-tab request editing and collection overview tabs
- HTTP methods, headers, query params, auth, and request body editing
- Request-level scripts (pre-request and post-response)
- Environment + collection variables
- Request history
- Request templates
- Cookie jar management
- Theme support (Light and Dark)

## 2. First Launch — Welcome Screen

![Welcome Screen (first launch)](./manual-assets/screenshots/light/01-workspace-overview-light.png)

On first launch — or whenever all request tabs are closed — Rocket shows the welcome screen. It displays the Rocket logo, the prompt **"Launch your first request"**, and a **New Request** button.

Click **New Request** (or the `+` button in the tab bar) to open a blank request and get started.

## 3. Workspace Overview

Once at least one tab is open, the full workspace is visible:

![Workspace Overview](./manual-assets/screenshots/light/02-collections-tree-light.png)

The workspace has three main areas:
- **Left sidebar** — Collections, folders, and requests tree
- **Tab bar** — Open request tabs; click `+` to add a new tab
- **Main panel** — Request builder (top) and response panel (bottom)

## 4. Collections, Folders, and Requests

![Collections Tree](./manual-assets/screenshots/light/02-collections-tree-light.png)

### 4.1 Create a Collection
1. Click `New` in the global status bar.
2. Enter collection name.
3. Click `Create`.

### 4.2 Create Folder/Request
1. Open collection menu (`...`).
2. Select `New Folder` or `New Request`.
3. Provide name and confirm.

### 4.3 Open Behavior
- Clicking a request opens it in a new tab if not already open.
- Clicking an already-open request focuses the existing tab.

## 5. Request Tabs

![Request Tabs](./manual-assets/screenshots/light/03-request-tabs-light.png)

- Multiple requests can stay open simultaneously.
- Active tab selection syncs with sidebar selection.
- Save operations target the originating tab/request.

## 6. URL and Request Builder

![Request URL Editor](./manual-assets/screenshots/light/04-request-builder-url-light.png)

### 6.1 URL Variables
- Use `{{variableName}}` in URL.
- Hover variable token to open inline popout editor.
- Save updates active environment variable first; fallback is collection variable.

## 7. Headers, Query, Body, Auth

![Request Body](./manual-assets/screenshots/light/05-request-builder-body-light.png)

Rocket supports body modes:
- `none`
- `json`
- `raw`
- `form-data`
- `binary`

## 7.1 Scripts

![Scripts Tab](./manual-assets/screenshots/light/06-scripts-tab-light.png)

- Open the `Scripts` tab in Request Builder to access the request-level script editors.
- Use the language selector to switch between `JavaScript` and `TypeScript`.
- Use `Pre-request script` to modify outgoing request data (headers/body/url/variables) before send.
- Use `Post-response script` to run checks after response is received.

Script APIs:
- Postman-style: `pm.*`
- Bruno-style: `bru.*`

Current sandbox constraints:
- No direct filesystem or process access.
- No module import/require support.
- Script runtime has execution timeout limits.

## 8. Collection Variables

![Variables Editor](./manual-assets/screenshots/light/07-variables-editor-light.png)

- Open collection overview tab.
- Switch to `Variables` tab.
- Add/edit keys and values.
- Mark secret or enable/disable variables.
- Click `Save`.

## 9. Environments

![Environments Dialog](./manual-assets/screenshots/light/08-environments-dialog-light.png)

- Create per-collection environments.
- Use environment variables to override collection variables.
- Switch active environment to test different targets.

## 10. Send Request and Analyze Response

![Response Panel](./manual-assets/screenshots/light/09-response-panel-light.png)

Response area provides:
- Status code and status text
- Timing and payload size
- **Headers** tab: all response headers
- **Body** tab: syntax-highlighted JSON viewer with a Copy button
- **Tests** tab: pass/fail results for any `pm.test()` assertions in your scripts

## 11. History

![History Tab](./manual-assets/screenshots/light/10-history-tab-light.png)

- Open `History` tab in sidebar.
- Click any history item to load it into active request tab.

## 12. Templates

![Templates Dialog](./manual-assets/screenshots/light/11-templates-dialog-light.png)

- Click `Templates` in status bar.
- Pick template category and template.
- Template loads into active request tab.

## 13. Cookies

![Cookies Dialog](./manual-assets/screenshots/light/12-cookies-dialog-light.png)

- Click `Cookies` in status bar.
- View by domain, delete specific cookies, clear expired/all.

## 14. Status Bar Actions

![Status Bar Actions](./manual-assets/screenshots/light/13-status-bar-actions-light.png)

Quick actions:
- `New`
- `Import`
- `Templates`
- `Cookies`

## 15. Troubleshooting (User)

- Request fails to send:
  - Ensure backend is running on `http://localhost:8080`.
- Collection not visible:
  - Reload app, confirm collection exists under workspace collections directory.
- Variables not updating:
  - Ensure you are on the intended collection overview tab and clicked `Save`.

## 16. Screenshot Coverage

Raw screenshots for both themes are tracked in:
- `docs/manual-assets/screenshot-manifest.md`
