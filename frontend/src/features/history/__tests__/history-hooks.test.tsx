import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHistoryEntries } from '@/features/history/hooks/useHistoryEntries'

const {
  fetchHistoryMock,
  deleteEntryMock,
  clearHistoryMock,
  selectEntryMock,
  loadEntryToBuilderMock,
  useHistoryStoreMock,
  storeState,
} = vi.hoisted(() => {
  const fetchHistoryMock = vi.fn()
  const deleteEntryMock = vi.fn()
  const clearHistoryMock = vi.fn()
  const selectEntryMock = vi.fn()
  const loadEntryToBuilderMock = vi.fn()

  const storeState = {
    entries: [
      {
        id: 'hist-1',
        request: { method: 'GET', url: 'https://api.example.com/users' },
        response: { status: 200, statusText: 'OK', body: '[]', headers: {}, size: 2, time: 10 },
        timestamp: new Date().toISOString(),
      },
    ],
    isLoading: false,
    error: null,
    selectedEntry: null,
    fetchHistory: fetchHistoryMock,
    selectEntry: selectEntryMock,
    deleteEntry: deleteEntryMock,
    clearHistory: clearHistoryMock,
    loadEntryToBuilder: loadEntryToBuilderMock,
  }

  const useHistoryStoreMock = vi.fn((selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState
  )

  return {
    fetchHistoryMock,
    deleteEntryMock,
    clearHistoryMock,
    selectEntryMock,
    loadEntryToBuilderMock,
    useHistoryStoreMock,
    storeState,
  }
})

vi.mock('@/store/history', () => ({
  useHistoryStore: useHistoryStoreMock,
}))

describe('history feature hooks', () => {
  beforeEach(() => {
    fetchHistoryMock.mockReset()
    deleteEntryMock.mockReset()
    clearHistoryMock.mockReset()
    selectEntryMock.mockReset()
    loadEntryToBuilderMock.mockReset()
  })

  it('exposes history entries and actions through useHistoryEntries', () => {
    const { result } = renderHook(() => useHistoryEntries())

    expect(result.current.entries).toEqual(storeState.entries)
    expect(result.current.isLoading).toBe(false)

    result.current.fetchHistory(10)
    result.current.deleteEntry('hist-1')
    result.current.clearHistory()

    expect(fetchHistoryMock).toHaveBeenCalledWith(10)
    expect(deleteEntryMock).toHaveBeenCalledWith('hist-1')
    expect(clearHistoryMock).toHaveBeenCalled()
  })
})
