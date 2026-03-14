import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSidebarState, SIDEBAR_COLLAPSED_STORAGE_KEY, SIDEBAR_WIDTH_STORAGE_KEY } from '../use-sidebar-state'

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(event: MediaQueryListEvent) => void> = []
  const mql = {
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_, handler: (event: MediaQueryListEvent) => void) => {
      listeners.push(handler)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)
  return {
    mql,
    setMatches(newMatches: boolean) {
      mql.matches = newMatches
      for (const listener of listeners) {
        listener({ matches: newMatches } as MediaQueryListEvent)
      }
    },
  }
}

describe('useSidebarState', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('starts expanded on wide screen with no stored state', () => {
    mockMatchMedia(false) // wide screen
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.isCollapsed).toBe(false)
    expect(result.current.isOverlayOpen).toBe(false)
  })

  it('auto-collapses on narrow screen regardless of stored state', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false')
    mockMatchMedia(true) // narrow screen
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.isCollapsed).toBe(true)
  })

  it('restores collapsed state from localStorage on wide screen', () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true')
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.isCollapsed).toBe(true)
  })

  it('toggle() toggles collapsed state', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.isCollapsed).toBe(false)

    act(() => result.current.toggle())
    expect(result.current.isCollapsed).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.isCollapsed).toBe(false)
  })

  it('persists collapsed state to localStorage', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    act(() => result.current.toggle())
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true')

    act(() => result.current.toggle())
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false')
  })

  it('openOverlay sets isOverlayOpen and overlayTab', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    act(() => result.current.toggle()) // collapse first
    act(() => result.current.openOverlay('history'))
    expect(result.current.isOverlayOpen).toBe(true)
    expect(result.current.overlayTab).toBe('history')
  })

  it('openOverlay switches tab without closing when already open', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    act(() => result.current.toggle())
    act(() => result.current.openOverlay('collections'))
    expect(result.current.isOverlayOpen).toBe(true)
    expect(result.current.overlayTab).toBe('collections')

    act(() => result.current.openOverlay('history'))
    expect(result.current.isOverlayOpen).toBe(true)
    expect(result.current.overlayTab).toBe('history')
  })

  it('closeOverlay sets isOverlayOpen to false', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    act(() => result.current.toggle())
    act(() => result.current.openOverlay('collections'))
    expect(result.current.isOverlayOpen).toBe(true)

    act(() => result.current.closeOverlay())
    expect(result.current.isOverlayOpen).toBe(false)
  })

  it('restores sidebar width from localStorage', () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '350')
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())
    expect(result.current.sidebarWidth).toBe(350)
  })

  it('clamps sidebar width to valid range', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    act(() => result.current.setSidebarWidth(100))
    expect(result.current.sidebarWidth).toBe(220) // MIN

    act(() => result.current.setSidebarWidth(1000))
    expect(result.current.sidebarWidth).toBe(520) // MAX
  })

  it('persists sidebar width to localStorage', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    act(() => result.current.setSidebarWidth(400))
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('400')
  })

  it('closes overlay when expanding (un-collapsing)', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSidebarState())

    // Collapse, open overlay, then expand
    act(() => result.current.toggle())
    act(() => result.current.openOverlay('collections'))
    expect(result.current.isOverlayOpen).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.isCollapsed).toBe(false)
    expect(result.current.isOverlayOpen).toBe(false)
  })
})
