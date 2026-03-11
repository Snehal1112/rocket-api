import { apiService } from '@/lib/api'
import type { Environment, CollectionVar } from '@/types'

export const collectionsApi = {
  getCollections: () => apiService.getCollections(),
  getCollectionTree: (name: string) => apiService.getCollection(name),
  getEnvironments: (collection: string) => apiService.getEnvironments(collection),
  getEnvironment: (collection: string, name: string) =>
    apiService.getEnvironment(collection, name),
  saveEnvironment: (collection: string, env: Environment) =>
    apiService.saveEnvironment(collection, env),
  deleteEnvironment: (collection: string, name: string) =>
    apiService.deleteEnvironment(collection, name),
  getCollectionVariables: (name: string) => apiService.getCollectionVariables(name),
  saveCollectionVariables: (name: string, vars: CollectionVar[]) =>
    apiService.saveCollectionVariables(name, vars),
}

export default collectionsApi
