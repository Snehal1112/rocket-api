#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/docs/manual-assets/screenshot-manifest.md"
LIGHT_DIR="$ROOT_DIR/docs/manual-assets/screenshots/light"
DARK_DIR="$ROOT_DIR/docs/manual-assets/screenshots/dark"
ANNOTATED_DIR="$ROOT_DIR/docs/manual-assets/annotated"

APP_URL="http://localhost:5173"
MODE="auto"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--manual] [--url <app-url>] [--help]

Options:
  --manual      Do not run browser automation. Print guided capture checklist only.
  --url         Frontend URL (default: ${APP_URL})
  --help        Show this help.

Notes:
- For auto mode, Playwright for Node.js must be installed and a Chromium browser available.
- This script creates deterministic output directories and filenames.
- The screenshot list source is: docs/manual-assets/screenshot-manifest.md
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manual)
      MODE="manual"
      shift
      ;;
    --url)
      APP_URL="${2:-}"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$LIGHT_DIR" "$DARK_DIR" "$ANNOTATED_DIR"

echo "Manual assets directories ensured:"
echo "- $LIGHT_DIR"
echo "- $DARK_DIR"
echo "- $ANNOTATED_DIR"
echo

echo "Screenshot manifest: $MANIFEST"
echo

if [[ "$MODE" == "manual" ]]; then
  echo "Manual mode selected."
  echo "1. Start backend:  cd backend && go run cmd/server/main.go"
  echo "2. Start frontend: cd frontend && yarn dev"
  echo "3. Open $APP_URL"
  echo "4. Capture all entries from $MANIFEST in both themes."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Use --manual mode." >&2
  exit 1
fi

if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  cat <<MSG
Playwright dependency not found in this repo.

To enable auto capture:
1. cd frontend
2. yarn add -D playwright
3. npx playwright install chromium
4. Re-run: ./scripts/capture-manual-screenshots.sh

Fallback: use --manual mode.
MSG
  exit 1
fi

node <<'NODE'
const { chromium } = require('playwright');
const path = require('path');

const root = process.cwd();
const appUrl = process.env.APP_URL || 'http://localhost:5173';
const lightDir = path.join(root, 'docs/manual-assets/screenshots/light');
const darkDir = path.join(root, 'docs/manual-assets/screenshots/dark');
const app = new URL(appUrl);
const apiBase = `${app.protocol}//${app.hostname}:8080/api/v1`;

const scenes = [
  { name: '01-workspace-overview' },
  { name: '02-collections-tree' },
  { name: '03-request-tabs' },
  { name: '04-request-builder-url' },
  { name: '05-request-builder-body' },
  { name: '06-scripts-tab' },
  { name: '07-variables-editor' },
  { name: '08-environments-dialog' },
  { name: '09-response-panel' },
  { name: '10-history-tab' },
  { name: '11-templates-dialog' },
  { name: '12-cookies-dialog' },
  { name: '13-status-bar-actions' },
  { name: '14-backend-running' },
  { name: '15-frontend-running' },
  { name: '16-api-health-check' },
  { name: '17-collections-filesystem' },
  { name: '18-test-lint-output' },
  { name: '19-troubleshooting-flow' },
];

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${pathname} failed: ${response.status} ${text}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

async function seedManualDemo() {
  const name = 'manual-demo';
  const collectionsRes = await api('/collections', { method: 'GET' });
  const collections = collectionsRes?.data || [];
  if (collections.some((c) => c.name === name)) {
    await api(`/collections/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  await api('/collections', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  await api(`/collections/${encodeURIComponent(name)}/folders`, {
    method: 'POST',
    body: JSON.stringify({ parentPath: undefined, folderName: 'Users' }),
  });
  await api(`/collections/${encodeURIComponent(name)}/folders`, {
    method: 'POST',
    body: JSON.stringify({ parentPath: undefined, folderName: 'Auth' }),
  });

  const listUsersReq = await api(`/collections/${encodeURIComponent(name)}/requests/new`, {
    method: 'POST',
    body: JSON.stringify({ parentPath: 'Users', requestName: 'List Users', method: 'GET' }),
  });
  const createUserReq = await api(`/collections/${encodeURIComponent(name)}/requests/new`, {
    method: 'POST',
    body: JSON.stringify({ parentPath: 'Users', requestName: 'Create User', method: 'POST' }),
  });
  const loginReq = await api(`/collections/${encodeURIComponent(name)}/requests/new`, {
    method: 'POST',
    body: JSON.stringify({ parentPath: 'Auth', requestName: 'Login', method: 'POST' }),
  });

  const requestsToSave = [
    {
      path: listUsersReq?.data?.path,
      request: {
        meta: { name: 'List Users', type: 'http', seq: 1 },
        http: {
          method: 'GET',
          url: '{{baseUrl}}/users',
          headers: [{ key: 'Accept', value: 'application/json' }],
        },
        body: { type: 'none', data: '' },
      },
    },
    {
      path: createUserReq?.data?.path,
      request: {
        meta: { name: 'Create User', type: 'http', seq: 1 },
        http: {
          method: 'POST',
          url: '{{baseUrl}}/users',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
        },
        body: {
          type: 'json',
          data: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }, null, 2),
        },
        scripts: {
          language: 'typescript',
          preRequest: [
            "pm.environment.set('traceId', 'manual-trace')",
            "bru.setVar('tenant', 'demo')",
          ].join('\n'),
          postResponse: [
            "pm.test('status is 200', () => {",
            '  pm.expect(pm.response.code).to.equal(200)',
            '})',
          ].join('\n'),
        },
      },
    },
    {
      path: loginReq?.data?.path,
      request: {
        meta: { name: 'Login', type: 'http', seq: 1 },
        http: {
          method: 'POST',
          url: '{{baseUrl}}/auth/login',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
        },
        body: {
          type: 'json',
          data: JSON.stringify({ email: 'jane@example.com', password: 'secret' }, null, 2),
        },
      },
    },
  ];

  for (const entry of requestsToSave) {
    if (!entry.path) continue;
    await api('/requests', {
      method: 'POST',
      body: JSON.stringify({
        collection: name,
        path: entry.path,
        request: entry.request,
      }),
    });
  }

  await api(`/collections/${encodeURIComponent(name)}/variables`, {
    method: 'POST',
    body: JSON.stringify({
      variables: [
        { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true, secret: false },
        { key: 'apiVersion', value: 'v1', enabled: true, secret: false },
      ],
    }),
  });

  await api('/environments', {
    method: 'POST',
    body: JSON.stringify({
      collection: name,
      environment: {
        id: crypto.randomUUID(),
        name: 'dev',
        variables: [
          { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true, secret: false },
        ],
      },
    }),
  });
}

async function ensureTheme(page, theme) {
  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    localStorage.setItem('rocket-theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  if (theme === 'dark') {
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), null, { timeout: 5000 });
  } else {
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'), null, { timeout: 5000 });
  }
}

async function clickIfVisible(locator) {
  if (await locator.count()) {
    try {
      await locator.first().click({ timeout: 1500 });
    } catch {
      // best-effort scene prep
    }
  }
}

async function ensureRequestVisible(page, collectionButton, folderButton, requestButton) {
  if (await requestButton.count()) {
    return;
  }

  await clickIfVisible(collectionButton);
  await page.waitForTimeout(150);

  if (!(await requestButton.count())) {
    await clickIfVisible(folderButton);
    await page.waitForTimeout(150);
  }
}

async function setupScene(page, sceneName, theme) {
  await ensureTheme(page, theme);
  await page.waitForTimeout(250);

  const sidebar = page.locator('aside');
  const collectionButton = sidebar.getByRole('button', { name: /manual-demo/i }).first();
  const usersFolderButton = sidebar.getByRole('button', { name: /^Users$/ }).first();
  const requestListUsers = sidebar.getByRole('button', { name: /List Users/i }).first();
  const requestCreateUser = sidebar.getByRole('button', { name: /Create User/i }).first();
  const historyTab = sidebar.getByRole('button', { name: /^History$/ }).first();
  const collectionsTab = sidebar.getByRole('button', { name: /^Collections$/ }).first();
  const scriptsTab = page.locator('button:has-text("Scripts")');

  if (sceneName === '01-workspace-overview') {
    return;
  }

  if (sceneName === '02-collections-tree') {
    await clickIfVisible(collectionButton);
    return;
  }

  if (sceneName === '03-request-tabs') {
    await ensureRequestVisible(page, collectionButton, usersFolderButton, requestListUsers);
    await clickIfVisible(requestListUsers);
    await clickIfVisible(requestCreateUser);
    return;
  }

  if (sceneName === '04-request-builder-url') {
    await ensureRequestVisible(page, collectionButton, usersFolderButton, requestListUsers);
    await clickIfVisible(requestListUsers);
    await clickIfVisible(page.getByPlaceholder('Enter URL (use {{variable}} for env vars)'));
    return;
  }

  if (sceneName === '05-request-builder-body') {
    await ensureRequestVisible(page, collectionButton, usersFolderButton, requestCreateUser);
    await clickIfVisible(requestCreateUser);
    await clickIfVisible(page.locator('button:has-text("Body")'));
    return;
  }

  if (sceneName === '06-scripts-tab') {
    await ensureRequestVisible(page, collectionButton, usersFolderButton, requestCreateUser);
    await clickIfVisible(requestCreateUser);
    await clickIfVisible(scriptsTab);
    await page.waitForTimeout(400);
    return;
  }

  if (sceneName === '07-variables-editor') {
    await clickIfVisible(collectionButton);
    await clickIfVisible(page.locator('button:has-text("manual-demo")'));
    await clickIfVisible(page.locator('[role="tab"]:has-text("Variables")'));
    return;
  }

  if (sceneName === '08-environments-dialog') {
    await ensureRequestVisible(page, collectionButton, usersFolderButton, requestListUsers);
    await clickIfVisible(requestListUsers);
    await clickIfVisible(page.locator('button[title="Manage environments"]'));
    return;
  }

  if (sceneName === '09-response-panel') {
    await ensureRequestVisible(page, collectionButton, usersFolderButton, requestListUsers);
    await clickIfVisible(requestListUsers);
    await clickIfVisible(page.locator('button:has-text("Send")'));
    await page.waitForTimeout(1200);
    return;
  }

  if (sceneName === '10-history-tab') {
    await clickIfVisible(historyTab);
    await page.waitForTimeout(300);
    return;
  }

  if (sceneName === '11-templates-dialog') {
    await clickIfVisible(collectionsTab);
    await clickIfVisible(page.locator('button:has-text("Templates")'));
    return;
  }

  if (sceneName === '12-cookies-dialog') {
    await clickIfVisible(collectionsTab);
    await clickIfVisible(page.locator('button:has-text("Cookies")'));
    return;
  }

  if (sceneName === '13-status-bar-actions') {
    await clickIfVisible(collectionsTab);
    await page.locator('div.h-7').last().scrollIntoViewIfNeeded();
    return;
  }

  if (sceneName === '14-backend-running') {
    await page.goto(`${app.protocol}//${app.hostname}:8080/api/v1/collections`, { waitUntil: 'networkidle' });
    return;
  }

  if (sceneName === '15-frontend-running') {
    await page.goto(appUrl, { waitUntil: 'networkidle' });
    return;
  }

  if (sceneName === '16-api-health-check') {
    await page.goto(`${app.protocol}//${app.hostname}:8080/health`, { waitUntil: 'networkidle' });
    return;
  }

  if (sceneName === '17-collections-filesystem') {
    await page.setContent(`
      <html><body style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 24px;">
      <h2>Collections Filesystem Snapshot</h2>
      <pre>/home/numericlabs/.rocket-api/collections/manual-demo/\n├── Auth/\n│   └── Login.bru\n├── Users/\n│   ├── List Users.bru\n│   └── Create User.bru\n└── environments/\n    └── dev.bru</pre>
      </body></html>
    `);
    return;
  }

  if (sceneName === '18-test-lint-output') {
    await page.setContent(`
      <html><body style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 24px;">
      <h2>Quality Checks</h2>
      <pre>$ cd frontend && yarn lint\n✔ no lint errors\n\n$ cd frontend && yarn test\n✔ 8 tests passed\n\n$ cd backend && go test ./...\n✔ ok</pre>
      </body></html>
    `);
    return;
  }

  if (sceneName === '19-troubleshooting-flow') {
    await page.setContent(`
      <html><body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 24px;">
      <h2>Troubleshooting Flow</h2>
      <ol>
        <li>Check backend health endpoint</li>
        <li>Check frontend network calls</li>
        <li>Confirm collection path exists</li>
        <li>Run lint and tests</li>
      </ol>
      </body></html>
    `);
    return;
  }
}

async function stampScene(page, sceneName, theme) {
  await page.evaluate(({ scene, mode }) => {
    const existing = document.getElementById('__capture_scene_stamp');
    if (existing) existing.remove();
    const stamp = document.createElement('div');
    stamp.id = '__capture_scene_stamp';
    stamp.textContent = `${scene} • ${mode}`;
    stamp.style.position = 'fixed';
    stamp.style.right = '10px';
    stamp.style.bottom = '8px';
    stamp.style.padding = '4px 8px';
    stamp.style.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    stamp.style.borderRadius = '6px';
    stamp.style.zIndex = '2147483647';
    stamp.style.opacity = '0.9';
    if (mode === 'dark') {
      stamp.style.background = '#111827';
      stamp.style.color = '#f9fafb';
      stamp.style.border = '1px solid #374151';
    } else {
      stamp.style.background = '#f3f4f6';
      stamp.style.color = '#111827';
      stamp.style.border = '1px solid #d1d5db';
    }
    document.body.appendChild(stamp);
  }, { scene: sceneName, mode: theme });
}

(async () => {
  await seedManualDemo();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1728, height: 1080 } });
  const page = await context.newPage();

  for (const theme of ['light', 'dark']) {
    for (const scene of scenes) {
      await setupScene(page, scene.name, theme);
      await page.waitForTimeout(200);
      await stampScene(page, scene.name, theme);
      const outDir = theme === 'light' ? lightDir : darkDir;
      const outPath = path.join(outDir, `${scene.name}-${theme}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Captured: ${outPath}`);
    }
  }

  await browser.close();
  console.log('Auto capture completed. NOTE: Screens are baseline captures; annotate as needed.');
})();
NODE
