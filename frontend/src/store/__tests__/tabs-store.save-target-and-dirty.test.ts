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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('tabs-store save-target and dirty semantics', () => {
  beforeEach(() => {
    saveRequestMock.mockReset()
    getRequestMock.mockReset()
    localStorage.clear()
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

  it('includes scripts in save payload', async () => {
    saveRequestMock.mockResolvedValue({ path: 'requests/scripted.bru' })

    const useTabsStore = await loadStore()
    useTabsStore.getState().updateActiveScripts({
      language: 'typescript',
      preRequest: "pm.environment.set('token', 'abc')",
      postResponse: "pm.test('ok', () => {})",
    })

    await useTabsStore.getState().saveActiveTab('example')

    expect(saveRequestMock).toHaveBeenCalledTimes(1)
    const [, , bruFile] = saveRequestMock.mock.calls[0]
    expect(bruFile.scripts).toEqual({
      language: 'typescript',
      preRequest: "pm.environment.set('token', 'abc')",
      postResponse: "pm.test('ok', () => {})",
    })
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

  it('opens different requests from same collection in separate tabs', async () => {
    const reqA = deferred<{
      meta: { name: string }
      http: { method: 'GET'; url: string; headers: Array<{ key: string; value: string }> }
      body: { type: 'none'; data: '' }
    }>()
    const reqB = deferred<{
      meta: { name: string }
      http: { method: 'GET'; url: string; headers: Array<{ key: string; value: string }> }
      body: { type: 'none'; data: '' }
    }>()

    getRequestMock.mockImplementation((collectionName: string, path: string) => {
      if (collectionName !== 'example') throw new Error(`Unexpected collection: ${collectionName}`)
      if (path === 'requests/a.bru') return reqA.promise
      if (path === 'requests/b.bru') return reqB.promise
      throw new Error(`Unexpected path: ${path}`)
    })

    const useTabsStore = await loadStore()
    const baseTabCount = useTabsStore.getState().tabs.length

    const loadA = useTabsStore.getState().loadRequestFromPath('example', 'requests/a.bru')
    reqA.resolve({
      meta: { name: 'Request A' },
      http: {
        method: 'GET',
        url: 'https://api.example.com/a',
        headers: [{ key: 'Accept', value: 'application/json' }],
      },
      body: { type: 'none', data: '' },
    })
    await loadA

    const afterA = useTabsStore.getState()
    const afterATabCount = afterA.tabs.length

    const loadB = useTabsStore.getState().loadRequestFromPath('example', 'requests/b.bru')
    reqB.resolve({
      meta: { name: 'Request B' },
      http: {
        method: 'GET',
        url: 'https://api.example.com/b',
        headers: [{ key: 'Accept', value: 'application/json' }],
      },
      body: { type: 'none', data: '' },
    })
    await loadB

    const latest = useTabsStore.getState()
    const requestTabs = latest.tabs.filter(t => t.kind === 'request')
    const matchingTabs = requestTabs.filter(
      t =>
        t.collectionName === 'example' &&
        (t.filePath === 'requests/a.bru' || t.filePath === 'requests/b.bru')
    )

    expect(afterATabCount).toBe(baseTabCount + 1)
    expect(latest.tabs.length).toBe(afterATabCount + 1)
    expect(matchingTabs).toHaveLength(2)
    expect(matchingTabs.map(t => t.filePath).sort()).toEqual([
      'requests/a.bru',
      'requests/b.bru',
    ])
  })

  it('focuses already-open request instead of opening duplicate tab', async () => {
    const req = deferred<{
      meta: { name: string }
      http: { method: 'GET'; url: string; headers: Array<{ key: string; value: string }> }
      body: { type: 'none'; data: '' }
    }>()
    getRequestMock.mockImplementation((collectionName: string, path: string) => {
      if (collectionName !== 'example') throw new Error(`Unexpected collection: ${collectionName}`)
      if (path !== 'requests/a.bru') throw new Error(`Unexpected path: ${path}`)
      return req.promise
    })

    const useTabsStore = await loadStore()
    const baseTabCount = useTabsStore.getState().tabs.length

    const firstLoad = useTabsStore.getState().loadRequestFromPath('example', 'requests/a.bru')
    req.resolve({
      meta: { name: 'Request A' },
      http: {
        method: 'GET',
        url: 'https://api.example.com/a',
        headers: [{ key: 'Accept', value: 'application/json' }],
      },
      body: { type: 'none', data: '' },
    })
    await firstLoad

    const afterFirst = useTabsStore.getState()
    const existingTab = afterFirst.tabs.find(
      t => t.kind === 'request' && t.collectionName === 'example' && t.filePath === 'requests/a.bru'
    )
    if (!existingTab || existingTab.kind !== 'request') throw new Error('Expected opened request tab')

    afterFirst.newTab()
    const tempTabId = useTabsStore.getState().activeTabId
    expect(tempTabId).not.toBe(existingTab.id)

    await useTabsStore.getState().loadRequestFromPath('example', 'requests/a.bru')

    const latest = useTabsStore.getState()
    expect(latest.activeTabId).toBe(existingTab.id)
    expect(latest.tabs.length).toBe(baseTabCount + 2)
    expect(getRequestMock).toHaveBeenCalledTimes(1)
  })

  it('restores persisted tab session with active tab on reload', async () => {
    localStorage.setItem(
      'rocket-api:tabs-session:v1',
      JSON.stringify({
        state: {
          tabs: [
            {
              kind: 'request',
              id: 'tab-request',
              request: {
                id: 'req-1',
                name: 'Persisted Request',
                method: 'GET',
                url: 'https://api.example.com/persisted',
                headers: [],
                queryParams: [],
                pathParams: [],
                body: { type: 'none', content: '' },
                auth: { type: 'none' },
              },
              response: null,
              isDirty: false,
              isLoading: false,
              collectionName: 'example',
              filePath: 'requests/persisted.bru',
              lastSavedSnapshot: '{}',
            },
            {
              kind: 'collection-overview',
              id: 'tab-overview',
              collectionName: 'example',
            },
          ],
          activeTabId: 'tab-overview',
        },
        version: 0,
      })
    )

    const useTabsStore = await loadStore()
    const state = useTabsStore.getState()

    expect(state.tabs).toHaveLength(2)
    expect(state.activeTabId).toBe('tab-overview')
  })

  it('falls back to valid active tab when persisted active id is invalid', async () => {
    localStorage.setItem(
      'rocket-api:tabs-session:v1',
      JSON.stringify({
        state: {
          tabs: [
            {
              kind: 'request',
              id: 'tab-request',
              request: {
                id: 'req-1',
                name: 'Persisted Request',
                method: 'GET',
                url: 'https://api.example.com/persisted',
                headers: [],
                queryParams: [],
                pathParams: [],
                body: { type: 'none', content: '' },
                auth: { type: 'none' },
              },
              response: null,
              isDirty: false,
              isLoading: false,
              lastSavedSnapshot: '{}',
            },
          ],
          activeTabId: 'missing-tab-id',
        },
        version: 0,
      })
    )

    const useTabsStore = await loadStore()
    const state = useTabsStore.getState()

    expect(state.tabs).toHaveLength(1)
    expect(state.activeTabId).toBe('tab-request')
  })
})
