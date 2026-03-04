# Shadcn Full UI Redesign Design (Light + Dark Parity)

## Context
The current UI has functional parity improvements but still feels visually inconsistent across shell, sidebar, tabs, request panels, and dialogs. The user requested a broader look-and-feel refresh based on shadcn components, with equal quality in both light and dark themes and consistent brand color identity.

## Goals
- Redesign key application surfaces with a cohesive shadcn-first visual system.
- Keep light and dark themes equally polished with the same brand hue family.
- Improve icon consistency, spacing rhythm, and interaction states.
- Preserve all existing product behavior.

## Non-Goals
- Changing API behavior or request execution logic.
- Reworking domain workflows (tabs, save/open rules, collection semantics).
- Introducing new product features unrelated to visual UX.

## Visual Direction
- Token-driven surface hierarchy for shell, panels, and controls.
- Stronger yet restrained typography hierarchy.
- Consistent icon language (collection/folder/request/actions).
- Subtle motion and hover states for responsiveness.

## Theme System Contract
- Shared brand accent hue family for both themes.
- Light/dark differ by contrast and surface depth, not brand identity.
- Semantic token usage only (`background`, `card`, `muted`, `accent`, `border`, `ring`, `foreground`).
- Avoid one-off hardcoded colors except where method badges communicate semantics.

## Scope
1. App shell/header
2. Collections sidebar
3. Request tabs
4. Request builder and response panels
5. Dialog/dropdown visual consistency

## Technical Approach
- Update `frontend/src/globals.css` token values for light and dark parity.
- Refactor major views to rely on shadcn primitives and tokenized classes.
- Standardize section wrappers using card-like surfaces and consistent spacing scale.
- Keep all event handlers, state flows, and API calls unchanged.

## Validation
- Manual pass on both themes for:
  - collection navigation and tree interactions
  - request editing/sending/saving
  - tab switching/dirty states
  - dialogs/dropdowns/tooltips
- Automated checks:
  - `cd frontend && yarn -s lint`
  - `cd frontend && yarn -s test`
  - `cd frontend && yarn -s build`

## Acceptance Criteria
- UI feels cohesive and modern across all primary screens.
- Light and dark themes have matched quality and visual intent.
- No regressions in existing behaviors.
