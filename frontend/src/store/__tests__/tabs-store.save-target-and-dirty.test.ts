import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveRequestMock = vi.fn()
const getRequestMock = vi.fn()

vi.mock('@/lib/api', () => ({
  apiService: {
    saveRequest: saveRequestMock,
    getRequest: getRequestMock,
  },
}))

async function loadStore() {
  vi.resetModules()
  const mod = await import('@/store/tabs-store')
  return mod.useTabsStore
}

describe('tabs-store save-target and dirty semantics', () => {
  beforeEach(() => {
    saveRequestMock.mockReset()
    getRequestMock.mockReset()
    vi.useFakeTimers()
  })

  it('does not mark dirty for no-op field updates', async () => {
    const useTabsStore = await loadStore()
    const state = useTabsStore.getState()

    state.updateActiveUrl('')

    const tab = useTabsStore.getState().tabs.find(t => t.id === useTabsStore.getState().activeTabId)
    expect(tab?.kind).toBe('request')
    if (!tab || tab.kind !== 'request') throw new Error('Expected request tab')

    expect(tab.isDirty).toBe(false)
  })

  it('keeps tab dirty if request changed while save was in-flight', async () => {
    let resolveSave: ((value: { path: string }) => void) | undefined
    saveRequestMock.mockReturnValue(
      new Promise<{ path: string }>(resolve => {
        resolveSave = resolve
      })
    )

    const useTabsStore = await loadStore()
    useTabsStore.getState().updateActiveUrl('https://api.example.com/one')
    const savePromise = useTabsStore.getState().saveActiveTab('example')

    // Trigger additional edits while the previous save is still in-flight.
    useTabsStore.getState().updateActiveUrl('https://api.example.com/two')

    resolveSave?.({ path: 'requests/test.bru' })
    await savePromise
    await vi.runAllTimersAsync()

    const tab = useTabsStore.getState().tabs.find(t => t.id === useTabsStore.getState().activeTabId)
    expect(tab?.kind).toBe('request')
    if (!tab || tab.kind !== 'request') throw new Error('Expected request tab')

    expect(tab.isDirty).toBe(true)
  })

  it('applies save completion to originating tab even after switching active tab', async () => {
    let resolveSave: ((value: { path: string }) => void) | undefined
    saveRequestMock.mockReturnValue(
      new Promise<{ path: string }>(resolve => {
        resolveSave = resolve
      })
    )

    const useTabsStore = await loadStore()
    const state = useTabsStore.getState()
    const tabAId = state.activeTabId

    state.updateActiveUrl('https://api.example.com/a')
    state.newTab()
    state.updateActiveUrl('https://api.example.com/b')
    const tabBId = useTabsStore.getState().activeTabId

    state.setActiveTab(tabAId)
    const savePromise = useTabsStore.getState().saveActiveTab('example')

    useTabsStore.getState().setActiveTab(tabBId)
    resolveSave?.({ path: 'requests/a.bru' })
    await savePromise

    const latest = useTabsStore.getState()
    const tabA = latest.tabs.find(t => t.id === tabAId)
    const tabB = latest.tabs.find(t => t.id === tabBId)
    if (!tabA || tabA.kind !== 'request') throw new Error('Expected request tab A')
    if (!tabB || tabB.kind !== 'request') throw new Error('Expected request tab B')

    expect(tabA.filePath).toBe('requests/a.bru')
    expect(tabA.isDirty).toBe(false)
    expect(tabB.isDirty).toBe(true)
    expect(latest.activeTabId).toBe(tabBId)
  })

  it('focuses existing tab when request is already open instead of reopening', async () => {
    const useTabsStore = await loadStore()
    const state = useTabsStore.getState()

    state.loadRequestInActiveTab(
      {
        id: 'req-a',
        name: 'Request A',
        method: 'GET',
        url: 'https://api.example.com/a',
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        queryParams: [],
        body: { type: 'none', content: '' },
        auth: { type: 'none' },
      },
      'example',
      'requests/a.bru'
    )

    const tabAId = useTabsStore.getState().activeTabId

    state.newTab()
    const tabBId = useTabsStore.getState().activeTabId
    expect(tabBId).not.toBe(tabAId)

    await useTabsStore.getState().loadRequestFromPath('example', 'requests/a.bru')

    const latest = useTabsStore.getState()
    expect(latest.activeTabId).toBe(tabAId)
    expect(latest.tabs.length).toBe(2)
    expect(getRequestMock).not.toHaveBeenCalled()
  })
})
