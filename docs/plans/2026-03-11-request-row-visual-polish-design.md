# Request Row Visual Polish Design

## Summary

The request rows inside the collections sidebar should remain compact,
but gain stronger visual hierarchy. The current rows are functional yet
visually sparse: the method is plain colored text, the selected state
leans heavily on the left rail, and the row surface itself does not do
enough work to make scanning easy.

This design keeps the current dense tree structure and improves request
rows through compact visual polish only.

## Current Problem

Request rows in the sidebar currently have:

- plain method text rather than a compact shaped indicator
- modest active-state surface treatment
- action affordance that appears correctly but does not feel visually
  anchored
- row content that is aligned compactly, but not strongly enough to feel
  intentionally designed

The row density is good. The visual hierarchy is weak.

## Goals

- Preserve the compact Postman-like density.
- Improve scanability of request rows.
- Make active state more legible.
- Keep method differentiation visible at a glance.
- Avoid layout jitter when hover actions appear.

## Non-Goals

- Redesign folder rows.
- Introduce multi-line request row metadata.
- Change tree structure or behavior.

## Recommended Approach

### 1. Upgrade method text to compact method chips

Turn request methods into small compact chips/pills instead of plain
colored text.

The chip should remain narrow and dense, but provide stronger visual
shape and contrast so methods can be identified faster.

### 2. Strengthen row surface hierarchy

Keep the left active rail, but add a fuller selected-row surface so the
active request reads as selected across the whole row body, not only at
the edge.

Hover state should remain lighter than active state.

### 3. Stabilize internal row alignment

Method chip, request label, and trailing action zone should align to a
stable compact grid.

The action zone should feel reserved even when the icon is hidden until
hover, so rows do not feel visually unstable.

## Layout Rules

### Method chip

- small pill/chip shape
- method-specific color treatment
- narrow width to preserve density
- consistent vertical alignment with request label

### Row surface

- compact row height remains
- active row gets stronger body background
- hover remains subtle and clean

### Label

- single-line truncation
- slightly stronger weight for active request
- no extra metadata line

### Actions

- compact trailing menu
- stable reserved zone width
- hover reveal only, but anchored visually

## Expected Outcome

After the polish:

- request rows feel more intentional
- GET/POST/PUT/DELETE differences are easier to scan
- active request stands out clearly
- the tree remains dense and efficient

## Testing

Manual verification should cover:

- mixed-method request lists
- active and inactive request rows
- nested request rows under folders
- hover action behavior
- narrow sidebar width and truncation

The feature is complete when request rows feel sharper and more scannable
without becoming larger or visually heavy.
