# Design: Scripts Screenshot and Manual Refresh

**Date**: 2026-03-11

## Goal

Add a dedicated `Scripts` screenshot scene to the manual capture workflow and
update the user and admin manuals so the Scripts tab is documented with a
matching image and consistent screenshot references.

## Scope

- Update the screenshot automation to capture a dedicated Scripts-tab scene.
- Update the screenshot manifest so the new scene is part of the required asset
  set in both themes.
- Update the user manual to anchor the Scripts section with the new screenshot
  and shift later screenshot references to match the new numbering.
- Update the admin/developer manual so the screenshot workflow explicitly calls
  out the Scripts scene and keeps runtime notes aligned with the user manual.

## Recommended Approach

Insert the new Scripts scene into the existing numbered sequence immediately
after the request body screenshot. This keeps the user-manual screenshots in the
same order as the documented request-building workflow, even though it requires
renumbering later screenshots.

## Screenshot Design

The new scene is editor-focused rather than execution-focused.

- Open the seeded `manual-demo` collection.
- Open a request with sample scripts already saved.
- Switch to the `Scripts` tab.
- Show the language selector plus both `Pre-request` and `Post-response`
  editors.
- Seed deterministic script content using supported `pm.*` and `bru.*` APIs so
  the screenshot is self-explanatory.

This scene should not try to show test execution results in the same image. The
response panel documentation remains responsible for explaining where
`pm.test()` output appears.

## Documentation Design

### User Manual

- Add the dedicated Scripts screenshot to the Scripts section.
- Explain where the Scripts tab lives in the request builder.
- Explain the language selector and the two editor panes.
- Keep the supported API and sandbox-limit notes.
- Shift later screenshot references and section numbering to match the inserted
  screenshot.

### Admin & Developer Manual

- Update the screenshot workflow to explicitly include the Scripts scene.
- Keep the runtime notes aligned with the user-facing description.
- Shift later screenshot references so the filenames match the new sequence.

## Verification

- Confirm the automation scene list, scene setup logic, manifest, and manual
  image references all use the same numbering.
- Verify the new scene uses deterministic seeded script content.
- Run the capture script in `--manual` mode to confirm the checklist path still
  works.
- If no code behavior changes are required outside docs and automation, avoid
  broader test runs unless touched files require them.
