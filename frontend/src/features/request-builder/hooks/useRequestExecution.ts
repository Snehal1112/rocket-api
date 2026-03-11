import { useCallback } from 'react'
import type { CollectionVar, Environment, HttpRequest, HttpResponse } from '@/types'
import { useCollectionsStore } from '@/store/collections'
import { useHistoryStore } from '@/store/history'
import { sendRequestWithFallback } from '@/features/request-builder/api/requestExecutionApi'

interface RequestExecutionOptions {
  onRequestSent?: (request: HttpRequest, response: HttpResponse) => void
}

function applyScriptVariableUpdates(
  activeEnvironment: Environment | null,
  collectionVariables: CollectionVar[],
  scriptVars: Record<string, string>
) {
  const nextEnvironment = activeEnvironment
    ? {
        ...activeEnvironment,
        variables: activeEnvironment.variables.map(variable => ({ ...variable })),
      }
    : null
  const nextCollectionVariables = collectionVariables.map(variable => ({ ...variable }))

  let environmentChanged = false
  let collectionChanged = false

  for (const [key, value] of Object.entries(scriptVars)) {
    const envIndex =
      nextEnvironment?.variables.findIndex(variable => variable.key === key) ?? -1
    if (nextEnvironment && envIndex >= 0) {
      const current = nextEnvironment.variables[envIndex]
      if (current.value !== value || !current.enabled) {
        nextEnvironment.variables[envIndex] = {
          ...current,
          value,
          enabled: true,
        }
        environmentChanged = true
      }
      continue
    }

    const collectionIndex = nextCollectionVariables.findIndex(variable => variable.key === key)
    if (collectionIndex >= 0) {
      const current = nextCollectionVariables[collectionIndex]
      if (current.value !== value || !current.enabled) {
        nextCollectionVariables[collectionIndex] = {
          ...current,
          value,
          enabled: true,
        }
        collectionChanged = true
      }
      continue
    }

    if (nextEnvironment) {
      nextEnvironment.variables.push({
        key,
        value,
        enabled: true,
        secret: false,
      })
      environmentChanged = true
      continue
    }

    nextCollectionVariables.push({
      key,
      value,
      enabled: true,
      secret: false,
    })
    collectionChanged = true
  }

  return {
    nextEnvironment,
    nextCollectionVariables,
    environmentChanged,
    collectionChanged,
  }
}

export function useRequestExecution({ onRequestSent }: RequestExecutionOptions = {}) {
  return useCallback(async (request: HttpRequest, envVars: Record<string, string>) => {
    const { response } = await sendRequestWithFallback(request, envVars)

    const { fetchHistory } = useHistoryStore.getState()
    fetchHistory()

    const scriptVars: Record<string, string> = {
      ...(response.preScriptResult?.variables ?? {}),
      ...(response.scriptResult?.variables ?? {}),
    }
    const latestStore = useCollectionsStore.getState()
    if (latestStore.activeCollection && Object.keys(scriptVars).length > 0) {
      const {
        nextEnvironment,
        nextCollectionVariables,
        environmentChanged,
        collectionChanged,
      } = applyScriptVariableUpdates(
        latestStore.activeEnvironment,
        latestStore.collectionVariables,
        scriptVars
      )

      if (environmentChanged && nextEnvironment) {
        await latestStore.saveEnvironment(latestStore.activeCollection.name, nextEnvironment)
      }

      if (collectionChanged) {
        await latestStore.saveCollectionVariables(
          latestStore.activeCollection.name,
          nextCollectionVariables
        )
      }
    }

    onRequestSent?.(request, response)
    return response
  }, [onRequestSent])
}

export default useRequestExecution
