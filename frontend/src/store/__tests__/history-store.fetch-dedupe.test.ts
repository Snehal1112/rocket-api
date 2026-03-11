import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '@/lib/api'
import { useHistoryStore } from '@/store/history'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('history-store fetch dedupe', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useHistoryStore.setState({
      entries: [],
      isLoading: false,
      error: null,
      selectedEntry: null,
    })
  })

  it('coalesces concurrent fetchHistory calls with the same limit', async () => {
    const pending = deferred<Array<{
      id: string
      method: string
      url: string
      status: number
    }>>()
    const getHistorySpy = vi.spyOn(apiService, 'getHistory').mockReturnValue(pending.promise)

    const p1 = useHistoryStore.getState().fetchHistory(50)
    const p2 = useHistoryStore.getState().fetchHistory(50)

    await Promise.resolve()
    expect(getHistorySpy).toHaveBeenCalledTimes(1)

    pending.resolve([
      { id: '1', method: 'GET', url: 'https://api.example.com', status: 200 },
    ])
    await Promise.all([p1, p2])

    expect(useHistoryStore.getState().entries).toHaveLength(1)
    expect(useHistoryStore.getState().entries[0]?.url).toBe('https://api.example.com')
  })
})
