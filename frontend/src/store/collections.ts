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
  isLoading: boolean
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

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  collectionTree: null,
  environments: [],
  activeCollection: null,
  activeEnvironment: null,
  collectionVariables: [],
  isLoading: false,
  error: null,
  
  fetchCollections: async () => {
    set({ isLoading: true, error: null })
    try {
      const collections = await apiService.getCollections()
      set({ collections, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch collections',
        isLoading: false 
      })
    }
  },
  
  fetchCollectionTree: async (name: string) => {
    set({ isLoading: true, error: null })
    try {
      const tree = await apiService.getCollection(name)
      set({ collectionTree: tree, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch collection tree',
        isLoading: false 
      })
    }
  },
  
  createCollection: async (name: string) => {
    set({ isLoading: true, error: null })
    try {
      const collection = await apiService.createCollection(name)
      set((state) => ({ 
        collections: [...state.collections, collection],
        isLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create collection',
        isLoading: false 
      })
    }
  },
  
  deleteCollection: async (name: string) => {
    set({ isLoading: true, error: null })
    try {
      await apiService.deleteCollection(name)
      set((state) => ({ 
        collections: state.collections.filter(c => c.name !== name),
        activeCollection: state.activeCollection?.name === name ? null : state.activeCollection,
        isLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete collection',
        isLoading: false 
      })
    }
  },
  
  setActiveCollection: (collection: CollectionSummary | null) => {
    set({ activeCollection: collection, activeEnvironment: null, collectionVariables: [] })
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
    try {
      const envNames = await apiService.getEnvironments(collection)
      const envs: Environment[] = []
      for (const name of envNames) {
        try {
          const env = await apiService.getEnvironment(collection, name)
          envs.push(env)
        } catch {
          // Skip environments that fail to load
        }
      }
      set({ environments: envs })
    } catch (error) {
      console.error('Failed to fetch environments:', error)
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
    await get().fetchEnvironments(collectionName)
    // Keep activeEnvironment in sync with the refreshed list.
    if (get().activeEnvironment?.name === env.name) {
      const updated = get().environments.find(e => e.name === env.name) ?? null
      set({ activeEnvironment: updated })
    }
  },

  deleteEnvironment: async (collectionName: string, name: string) => {
    await apiService.deleteEnvironment(collectionName, name)
    if (get().activeEnvironment?.name === name) {
      get().setActiveEnvironment(null)
    }
    await get().fetchEnvironments(collectionName)
  },

  fetchCollectionVariables: async (name: string) => {
    try {
      const vars = await apiService.getCollectionVariables(name)
      set({ collectionVariables: vars })
    } catch (error) {
      console.error('Failed to fetch collection variables:', error)
    }
  },

  saveCollectionVariables: async (name: string, vars: CollectionVar[]) => {
    await apiService.saveCollectionVariables(name, vars)
    set({ collectionVariables: vars })
  },

  importBruno: async (file: File, name?: string) => {
    set({ isLoading: true, error: null })
    try {
      const collection = await apiService.importBruno(file, name)
      set((state) => ({ 
        collections: [...state.collections, collection],
        isLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import collection',
        isLoading: false 
      })
    }
  },
  
  importPostman: async (collection: unknown) => {
    set({ isLoading: true, error: null })
    try {
      const imported = await apiService.importPostman(collection)
      set((state) => ({ 
        collections: [...state.collections, imported],
        isLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to import collection',
        isLoading: false 
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