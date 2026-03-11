import { useEffect } from 'react'
import { useCollectionsStore } from '@/store/collections'

export function useCollectionTree(collectionName?: string) {
  const result = useCollectionsStore(state => ({
    collectionTree: state.collectionTree,
    isCollectionTreeLoading: state.isCollectionTreeLoading,
    error: state.error,
    fetchCollectionTree: state.fetchCollectionTree,
  }))

  useEffect(() => {
    if (!collectionName) {
      return
    }

    result.fetchCollectionTree(collectionName)
  }, [collectionName, result])

  return result
}

export default useCollectionTree
