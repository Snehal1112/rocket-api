import { apiService } from '@/lib/api'

export const historyApi = {
  getHistory: (limit?: number) => apiService.getHistory(limit),
  deleteHistoryEntry: (id: string) => apiService.deleteHistoryEntry(id),
  clearHistory: () => apiService.clearHistory(),
}

export default historyApi
