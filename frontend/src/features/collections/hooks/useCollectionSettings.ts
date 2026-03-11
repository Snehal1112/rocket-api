import { useEffect } from 'react'
import { useCollectionsStore } from '@/store/collections'

export function useCollectionSettings(collectionName?: string) {
  const result = useCollectionsStore(state => ({
    environments: state.environments,
    activeEnvironment: state.activeEnvironment,
    collectionVariables: state.collectionVariables,
    fetchEnvironments: state.fetchEnvironments,
    setActiveEnvironment: state.setActiveEnvironment,
    createEnvironment: state.createEnvironment,
    saveEnvironment: state.saveEnvironment,
    deleteEnvironment: state.deleteEnvironment,
    fetchCollectionVariables: state.fetchCollectionVariables,
    saveCollectionVariables: state.saveCollectionVariables,
  }))

  useEffect(() => {
    if (!collectionName) {
      return
    }

    result.fetchEnvironments(collectionName)
    result.fetchCollectionVariables(collectionName)
  }, [collectionName, result])

  return result
}

export default useCollectionSettings
