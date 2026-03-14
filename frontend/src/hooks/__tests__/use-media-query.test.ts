import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from '../use-media-query'

function createMockMatchMedia(matches: boolean) {
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
    removeEventListener: vi.fn((_, handler: (event: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    dispatchEvent: vi.fn(),
  }
  return {
    mql,
    listeners,
    fire(newMatches: boolean) {
      for (const listener of listeners) {
        listener({ matches: newMatches } as MediaQueryListEvent)
      }
    },
  }
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns initial match state', () => {
    const mock = createMockMatchMedia(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mock.mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('returns false when query does not match', () => {
    const mock = createMockMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mock.mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('updates when media query changes', () => {
    const mock = createMockMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mock.mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => {
      mock.fire(true)
    })
    expect(result.current).toBe(true)
  })

  it('attaches and detaches event listener', () => {
    const mock = createMockMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mock.mql as unknown as MediaQueryList)

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(mock.mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    unmount()
    expect(mock.mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('re-evaluates when query string changes', () => {
    const mock768 = createMockMatchMedia(true)
    const mock1024 = createMockMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      if (query === '(max-width: 768px)') return mock768.mql as unknown as MediaQueryList
      return mock1024.mql as unknown as MediaQueryList
    })

    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(max-width: 768px)' } }
    )
    expect(result.current).toBe(true)

    rerender({ query: '(max-width: 1024px)' })
    expect(result.current).toBe(false)
  })
})
