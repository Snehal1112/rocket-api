import { useState, useCallback, useRef, useEffect } from 'react'
import type { FlatTreeNode } from './use-flat-tree'
import type { CollectionNode } from '@/lib/api'

interface UseTreeKeyboardOptions {
  flatTree: FlatTreeNode[]
  toggleExpand: (path: string) => void
  onActivate: (node: CollectionNode) => void
  virtualizer: { scrollToIndex: (index: number) => void }
}

interface UseTreeKeyboardReturn {
  onKeyDown: (e: React.KeyboardEvent) => void
  focusedIndex: number
  setFocusedIndex: (index: number) => void
  focusedItemRef: (el: HTMLElement | null) => void
}

export function useTreeKeyboard({
  flatTree,
  toggleExpand,
  onActivate,
  virtualizer,
}: UseTreeKeyboardOptions): UseTreeKeyboardReturn {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const typeAheadBuffer = useRef('')
  const typeAheadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset focusedIndex when flatTree identity changes (React-recommended pattern)
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevFlatTree, setPrevFlatTree] = useState(flatTree)
  if (flatTree !== prevFlatTree) {
    setPrevFlatTree(flatTree)
    setFocusedIndex(0)
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (typeAheadTimeout.current !== null) {
        clearTimeout(typeAheadTimeout.current)
      }
    }
  }, [])

  // Track whether focus change was triggered by keyboard (not click)
  const keyboardTriggered = useRef(false)

  // Ref callback for the focused tree item element
  const focusedItemRef = useCallback((el: HTMLElement | null) => {
    if (el && keyboardTriggered.current) {
      el.focus({ preventScroll: true })
      keyboardTriggered.current = false
    }
  }, [])

  // Scroll to focused index when it changes
  useEffect(() => {
    if (flatTree.length > 0 && focusedIndex >= 0 && focusedIndex < flatTree.length) {
      virtualizer.scrollToIndex(focusedIndex)
    }
  }, [focusedIndex, flatTree.length, virtualizer])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatTree.length === 0) return

      const current = flatTree[focusedIndex]
      if (!current) return

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          keyboardTriggered.current = true
          setFocusedIndex(Math.min(focusedIndex + 1, flatTree.length - 1))
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          keyboardTriggered.current = true
          setFocusedIndex(Math.max(focusedIndex - 1, 0))
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          keyboardTriggered.current = true
          if (current.isFolder) {
            if (!current.isExpanded) {
              toggleExpand(current.path)
            } else {
              // Move to first child
              setFocusedIndex(Math.min(focusedIndex + 1, flatTree.length - 1))
            }
          }
          // Request: no-op
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          keyboardTriggered.current = true
          if (current.isFolder && current.isExpanded) {
            toggleExpand(current.path)
          } else if (current.parentIndex !== null) {
            setFocusedIndex(current.parentIndex)
          }
          // Top-level collapsed folder or request with no parent: no-op
          break
        }
        case 'Home': {
          e.preventDefault()
          keyboardTriggered.current = true
          setFocusedIndex(0)
          break
        }
        case 'End': {
          e.preventDefault()
          keyboardTriggered.current = true
          setFocusedIndex(flatTree.length - 1)
          break
        }
        case 'Enter': {
          e.preventDefault()
          onActivate(current.node)
          break
        }
        case ' ': {
          e.preventDefault()
          if (current.isFolder) {
            toggleExpand(current.path)
          } else {
            onActivate(current.node)
          }
          break
        }
        default: {
          // Type-ahead: printable single characters
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()

            // Clear previous timeout
            if (typeAheadTimeout.current !== null) {
              clearTimeout(typeAheadTimeout.current)
            }

            typeAheadBuffer.current += e.key
            const buffer = typeAheadBuffer.current.toLowerCase()

            // Search forward from focusedIndex + 1, wrapping
            const len = flatTree.length
            for (let offset = 1; offset <= len; offset++) {
              const idx = (focusedIndex + offset) % len
              if (flatTree[idx].node.name.toLowerCase().startsWith(buffer)) {
                keyboardTriggered.current = true
                setFocusedIndex(idx)
                break
              }
            }

            typeAheadTimeout.current = setTimeout(() => {
              typeAheadBuffer.current = ''
              typeAheadTimeout.current = null
            }, 500)
          }
          break
        }
      }
    },
    [flatTree, focusedIndex, toggleExpand, onActivate]
  )

  return { onKeyDown, focusedIndex, setFocusedIndex, focusedItemRef }
}
