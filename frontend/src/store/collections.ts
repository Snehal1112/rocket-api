import { create } from 'zustand'
import { Environment, CollectionVar } from '@/types'
import { apiService, CollectionSummary, CollectionNode } from '@/lib/api'

interface CollectionsState {
  collections: CollectionSummary[]
  collectionTree: CollectionNode | null
  environments: Environment[]
  activeCollection: CollectionSummary | null
  activeEnvironment: Environment | null
  collectionVariables: CollectionVar[]
  fetchCollectionVariables: (name: string) => Promise<void>
  saveCollectionVariables: (name: string, vars: CollectionVar[]) => Promise<void>
  consumeCollectionVariablesSelfEcho: (name: string, relativePath?: string) => boolean
  isCollectionsLoading: boolean
  isCollectionTreeLoading: boolean
  error: string | null
  
  // Actions
  fetchCollections: () => Promise<void>
  fetchCollectionTree: (name: string) => Promise<void>
  createCollection: (name: string) => Promise<void>
  deleteCollection: (name: string) => Promise<void>
  setActiveCollection: (collection: CollectionSummary | null) => void
  
  fetchEnvironments: (collection: string) => Promise<void>
  setActiveEnvironment: (environment: Environment | null) => void
  createEnvironment: (collectionName: string, name: string) => Promise<void>
  saveEnvironment: (collectionName: string, env: Environment) => Promise<void>
  deleteEnvironment: (collectionName: string, name: string) => Promise<void>

  // Import/Export
  importBruno: (file: File, name?: string) => Promise<void>
  importPostman: (collection: unknown) => Promise<void>
  exportBruno: (collection: string) => Promise<void>
  exportPostman: (collection: string) => Promise<void>
  
  setError: (error: string | null) => void
}

let fetchCollectionsInFlight: Promise<CollectionSummary[]> | null = null
const fetchCollectionTreeInFlight: Map<string, Promise<CollectionNode>> = new Map()
const fetchEnvironmentsInFlight: Map<string, Promise<Environment[]>> = new Map()
const fetchCollectionVariablesInFlight: Map<string, Promise<CollectionVar[]>> = new Map()
const collectionVariablesSelfEchoMarkers = new Map<string, number>()
const ACTIVE_COLLECTION_STORAGE_KEY = 'rocket-api:active-collection'
const COLLECTION_VARIABLES_SELF_ECHO_WINDOW_MS = 2_000

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  collectionTree: null,
  environments: [],
  activeCollection: null,
  activeEnvironment: null,
  collectionVariables: [],
  isCollectionsLoading: false,
  isCollectionTreeLoading: false,
  error: null,
  
  fetchCollections: async () => {
    if (fetchCollectionsInFlight) {
      await fetchCollectionsInFlight
      return
    }

    set({ isCollectionsLoading: true, error: null })
    fetchCollectionsInFlight = apiService.getCollections()
    try {
      const collections = await fetchCollectionsInFlight
      set({ collections, isCollectionsLoading: false })
      if (!get().activeCollection) {
        const savedCollectionName = localStorage.getItem(ACTIVE_COLLECTION_STORAGE_KEY)
        if (savedCollectionName) {
          const savedCollection = collections.find(c => c.name === savedCollectionName)
          if (savedCollection) {
            get().setActiveCollection(savedCollection)
          }
        }
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch collections',
        isCollectionsLoading: false 
      })
    } finally {
      fetchCollectionsInFlight = null
    }
  },
  
  fetchCollectionTree: async (name: string) => {
    const existingRequest = fetchCollectionTreeInFlight.get(name)
    if (existingRequest) {
      await existingRequest
      return
    }

    set({ isCollectionTreeLoading: true, error: null })
    const request = apiService.getCollection(name)
    fetchCollectionTreeInFlight.set(name, request)
    try {
      const tree = await request
      set({ collectionTree: tree, isCollectionTreeLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch collection tree',
        isCollectionTreeLoading: false 
      })
    } finally {
      fetchCollectionTreeInFlight.delete(name)
    }
  },
  
  createCollection: async (name: string) => {
    set({ isCollectionsLoading: true, error: null })
    try {
      const collection = await apiService.createCollection(name)
      set((state) => ({ 
        collections: [...state.collections, collection],
        isCollectionsLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create collection',
        isCollectionsLoading: false 
      })
    }
  },
  
  deleteCollection: async (name: string) => {
    set({ isCollectionsLoading: true, error: null })
    try {
      const wasActive = get().activeCollection?.name === name
      await apiService.deleteCollection(name)
      set((state) => ({ 
        collections: state.collections.filter(c => c.name !== name),
        activeCollection: state.activeCollection?.name === name ? null : state.activeCollection,
        isCollectionsLoading: false 
      }))
      if (wasActive) {
        localStorage.removeItem(ACTIVE_COLLECTION_STORAGE_KEY)
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete collection',
        isCollectionsLoading: false 
      })
    }
  },
  
  setActiveCollection: (collection: CollectionSummary | null) => {
    const current = get().activeCollection
    if (current?.name === collection?.name) {
      return
    }

    set({ activeCollection: collection, activeEnvironment: null, collectionVariables: [] })
    if (collection) {
      localStorage.setItem(ACTIVE_COLLECTION_STORAGE_KEY, collection.name)
    } else {
      localStorage.removeItem(ACTIVE_COLLECTION_STORAGE_KEY)
    }
    if (collection) {
      get().fetchEnvironments(collection.name).then(() => {
        // Restore last-used environment for this collection.
        const savedName = localStorage.getItem(`rocket-api:active-env:${collection.name}`)
        if (savedName) {
          const env = get().environments.find(e => e.name === savedName)
          if (env) set({ activeEnvironment: env })
        }
      })
      get().fetchCollectionVariables(collection.name)
    }
  },
  
  fetchEnvironments: async (collection: string) => {
    const existingRequest = fetchEnvironmentsInFlight.get(collection)
    if (existingRequest) {
      await existingRequest
      return
    }

    const request = (async () => {
      const envNames = await apiService.getEnvironments(collection)
      const results = await Promise.allSettled(
        envNames.map(name => apiService.getEnvironment(collection, name))
      )
      return results
        .filter(
          (result): result is PromiseFulfilledResult<Environment> =>
            result.status === 'fulfilled'
        )
        .map(result => result.value)
    })()
    fetchEnvironmentsInFlight.set(collection, request)

    try {
      const envs = await request
      set({ environments: envs })
    } catch (error) {
      console.error('Failed to fetch environments:', error)
    } finally {
      fetchEnvironmentsInFlight.delete(collection)
    }
  },
  
  setActiveEnvironment: (environment: Environment | null) => {
    set({ activeEnvironment: environment })
    const collection = get().activeCollection
    if (!collection) return
    if (environment) {
      localStorage.setItem(`rocket-api:active-env:${collection.name}`, environment.name)
    } else {
      localStorage.removeItem(`rocket-api:active-env:${collection.name}`)
    }
  },
  
  createEnvironment: async (collectionName: string, name: string) => {
    const newEnv: Environment = { id: crypto.randomUUID(), name, variables: [] }
    await apiService.saveEnvironment(collectionName, newEnv)
    await get().fetchEnvironments(collectionName)
    // Auto-select the newly created environment.
    const created = get().environments.find(e => e.name === name)
    if (created) get().setActiveEnvironment(created)
  },

  saveEnvironment: async (collectionName: string, env: Environment) => {
    await apiService.saveEnvironment(collectionName, env)
    set((state) => {
      const existingIndex = state.environments.findIndex(e => e.name === env.name)
      const environments =
        existingIndex >= 0
          ? state.environments.map(existing => (existing.name === env.name ? env : existing))
          : [...state.environments, env]
      const activeEnvironment =
        state.activeEnvironment?.name === env.name ? env : state.activeEnvironment

      return {
        environments,
        activeEnvironment,
      }
    })
  },

  deleteEnvironment: async (collectionName: string, name: string) => {
    await apiService.deleteEnvironment(collectionName, name)
    if (get().activeEnvironment?.name === name) {
      get().setActiveEnvironment(null)
    }
    await get().fetchEnvironments(collectionName)
  },

  fetchCollectionVariables: async (name: string) => {
    const existingRequest = fetchCollectionVariablesInFlight.get(name)
    if (existingRequest) {
      await existingRequest
      return
    }

    const request = apiService.getCollectionVariables(name)
    fetchCollectionVariablesInFlight.set(name, request)
    try {
      const vars = await request
      set({ collectionVariables: vars })
    } catch (error) {
      console.error('Failed to fetch collection variables:', error)
    } finally {
      fetchCollectionVariablesInFlight.delete(name)
    }
  },

  saveCollectionVariables: async (name: string, vars: CollectionVar[]) => {
    await apiService.saveCollectionVariables(name, vars)
    collectionVariablesSelfEchoMarkers.set(name, Date.now())
    set({ collectionVariables: vars })
  },

  consumeCollectionVariablesSelfEcho: (name: string, relativePath?: string) => {
    if (relativePath !== 'collection.bru') {
      return false
    }

    const markedAt = collectionVariablesSelfEchoMarkers.get(name)
    if (!markedAt) {
      return false
    }

    const isFresh =
      Date.now() - markedAt <= COLLECTION_VARIABLES_SELF_ECHO_WINDOW_MS
    collectionVariablesSelfEchoMarkers.delete(name)
    return isFresh
  },

  importBruno: async (file: File, name?: string) => {
    set({ isCollectionsLoading: true, error: null })
    try {
      const collection = await apiService.importBruno(file, name)
      set((state) => ({ 
        collections: [...state.collections, collection],
        isCollectionsLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import collection',
        isCollectionsLoading: false 
      })
    }
  },
  
  importPostman: async (collection: unknown) => {
    set({ isCollectionsLoading: true, error: null })
    try {
      const imported = await apiService.importPostman(collection)
      set((state) => ({ 
        collections: [...state.collections, imported],
        isCollectionsLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import collection',
        isCollectionsLoading: false 
      })
    }
  },
  
  exportBruno: async (collection: string) => {
    try {
      const blob = await apiService.exportBruno(collection)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collection}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to export collection'
      })
    }
  },
  
  exportPostman: async (collection: string) => {
    try {
      const data = await apiService.exportPostman(collection)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collection}.postman_collection.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to export collection'
      })
    }
  },
  
  setError: (error: string | null) => {
    set({ error })
  }
}))
