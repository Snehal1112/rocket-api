interface FileChangeMessage {
  collection?: string
  data?: { relativePath?: string; type?: string }
}

interface EventRoutingDeps {
  activeCollectionName?: string
  fetchCollections: () => void
  fetchCollectionTree: (name: string) => void
  fetchEnvironments: (name: string) => void
  fetchCollectionVariables: (name: string) => void
  consumeCollectionVariablesSelfEcho: (name: string, relativePath?: string) => boolean
}

export function routeRealtimeFileChange(
  message: FileChangeMessage,
  deps: EventRoutingDeps
) {
  const relativePath = message.data?.relativePath ?? ''
  const activeCollectionName = deps.activeCollectionName

  if (relativePath.startsWith('environments/')) {
    if (activeCollectionName && message.collection === activeCollectionName) {
      deps.fetchEnvironments(activeCollectionName)
    }
    return
  }

  if (relativePath === 'collection.bru') {
    if (activeCollectionName && message.collection === activeCollectionName) {
      if (deps.consumeCollectionVariablesSelfEcho(activeCollectionName, relativePath)) {
        return
      }
      deps.fetchCollectionVariables(activeCollectionName)
    }
    return
  }

  if (!relativePath.includes('/') && relativePath !== '' && !relativePath.includes('.')) {
    deps.fetchCollections()
    return
  }

  if (activeCollectionName && message.collection === activeCollectionName) {
    deps.fetchCollectionTree(activeCollectionName)
  }
}

export default routeRealtimeFileChange
