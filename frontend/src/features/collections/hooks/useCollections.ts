import { useCollectionsStore } from '@/store/collections'

export function useCollections() {
  return useCollectionsStore(state => ({
    collections: state.collections,
    activeCollection: state.activeCollection,
    isCollectionsLoading: state.isCollectionsLoading,
    error: state.error,
    fetchCollections: state.fetchCollections,
    createCollection: state.createCollection,
    deleteCollection: state.deleteCollection,
    setActiveCollection: state.setActiveCollection,
    exportBruno: state.exportBruno,
    exportPostman: state.exportPostman,
  }))
}

export default useCollections
