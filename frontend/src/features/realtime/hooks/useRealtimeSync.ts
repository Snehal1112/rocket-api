import { useCallback, useEffect } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useCollectionsStore } from '@/store/collections'
import { getRuntimeConfig } from '@/lib/runtime-config'
import { routeRealtimeFileChange } from '@/features/realtime/lib/event-routing'

const runtimeConfig = getRuntimeConfig()

export function useRealtimeSync() {
  const activeCollection = useCollectionsStore(state => state.activeCollection)
  const fetchCollections = useCollectionsStore(state => state.fetchCollections)
  const {
    send: sendWebSocketMessage,
    isConnected: isWebSocketConnected,
  } = useWebSocket(runtimeConfig.wsUrl, {
    onMessage: (message) => {
      if (message.type !== 'file_change') {
        return
      }

      console.log('File changed:', message)
      const store = useCollectionsStore.getState()
      routeRealtimeFileChange(
        message as { collection?: string; data?: { relativePath?: string; type?: string } },
        {
          activeCollectionName: activeCollection?.name,
          fetchCollections,
          fetchCollectionTree: store.fetchCollectionTree,
          fetchEnvironments: store.fetchEnvironments,
          fetchCollectionVariables: store.fetchCollectionVariables,
          consumeCollectionVariablesSelfEcho: store.consumeCollectionVariablesSelfEcho,
        }
      )
    },
    onConnect: () => {
      console.log('WebSocket connected - real-time sync enabled')
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - real-time sync disabled')
    },
  })

  const syncWebSocketSubscription = useCallback(() => {
    if (!isWebSocketConnected) {
      return
    }

    if (activeCollection?.name) {
      sendWebSocketMessage({
        type: 'subscribe',
        collection: activeCollection.name,
      })
      return
    }

    sendWebSocketMessage({ type: 'unsubscribe' })
  }, [activeCollection?.name, isWebSocketConnected, sendWebSocketMessage])

  useEffect(() => {
    syncWebSocketSubscription()
  }, [syncWebSocketSubscription])
}

export default useRealtimeSync
