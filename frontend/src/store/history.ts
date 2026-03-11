import { create } from 'zustand'
import { HistoryEntry } from '@/types'
import { apiService } from '@/lib/api'

interface HistoryState {
  entries: HistoryEntry[]
  isLoading: boolean
  error: string | null
  selectedEntry: HistoryEntry | null
  
  // Actions
  fetchHistory: (limit?: number) => Promise<void>
  selectEntry: (entry: HistoryEntry | null) => void
  deleteEntry: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  loadEntryToBuilder: (entry: HistoryEntry) => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,
  selectedEntry: null,

  fetchHistory: async (limit = 50) => {
    const existingRequest = fetchHistoryInFlight.get(limit)
    if (existingRequest) {
      await existingRequest
      return
    }

    set({ isLoading: true, error: null })
    const request = apiService.getHistory(limit)
    fetchHistoryInFlight.set(limit, request)

    try {
      const entries = await request
      set({ entries, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch history',
        isLoading: false
      })
    } finally {
      fetchHistoryInFlight.delete(limit)
    }
  },

  selectEntry: (entry) => {
    set({ selectedEntry: entry })
  },

  deleteEntry: async (id) => {
    try {
      await apiService.deleteHistoryEntry(id)
      
      // Refresh the list
      const { fetchHistory } = get()
      await fetchHistory()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete entry'
      })
    }
  },

  clearHistory: async () => {
    try {
      await apiService.clearHistory()
      set({ entries: [], selectedEntry: null })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to clear history'
      })
    }
  },

  loadEntryToBuilder: (entry) => {
    // Load history entry into request builder - implementation in component
    console.log('Loading history entry:', entry)
  }
}))

const fetchHistoryInFlight = new Map<number, Promise<HistoryEntry[]>>()
