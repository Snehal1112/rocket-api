# Scripts Screenshot and Manual Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated Scripts screenshot scene to the manual capture flow and
update the manuals and manifest so the new asset is documented consistently.

**Architecture:** Extend the existing screenshot seed and scene-selection logic
in the shell script so it can open a request with saved script content and
capture a dedicated Scripts-tab image. Then update the manifest and both manuals
to reference the inserted scene and renumber later screenshots consistently.

**Tech Stack:** Bash, embedded Node.js with Playwright, Markdown docs

---

### Task 1: Add a dedicated Scripts capture scene

**Files:**
- Modify: `scripts/capture-manual-screenshots.sh`

**Step 1: Inspect the current numbered scene list**

Run:
```bash
sed -n '1,260p' scripts/capture-manual-screenshots.sh
```

Expected: the current `scenes` array and `setupScene()` branches show screenshots
`01` through `18` without a dedicated Scripts scene.

**Step 2: Update the seeded request data**

Add deterministic script content and script language to at least one seeded
request so the Scripts tab has meaningful editor content.

Use content similar to:
```js
scripts: {
  language: 'typescript',
  preRequest: "pm.environment.set('traceId', 'manual-trace')\nbru.setVar('tenant', 'demo')",
  postResponse: "pm.test('status is 200', () => {\n  pm.expect(pm.response.code).to.equal(200)\n})",
}
```

**Step 3: Insert the new scene into the ordered capture list**

Rename the scene list so it becomes:
- `01-workspace-overview`
- `02-collections-tree`
- `03-request-tabs`
- `04-request-builder-url`
- `05-request-builder-body`
- `06-scripts-tab`
- `07-variables-editor`
- `08-environments-dialog`
- `09-response-panel`
- `10-history-tab`
- `11-templates-dialog`
- `12-cookies-dialog`
- `13-status-bar-actions`
- `14-backend-running`
- `15-frontend-running`
- `16-api-health-check`
- `17-collections-filesystem`
- `18-test-lint-output`
- `19-troubleshooting-flow`

**Step 4: Add scene setup logic for the Scripts tab**

In `setupScene()`:
- open the seeded collection
- open the scripted request
- click the `Scripts` tab
- wait briefly for the editors to render

Use selectors already present in the UI, for example:
```js
await clickIfVisible(page.locator('button:has-text("Scripts")'))
await page.waitForTimeout(400)
```

**Step 5: Shift later `setupScene()` branches to the new numbering**

Update each branch after the inserted Scripts scene so the branch names match the
renumbered scene list.

**Step 6: Run a lightweight script check**

Run:
```bash
bash -n scripts/capture-manual-screenshots.sh
```

Expected: no syntax errors.

**Step 7: Commit this task**

Run:
```bash
git add scripts/capture-manual-screenshots.sh
git commit -m "docs(manual): add scripts capture scene"
```

Expected: one focused commit with only the automation change.

### Task 2: Update the screenshot manifest

**Files:**
- Modify: `docs/manual-assets/screenshot-manifest.md`

**Step 1: Add the new Scripts screenshot entry in workflow order**

Insert:
```md
6. `06-scripts-tab-light.png` / `06-scripts-tab-dark.png` / `06-scripts-tab-annotated.png`
```

**Step 2: Renumber all later manifest entries**

Shift the remaining entries so the list ends at `19-troubleshooting-flow`.

**Step 3: Verify the manifest matches the capture script scene list**

Run:
```bash
sed -n '1,220p' docs/manual-assets/screenshot-manifest.md
```

Expected: the manifest order matches the renumbered automation list exactly.

**Step 4: Commit this task**

Run:
```bash
git add docs/manual-assets/screenshot-manifest.md
git commit -m "docs(manual): add scripts screenshot to manifest"
```

Expected: one focused commit with only the manifest update.

### Task 3: Update the user manual

**Files:**
- Modify: `docs/user-manual.md`

**Step 1: Insert the dedicated Scripts screenshot into the Scripts section**

Add the image directly above or below the `## 7.1 Scripts` heading:
```md
![Scripts Tab](./manual-assets/screenshots/light/06-scripts-tab-light.png)
```

**Step 2: Tighten the Scripts section copy**

Document:
- the `Scripts` tab location in the Request Builder
- the language selector
- the `Pre-request script` and `Post-response script` editors
- supported `pm.*` and `bru.*` APIs
- current sandbox limits

Keep the section editor-focused and do not turn it into a response-results
section.

**Step 3: Shift later screenshot references to the new numbering**

Update image paths after the Scripts section so they reference:
- variables `07`
- environments `08`
- response `09`
- history `10`
- templates `11`
- cookies `12`
- status bar `13`

**Step 4: Verify the manual references**

Run:
```bash
rg -n "manual-assets/screenshots/light" docs/user-manual.md
```

Expected: every referenced screenshot filename matches the updated numbering.

**Step 5: Commit this task**

Run:
```bash
git add docs/user-manual.md
git commit -m "docs(user): add scripts screenshot guidance"
```

Expected: one focused commit with only the user-manual update.

### Task 4: Update the admin and developer manual

**Files:**
- Modify: `docs/admin-developer-manual.md`

**Step 1: Renumber screenshot references**

Update image references after the inserted Scripts scene so they point to:
- backend `14`
- frontend `15`
- health `16`
- filesystem `17`
- quality checks `18`
- troubleshooting `19`

**Step 2: Update the script runtime and screenshot workflow notes**

Adjust copy so it explicitly states that the screenshot workflow now includes a
dedicated Scripts scene and that the user manual documents the editor UI while
response-panel screenshots cover test output separately.

**Step 3: Verify manual references**

Run:
```bash
rg -n "manual-assets/screenshots/light" docs/admin-developer-manual.md
```

Expected: all filenames align with the renumbered manifest.

**Step 4: Commit this task**

Run:
```bash
git add docs/admin-developer-manual.md
git commit -m "docs(admin): align scripts screenshot workflow"
```

Expected: one focused commit with only the admin/developer manual update.

### Task 5: Final consistency checks

**Files:**
- Modify: none

**Step 1: Run the manual capture checklist path**

Run:
```bash
./scripts/capture-manual-screenshots.sh --manual
```

Expected: the script prints the manual capture instructions without errors.

**Step 2: Verify the new Scripts scene appears everywhere**

Run:
```bash
rg -n "06-scripts-tab|19-troubleshooting-flow|18-test-lint-output" scripts docs
```

Expected: the capture script, manifest, and manuals all agree on the new
numbering.

**Step 3: Review the overall diff**

Run:
```bash
git diff --stat
git diff
```

Expected: changes are limited to the capture script, manifest, manuals, and plan
docs.

**Step 4: Create the final documentation commit**

Run:
```bash
git add scripts/capture-manual-screenshots.sh \
  docs/manual-assets/screenshot-manifest.md \
  docs/user-manual.md \
  docs/admin-developer-manual.md \
  docs/plans/2026-03-11-scripts-screenshot-manual-design.md \
  docs/plans/2026-03-11-scripts-screenshot-manual.md
git commit -m "docs(manual): add scripts screenshot coverage"
```

Expected: one final commit that leaves the repo ready for screenshot refresh.
