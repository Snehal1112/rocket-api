import { useState, useEffect, useCallback } from 'react'
import { useMediaQuery } from './use-media-query'

export const SIDEBAR_WIDTH_STORAGE_KEY = 'rocket-api:sidebar-width'
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'rocket-api:sidebar-collapsed'
export const DEFAULT_SIDEBAR_WIDTH = 288
export const MIN_SIDEBAR_WIDTH = 220
export const MAX_SIDEBAR_WIDTH = 520

export function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function getInitialSidebarWidth() {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH
  const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
  if (!Number.isFinite(stored)) return DEFAULT_SIDEBAR_WIDTH
  return stored >= MIN_SIDEBAR_WIDTH && stored <= MAX_SIDEBAR_WIDTH
    ? stored
    : DEFAULT_SIDEBAR_WIDTH
}

function getInitialCollapsed() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
}

export type OverlayTab = 'collections' | 'history'

export interface SidebarState {
  isCollapsed: boolean
  isOverlayOpen: boolean
  overlayTab: OverlayTab
  sidebarWidth: number
  isSidebarResizing: boolean
  toggle: () => void
  openOverlay: (tab: OverlayTab) => void
  closeOverlay: () => void
  setSidebarWidth: (width: number) => void
  startResizing: () => void
}

export function useSidebarState(): SidebarState {
  const isNarrow = useMediaQuery('(max-width: 768px)')
  const [isCollapsedManual, setIsCollapsedManual] = useState(getInitialCollapsed)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [overlayTab, setOverlayTab] = useState<OverlayTab>('collections')
  const [sidebarWidth, setSidebarWidthRaw] = useState(getInitialSidebarWidth)
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)

  const isCollapsed = isNarrow || isCollapsedManual

  // Persist collapsed state
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsedManual))
  }, [isCollapsedManual])

  // Persist sidebar width
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  // Pointer resize logic
  useEffect(() => {
    if (!isSidebarResizing) return

    const handlePointerMove = (event: PointerEvent) => {
      setSidebarWidthRaw(clampSidebarWidth(event.clientX))
    }
    const handlePointerUp = () => {
      setIsSidebarResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isSidebarResizing])

  const toggle = useCallback(() => {
    setIsCollapsedManual(prev => !prev)
  }, [])

  const openOverlay = useCallback((tab: OverlayTab) => {
    setOverlayTab(tab)
    setIsOverlayOpen(true)
  }, [])

  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false)
  }, [])

  const setSidebarWidth = useCallback((width: number) => {
    setSidebarWidthRaw(clampSidebarWidth(width))
  }, [])

  const startResizing = useCallback(() => {
    setIsSidebarResizing(true)
  }, [])

  return {
    isCollapsed,
    isOverlayOpen: isCollapsed && isOverlayOpen,
    overlayTab,
    sidebarWidth,
    isSidebarResizing,
    toggle,
    openOverlay,
    closeOverlay,
    setSidebarWidth,
    startResizing,
  }
}
