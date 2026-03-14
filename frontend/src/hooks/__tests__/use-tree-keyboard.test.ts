import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTreeKeyboard } from '../use-tree-keyboard'
import type { FlatTreeNode } from '../use-flat-tree'
import type { CollectionNode } from '@/lib/api'

function makeNode(overrides: Partial<CollectionNode> & { name: string }): CollectionNode {
  return { type: 'request', ...overrides }
}

function makeFlatNode(overrides: Partial<FlatTreeNode> & { name: string }): FlatTreeNode {
  const defaultNode = makeNode({ name: overrides.name, type: overrides.isFolder ? 'folder' : 'request', path: overrides.path, method: 'GET' })
  const { node: nodeOverride, ...rest } = overrides
  return {
    node: nodeOverride ?? defaultNode,
    depth: 0,
    parentIndex: null,
    isExpanded: false,
    path: overrides.path ?? overrides.name,
    isFolder: false,
    siblingCount: 1,
    positionInSet: 1,
    ...rest,
  }
}

function makeKeyEvent(key: string, extra: Partial<React.KeyboardEvent> = {}): React.KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...extra,
  } as unknown as React.KeyboardEvent
}

function setup(flatTree: FlatTreeNode[], overrides: Record<string, unknown> = {}) {
  const toggleExpand = vi.fn()
  const onActivate = vi.fn()
  const virtualizer = { scrollToIndex: vi.fn() }

  const props = {
    flatTree,
    toggleExpand,
    onActivate,
    virtualizer,
    ...overrides,
  }

  const hook = renderHook(
    (p) => useTreeKeyboard(p),
    { initialProps: props }
  )

  return { ...hook, toggleExpand, onActivate, virtualizer, props }
}

describe('useTreeKeyboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ArrowDown / ArrowUp', () => {
    it('moves focus down', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru', positionInSet: 2, siblingCount: 2 }),
      ]
      const { result } = setup(tree)

      expect(result.current.focusedIndex).toBe(0)
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(result.current.focusedIndex).toBe(1)
    })

    it('does not move past last item', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(result.current.focusedIndex).toBe(1)
    })

    it('moves focus up', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(result.current.focusedIndex).toBe(1)
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowUp')) })
      expect(result.current.focusedIndex).toBe(0)
    })

    it('does not move above first item', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowUp')) })
      expect(result.current.focusedIndex).toBe(0)
    })
  })

  describe('ArrowRight', () => {
    it('expands collapsed folder', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Folder', path: 'folder', isFolder: true, isExpanded: false, node: makeNode({ name: 'Folder', type: 'folder', path: 'folder' }) }),
      ]
      const { result, toggleExpand } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowRight')) })
      expect(toggleExpand).toHaveBeenCalledWith('folder')
    })

    it('moves to first child for expanded folder', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Folder', path: 'folder', isFolder: true, isExpanded: true, node: makeNode({ name: 'Folder', type: 'folder', path: 'folder' }) }),
        makeFlatNode({ name: 'Child', path: 'folder/child.bru', depth: 1, parentIndex: 0 }),
      ]
      const { result, toggleExpand } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowRight')) })
      expect(toggleExpand).not.toHaveBeenCalled()
      expect(result.current.focusedIndex).toBe(1)
    })

    it('is no-op on request node', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Request', path: 'req.bru' }),
      ]
      const { result, toggleExpand } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowRight')) })
      expect(toggleExpand).not.toHaveBeenCalled()
      expect(result.current.focusedIndex).toBe(0)
    })
  })

  describe('ArrowLeft', () => {
    it('collapses expanded folder', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Folder', path: 'folder', isFolder: true, isExpanded: true, node: makeNode({ name: 'Folder', type: 'folder', path: 'folder' }) }),
        makeFlatNode({ name: 'Child', path: 'folder/child.bru', depth: 1, parentIndex: 0 }),
      ]
      const { result, toggleExpand } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowLeft')) })
      expect(toggleExpand).toHaveBeenCalledWith('folder')
    })

    it('moves to parent for collapsed folder', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Parent', path: 'parent', isFolder: true, isExpanded: true, node: makeNode({ name: 'Parent', type: 'folder', path: 'parent' }) }),
        makeFlatNode({ name: 'Child', path: 'parent/child', isFolder: true, isExpanded: false, depth: 1, parentIndex: 0, node: makeNode({ name: 'Child', type: 'folder', path: 'parent/child' }) }),
      ]
      const { result } = setup(tree)

      // Move to child folder
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(result.current.focusedIndex).toBe(1)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowLeft')) })
      expect(result.current.focusedIndex).toBe(0)
    })

    it('moves to parent for request node', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Folder', path: 'folder', isFolder: true, isExpanded: true, node: makeNode({ name: 'Folder', type: 'folder', path: 'folder' }) }),
        makeFlatNode({ name: 'Request', path: 'folder/req.bru', depth: 1, parentIndex: 0 }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowLeft')) })
      expect(result.current.focusedIndex).toBe(0)
    })

    it('is no-op for top-level node with null parentIndex', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'TopLevel', path: 'top.bru', parentIndex: null }),
      ]
      const { result, toggleExpand } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowLeft')) })
      expect(result.current.focusedIndex).toBe(0)
      expect(toggleExpand).not.toHaveBeenCalled()
    })
  })

  describe('Home / End', () => {
    it('Home moves to first item', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
        makeFlatNode({ name: 'C', path: 'c.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(result.current.focusedIndex).toBe(2)

      act(() => { result.current.onKeyDown(makeKeyEvent('Home')) })
      expect(result.current.focusedIndex).toBe(0)
    })

    it('End moves to last item', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
        makeFlatNode({ name: 'C', path: 'c.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('End')) })
      expect(result.current.focusedIndex).toBe(2)
    })
  })

  describe('Enter', () => {
    it('activates current node', () => {
      const node = makeNode({ name: 'Request', path: 'req.bru' })
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Request', path: 'req.bru', node }),
      ]
      const { result, onActivate } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('Enter')) })
      expect(onActivate).toHaveBeenCalledWith(node)
    })
  })

  describe('Space', () => {
    it('toggles folder expand', () => {
      const node = makeNode({ name: 'Folder', type: 'folder', path: 'folder' })
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Folder', path: 'folder', isFolder: true, node }),
      ]
      const { result, toggleExpand, onActivate } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent(' ')) })
      expect(toggleExpand).toHaveBeenCalledWith('folder')
      expect(onActivate).not.toHaveBeenCalled()
    })

    it('activates request node', () => {
      const node = makeNode({ name: 'Request', path: 'req.bru' })
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Request', path: 'req.bru', node }),
      ]
      const { result, toggleExpand, onActivate } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent(' ')) })
      expect(onActivate).toHaveBeenCalledWith(node)
      expect(toggleExpand).not.toHaveBeenCalled()
    })
  })

  describe('type-ahead', () => {
    it('finds matching node by first character', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Alpha', path: 'alpha.bru' }),
        makeFlatNode({ name: 'Beta', path: 'beta.bru' }),
        makeFlatNode({ name: 'Charlie', path: 'charlie.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('b')) })
      expect(result.current.focusedIndex).toBe(1)
    })

    it('accumulates buffer for multi-character search', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Alpha', path: 'alpha.bru' }),
        makeFlatNode({ name: 'Apex', path: 'apex.bru' }),
        makeFlatNode({ name: 'Beta', path: 'beta.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('a')) })
      // Matches 'Apex' (index 1, search forward from 0+1)
      expect(result.current.focusedIndex).toBe(1)

      act(() => { result.current.onKeyDown(makeKeyEvent('l')) })
      // Buffer is now 'al', matches 'Alpha' (wraps around from index 2)
      expect(result.current.focusedIndex).toBe(0)
    })

    it('clears buffer after 500ms', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Alpha', path: 'alpha.bru' }),
        makeFlatNode({ name: 'Beta', path: 'beta.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('b')) })
      expect(result.current.focusedIndex).toBe(1)

      // Advance timers to clear buffer
      act(() => { vi.advanceTimersByTime(500) })

      // Now 'a' should start fresh search
      act(() => { result.current.onKeyDown(makeKeyEvent('a')) })
      // Search forward from 1+1=2, wraps to 0 which is 'Alpha'
      expect(result.current.focusedIndex).toBe(0)
    })

    it('wraps search around', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Alpha', path: 'alpha.bru' }),
        makeFlatNode({ name: 'Beta', path: 'beta.bru' }),
        makeFlatNode({ name: 'Aardvark', path: 'aardvark.bru' }),
      ]
      const { result } = setup(tree)

      // Focus on last item
      act(() => { result.current.onKeyDown(makeKeyEvent('End')) })
      expect(result.current.focusedIndex).toBe(2)

      act(() => { vi.advanceTimersByTime(500) })

      // Type 'a', search from index 0 (wrap), should find 'Alpha' at 0
      act(() => { result.current.onKeyDown(makeKeyEvent('a')) })
      expect(result.current.focusedIndex).toBe(0)
    })

    it('is case insensitive', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'alpha', path: 'alpha.bru' }),
        makeFlatNode({ name: 'BETA', path: 'beta.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('B')) })
      expect(result.current.focusedIndex).toBe(1)
    })

    it('ignores keys with ctrl/meta/alt modifiers', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'Alpha', path: 'alpha.bru' }),
        makeFlatNode({ name: 'Beta', path: 'beta.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('b', { ctrlKey: true })) })
      expect(result.current.focusedIndex).toBe(0)
    })
  })

  describe('focus index management', () => {
    it('resets to 0 when flatTree identity changes', () => {
      const tree1: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
      ]
      const tree2: FlatTreeNode[] = [
        makeFlatNode({ name: 'C', path: 'c.bru' }),
        makeFlatNode({ name: 'D', path: 'd.bru' }),
      ]
      const toggleExpand = vi.fn()
      const onActivate = vi.fn()
      const virtualizer = { scrollToIndex: vi.fn() }

      const { result, rerender } = renderHook(
        (props) => useTreeKeyboard(props),
        {
          initialProps: {
            flatTree: tree1,
            toggleExpand,
            onActivate,
            virtualizer,
          }
        }
      )

      // Move focus to index 1
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(result.current.focusedIndex).toBe(1)

      // Rerender with new tree identity
      rerender({
        flatTree: tree2,
        toggleExpand,
        onActivate,
        virtualizer,
      })

      expect(result.current.focusedIndex).toBe(0)
    })

    it('setFocusedIndex updates the index', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
        makeFlatNode({ name: 'C', path: 'c.bru' }),
      ]
      const { result } = setup(tree)

      act(() => { result.current.setFocusedIndex(2) })
      expect(result.current.focusedIndex).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('handles empty tree', () => {
      const { result, toggleExpand, onActivate } = setup([])

      // All keys should be no-ops
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowUp')) })
      act(() => { result.current.onKeyDown(makeKeyEvent('Enter')) })
      act(() => { result.current.onKeyDown(makeKeyEvent(' ')) })

      expect(toggleExpand).not.toHaveBeenCalled()
      expect(onActivate).not.toHaveBeenCalled()
      expect(result.current.focusedIndex).toBe(0)
    })

    it('scrolls to index on focus change', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
      ]
      const { result, virtualizer } = setup(tree)

      act(() => { result.current.onKeyDown(makeKeyEvent('ArrowDown')) })
      expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(1)
    })

    it('prevents default on navigation keys', () => {
      const tree: FlatTreeNode[] = [
        makeFlatNode({ name: 'A', path: 'a.bru' }),
        makeFlatNode({ name: 'B', path: 'b.bru' }),
      ]
      const { result } = setup(tree)

      const event = makeKeyEvent('ArrowDown')
      act(() => { result.current.onKeyDown(event) })
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })
})
