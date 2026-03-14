import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCollectionsStore } from '@/store/collections'

export function useCollectionSettings(collectionName?: string) {
  const state = useCollectionsStore(useShallow(s => ({
    environments: s.environments,
    activeEnvironment: s.activeEnvironment,
    collectionVariables: s.collectionVariables,
    fetchEnvironments: s.fetchEnvironments,
    fetchEnvironmentDetail: s.fetchEnvironmentDetail,
    setActiveEnvironment: s.setActiveEnvironment,
    createEnvironment: s.createEnvironment,
    saveEnvironment: s.saveEnvironment,
    deleteEnvironment: s.deleteEnvironment,
    fetchCollectionVariables: s.fetchCollectionVariables,
    saveCollectionVariables: s.saveCollectionVariables,
  })))

  const { fetchEnvironments, fetchCollectionVariables } = state

  useEffect(() => {
    if (!collectionName) {
      return
    }

    fetchEnvironments(collectionName)
    fetchCollectionVariables(collectionName)
  }, [collectionName, fetchEnvironments, fetchCollectionVariables])

  return state
}

export default useCollectionSettings
