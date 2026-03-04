# README Branding Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Rocket branding presentation in README while preserving concise quick-start usability.

**Architecture:** Update the top section of `README.md` with a hero-style block and badges, then keep existing quick-start and operational sections mostly intact.

**Tech Stack:** Markdown.

---

### Task 1: Add branded hero section

**Files:**
- Modify: `README.md`

**Step 1: Write minimal implementation**
- Keep centered Rocket logo.
- Add concise product tagline.
- Add capability badges (Go, React, TypeScript, Bruno-compatible, Offline-first).

**Step 2: Verify**
- Ensure markdown is valid and readable in plain text.

### Task 2: Preserve concise quick-start navigation

**Files:**
- Modify: `README.md`

**Step 1: Write minimal implementation**
- Keep Quick Start near top.
- Keep docs and command references concise and scannable.

**Step 2: Verify**
- Confirm path/code blocks remain correct.

### Task 3: Final checks

**Files:**
- Modify: `README.md`

**Step 1: Validate paths**
- Ensure referenced local docs/scripts files exist.

**Step 2: Commit**
```bash
git add README.md docs/plans/2026-03-04-readme-branding-polish-design.md docs/plans/2026-03-04-readme-branding-polish.md
git commit -m "docs(readme): polish Rocket branding with concise hero section"
```
