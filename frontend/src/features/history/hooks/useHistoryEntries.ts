import { useShallow } from 'zustand/react/shallow'
import { useHistoryStore } from '@/store/history'

export function useHistoryEntries() {
  return useHistoryStore(useShallow(state => ({
    entries: state.entries,
    isLoading: state.isLoading,
    error: state.error,
    selectedEntry: state.selectedEntry,
    fetchHistory: state.fetchHistory,
    selectEntry: state.selectEntry,
    deleteEntry: state.deleteEntry,
    clearHistory: state.clearHistory,
    loadEntryToBuilder: state.loadEntryToBuilder,
  })))
}

export default useHistoryEntries
