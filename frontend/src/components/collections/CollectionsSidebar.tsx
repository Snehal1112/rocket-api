import { useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCollections } from '@/features/collections/hooks/useCollections'
import { useCollectionTree } from '@/features/collections/hooks/useCollectionTree'
import { useHistoryEntries } from '@/features/history/hooks/useHistoryEntries'
import { useTabsStore } from '@/store/tabs-store'
import { BruFile } from '@/types'
import { apiService } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Database,
  Folder,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  Clock,
  Upload,
  Download,
  Trash2,
  Loader2,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TreeNode {
  name: string
  type: 'collection' | 'folder' | 'request' | 'environment' | 'file'
  path?: string
  method?: string
  children?: TreeNode[]
}

interface CollectionsSidebarProps {
  width?: number
}

export function CollectionsSidebar({ width = 288 }: CollectionsSidebarProps) {
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [createNodeDialog, setCreateNodeDialog] = useState<{
    isOpen: boolean
    kind: 'folder' | 'request'
    collectionName: string | null
    parentPath: string | null
  }>({
    isOpen: false,
    kind: 'folder',
    collectionName: null,
    parentPath: null,
  })
  const [newNodeName, setNewNodeName] = useState('')
  
  // Alert dialog state
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {} })
  
  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; node: TreeNode | null }>({
    isOpen: false,
    node: null,
  })
  const [renameValue, setRenameValue] = useState('')

  // History store
  const {
    entries: historyEntries, 
    isLoading: historyLoading, 
    fetchHistory 
  } = useHistoryEntries()
  
  const { 
    collections, 
    activeCollection, 
    isCollectionsLoading,
    error,
    fetchCollections,
    createCollection,
    deleteCollection,
    setActiveCollection,
    importBruno,
    exportBruno
  } = useCollections()
  const {
    collectionTree,
    isCollectionTreeLoading,
    fetchCollectionTree,
  } = useCollectionTree(activeCollection?.name)
  
  const { loadRequestFromPath, loadRequestInActiveTab, openCollectionOverview } = useTabsStore()

  const { collectionName: activeTabCollectionName, filePath: activeTabFilePath } =
    useTabsStore(useShallow(state => {
      const tab = state.tabs.find(t => t.id === state.activeTabId)
      if (!tab || tab.kind !== 'request') {
        return { collectionName: null, filePath: null }
      }
      return {
        collectionName: tab.collectionName ?? null,
        filePath: tab.filePath ?? null,
      }
    }))

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  // Fetch history when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, fetchHistory])

  // Keep the matching collection expanded whenever an opened request tab becomes active.
  useEffect(() => {
    if (!activeTabCollectionName) return
    const matchingCollection = collections.find(c => c.name === activeTabCollectionName)
    if (!matchingCollection) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedCollectionId(prev =>
      prev === matchingCollection.id ? prev : matchingCollection.id
    )
  }, [activeTabCollectionName, collections])

  // Expand parent folders so the active request is visible and selected in the tree.
  useEffect(() => {
    if (!activeTabFilePath || !collectionTree?.children) return
    if (!activeTabCollectionName || activeCollection?.name !== activeTabCollectionName) return

    const findFolderAncestors = (
      nodes: TreeNode[],
      requestPath: string,
      parentFolders: string[]
    ): string[] | null => {
      for (const node of nodes) {
        if (node.type === 'request' && node.path === requestPath) {
          return parentFolders
        }
        if ((node.type === 'folder' || node.type === 'collection') && node.children) {
          const folderKey = node.path || node.name
          const nextParents =
            node.type === 'folder' ? [...parentFolders, folderKey] : parentFolders
          const result = findFolderAncestors(node.children, requestPath, nextParents)
          if (result) return result
        }
      }
      return null
    }

    const folderAncestors = findFolderAncestors(collectionTree.children, activeTabFilePath, [])
    if (!folderAncestors) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedFolders(prev => {
      let changed = false
      const next = new Set(prev)
      for (const folder of folderAncestors) {
        if (!next.has(folder)) {
          next.add(folder)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [
    activeCollection?.name,
    activeTabCollectionName,
    activeTabFilePath,
    collectionTree,
  ])

  const toggleCollection = (id: string) => {
    setExpandedCollectionId(prev => {
      if (prev === id) return null
      // Switching to a different collection — clear folder state.
      setExpandedFolders(new Set())
      return id
    })
  }

  const handleCreateCollection = () => {
    setNewCollectionName('')
    setIsCreateDialogOpen(true)
  }

  const handleSubmitCreate = async () => {
    if (newCollectionName.trim()) {
      await createCollection(newCollectionName.trim())
      setIsCreateDialogOpen(false)
      setNewCollectionName('')
    }
  }

  const handleDeleteCollection = (name: string) => {
    setAlertDialog({
      isOpen: true,
      title: 'Delete Collection',
      description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteCollection(name)
        setAlertDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const openCreateNodeDialog = (
    kind: 'folder' | 'request',
    collectionName: string,
    parentPath: string | null
  ) => {
    setCreateNodeDialog({
      isOpen: true,
      kind,
      collectionName,
      parentPath,
    })
    setNewNodeName('')
  }

  const expandFoldersForPath = (fileOrFolderPath: string, isRequestPath: boolean) => {
    const parts = fileOrFolderPath.split('/').filter(Boolean)
    const folderParts = isRequestPath ? parts.slice(0, -1) : parts
    if (folderParts.length === 0) return

    const foldersToExpand: string[] = []
    for (let i = 0; i < folderParts.length; i += 1) {
      foldersToExpand.push(folderParts.slice(0, i + 1).join('/'))
    }

    setExpandedFolders(prev => {
      const next = new Set(prev)
      for (const folderPath of foldersToExpand) {
        next.add(folderPath)
      }
      return next
    })
  }

  const handleSubmitCreateNode = async () => {
    const nodeName = newNodeName.trim()
    const { collectionName, parentPath, kind } = createNodeDialog
    if (!collectionName || !nodeName) return

    try {
      const result =
        kind === 'folder'
          ? await apiService.createFolder(collectionName, parentPath ?? undefined, nodeName)
          : await apiService.createRequest(collectionName, parentPath ?? undefined, nodeName)

      const collection = collections.find(c => c.name === collectionName)
      if (collection) {
        setExpandedCollectionId(collection.id)
        if (!activeCollection || activeCollection.name !== collectionName) {
          setActiveCollection(collection)
        }
      }

      expandFoldersForPath(result.path, kind === 'request')
      await fetchCollectionTree(collectionName)

      if (kind === 'request') {
        await loadRequestFromPath(collectionName, result.path)
      }

      setCreateNodeDialog({
        isOpen: false,
        kind: 'folder',
        collectionName: null,
        parentPath: null,
      })
      setNewNodeName('')
    } catch (error) {
      console.error(`Failed to create ${kind}:`, error)
      setAlertDialog({
        isOpen: true,
        title: `Create ${kind === 'folder' ? 'Folder' : 'Request'} Failed`,
        description:
          error instanceof Error ? error.message : `Unable to create ${kind}. Please try again.`,
        onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })),
      })
    }
  }

  const handleRenameConfirm = async () => {
    const node = renameDialog.node
    if (!node || !node.path || !activeCollection || !renameValue.trim()) return
    try {
      const bruFile = await apiService.getRequest(activeCollection.name, node.path) as BruFile
      bruFile.meta.name = renameValue.trim()
      await apiService.saveRequest(activeCollection.name, node.path, bruFile)
      await fetchCollectionTree(activeCollection.name)
    } catch (error) {
      console.error('Failed to rename request:', error)
    }
    setRenameDialog({ isOpen: false, node: null })
  }

  const handleImportBruno = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        await importBruno(file)
      }
    }
    input.click()
  }

  const handleExportBruno = async (name: string) => {
    await exportBruno(name)
  }

  const getMethodColor = (method?: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300',
      POST: 'bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300',
      PUT: 'bg-blue-500/12 text-blue-700 dark:bg-blue-500/18 dark:text-blue-300',
      DELETE: 'bg-rose-500/12 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300',
      PATCH: 'bg-violet-500/12 text-violet-700 dark:bg-violet-500/18 dark:text-violet-300',
      HEAD: 'bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300',
      OPTIONS: 'bg-cyan-500/12 text-cyan-700 dark:bg-cyan-500/18 dark:text-cyan-300',
    }
    return colors[method?.toUpperCase() || 'GET'] || 'bg-muted text-muted-foreground'
  }

  const filteredCollections = (collections || []).filter(collection => 
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderTreeNode = (node: TreeNode, level: number = 0, activeFilePath: string | null = null) => {
    const paddingLeft = level * 14 + 10

    if (node.type === 'request') {
      const isActiveRequest = activeFilePath !== null && activeFilePath === node.path

      return (
        <div
          key={node.path || node.name}
          className={`group flex min-h-8 items-center border-l-2 rounded-r-md transition-all ${
            isActiveRequest
              ? 'border-primary bg-accent/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
              : 'border-transparent text-foreground/90 hover:bg-accent/45'
          }`}
          style={{ paddingLeft: `${paddingLeft + 18}px` }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-1.5 text-left"
            onClick={() => {
              if (activeCollection && node.path) {
                loadRequestFromPath(activeCollection.name, node.path)
              }
            }}
          >
            <span
              className={`inline-flex h-5 w-9 shrink-0 items-center justify-center rounded-md border border-black/5 text-[9px] font-semibold uppercase tracking-[0.08em] ${getMethodColor(node.method)}`}
            >
              {(node.method || 'GET').toUpperCase()}
            </span>
            <span className={`truncate text-xs leading-4 ${isActiveRequest ? 'font-semibold' : 'font-medium'}`}>
              {node.name}
            </span>
          </button>

          <div className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`h-5 w-5 rounded-sm transition-all hover:bg-accent ${
                    isActiveRequest ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenameDialog({ isOpen: true, node })
                    setRenameValue(node.name)
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAlertDialog({
                      isOpen: true,
                      title: 'Delete Request',
                      description: `Are you sure you want to delete "${node.name}"? This action cannot be undone.`,
                      onConfirm: async () => {
                        if (activeCollection && node.path) {
                          await apiService.deleteRequest(activeCollection.name, node.path)
                          await fetchCollectionTree(activeCollection.name)
                        }
                        setAlertDialog(prev => ({ ...prev, isOpen: false }))
                      }
                    })
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )
    }

    if (node.type === 'folder') {
      const folderKey = node.path || node.name
      const isExpanded = expandedFolders.has(folderKey)
      return (
        <div key={node.path || node.name}>
          <div className="group flex min-h-8 items-center rounded-sm hover:bg-accent/50 transition-colors">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpandedFolders(prev => {
                  const next = new Set(prev)
                  if (next.has(folderKey)) {
                    next.delete(folderKey)
                  } else {
                    next.add(folderKey)
                  }
                  return next
                })
              }}
              className="h-8 flex-1 justify-start gap-1.5 px-2.5 py-1 text-xs hover:bg-transparent"
              style={{ paddingLeft: `${paddingLeft}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <Folder className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="truncate text-left text-xs font-medium">{node.name}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!activeCollection) return
                    openCreateNodeDialog('folder', activeCollection.name, node.path ?? null)
                  }}
                >
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!activeCollection) return
                    openCreateNodeDialog('request', activeCollection.name, node.path ?? null)
                  }}
                >
                  New Request
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, level + 1, activeFilePath))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <TooltipProvider>
    <aside
      className="border-r border-border/70 bg-card/80 backdrop-blur-sm flex flex-col shrink-0"
      style={{ width: `${width}px` }}
    >
      {/* Sidebar Header */}
      <div className="flex h-11 items-center gap-1.5 border-b border-border/70 bg-card/90 px-2.5">
        <Button 
          variant={activeTab === 'collections' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('collections')}
          className={`h-7 gap-1.5 px-2.5 text-xs ${activeTab === 'collections' ? 'font-medium' : 'text-muted-foreground'}`}
        >
          <Folder className="h-3.5 w-3.5" />
          Collections
        </Button>
        <Button 
          variant={activeTab === 'history' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('history')}
          className={`h-7 gap-1.5 px-2.5 text-xs ${activeTab === 'history' ? 'font-medium' : 'text-muted-foreground'}`}
        >
          <Clock className="h-3.5 w-3.5" />
          History
        </Button>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleImportBruno}
              className="h-7 w-7"
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import Collection</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleCreateCollection}
              className="h-7 w-7"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Collection</TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="border-b border-border/70 bg-muted/20 px-2.5 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'collections' ? (
          isCollectionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <div className="space-y-1 px-1.5 py-1.5">
            {filteredCollections.map((collection) => {
              const isExpanded = expandedCollectionId === collection.id
              const isActive = activeCollection?.id === collection.id
              
              return (
                <div key={collection.id} className="space-y-1">
                  {/* Collection Header */}
                  <div
                    className={`group flex min-h-8 items-center gap-1 rounded-md transition-colors hover:bg-accent/60 ${
                      isActive ? 'bg-accent/70' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 text-left"
                      onClick={() => {
                        const wasExpanded = expandedCollectionId === collection.id
                        toggleCollection(collection.id)
                        if (!wasExpanded) {
                          setActiveCollection(collection)
                          openCollectionOverview(collection.name)
                        }
                      }}
                    >
                      <span className="shrink-0 h-5 w-5 flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Database className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="truncate text-xs font-medium">{collection.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({collection.requestCount})
                        </span>
                        {isActive && isCollectionTreeLoading && (
                          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
                        )}
                      </span>
                    </button>

                    {/* Action icons */}
                    <div className="flex w-[76px] shrink-0 items-center justify-end gap-0.5 pr-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 rounded-sm"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              openCreateNodeDialog('folder', collection.name, null)
                            }}
                          >
                            New Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              openCreateNodeDialog('request', collection.name, null)
                            }}
                          >
                            New Request
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleExportBruno(collection.name) }}
                            className="h-6 w-6 rounded-sm"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCollection(collection.name) }}
                            className="h-6 w-6 rounded-sm text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Collection Tree */}
                  {isExpanded && isActive && collectionTree?.children && (
                    <div className="ml-2 border-l border-border/50 pl-1">
                      {collectionTree.children.map(child => renderTreeNode(child, 0, activeTabFilePath))}
                    </div>
                  )}
                </div>
              )
            })}
            
            {filteredCollections.length === 0 && !isCollectionsLoading && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-muted-foreground mb-3">No collections found</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCreateCollection}
                  className="text-xs h-7"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Collection
                </Button>
              </div>
            )}
          </div>
          )
        ) : (
          <div className="flex-1 overflow-auto">
            {historyLoading ? (
              <div className="px-3 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading history...</p>
              </div>
            ) : historyEntries.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No history yet</p>
                <p className="text-xs text-muted-foreground mt-1">Send requests to see them here</p>
              </div>
            ) : (
              <div className="space-y-1 px-1.5 py-1.5">
                {historyEntries.map((entry) => {
                  const timestamp = new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })
                  let path = entry.url
                  let hostname = ''
                  try {
                    const urlObj = new URL(entry.url)
                    path = urlObj.pathname + urlObj.search
                    hostname = urlObj.hostname
                  } catch {
                    // Relative or malformed URL — display as-is.
                  }
                  const sizeKB = entry.size > 1024 ? `${(entry.size / 1024).toFixed(1)}KB` : `${entry.size}B`
                  
                  return (
                    <div
                      key={entry.id}
                      className="group flex cursor-pointer flex-col gap-0.5 rounded-sm border-l-2 border-transparent px-2.5 py-1.5 text-xs transition-colors hover:border-primary hover:bg-accent"
                      onClick={() => {
                        // Load the history entry into the active tab.
                        loadRequestInActiveTab({
                          id: Date.now().toString(),
                          name: `${entry.method} ${path}`,
                          method: entry.method,
                          url: entry.url,
                          headers: Object.entries(entry.headers || {}).map(([key, value]) => ({
                            key,
                            value: value as string,
                            enabled: true
                          })),
                          body: {
                            type: 'raw' as const,
                            content: entry.requestBody || ''
                          },
                          queryParams: [],
                          auth: { type: 'none' as const }
                        })
                      }}
                    >
                      {/* Row 1: Method, Status, Time */}
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                          entry.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                          entry.method === 'POST' ? 'bg-green-100 text-green-700' :
                          entry.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                          entry.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {entry.method}
                        </span>
                        <span className={`font-medium ${
                          entry.status >= 200 && entry.status < 300 ? 'text-green-600' :
                          entry.status >= 400 ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {entry.status}
                        </span>
                        <span className="text-muted-foreground ml-auto">
                          {timestamp}
                        </span>
                      </div>
                      
                      {/* Row 2: URL Path */}
                      <div className="truncate text-muted-foreground" title={entry.url}>
                        {path}
                      </div>
                      
                      {/* Row 3: Duration & Size */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>⏱ {entry.duration}ms</span>
                        <span>📦 {sizeKB}</span>
                        <span className="truncate flex-1" title={hostname}>
                          🌐 {hostname}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Collection Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[420px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Create Collection
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Collections help you organize related API requests together.
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 pb-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                placeholder="My Collection"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitCreate()
                  }
                }}
                autoFocus
                className="h-9 text-sm"
              />
            </div>
          </div>
          
          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateDialogOpen(false)}
              className="h-8 px-4 text-sm font-normal"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitCreate}
              disabled={!newCollectionName.trim()}
              className="h-8 px-4 text-sm font-medium"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder/Request Dialog */}
      <Dialog
        open={createNodeDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateNodeDialog({
              isOpen: false,
              kind: 'folder',
              collectionName: null,
              parentPath: null,
            })
            setNewNodeName('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">
              {createNodeDialog.kind === 'folder' ? 'Create Folder' : 'Create Request'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {createNodeDialog.kind === 'folder'
                ? 'Create a new folder in this collection location.'
                : 'Create a new request in this collection location.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                placeholder={createNodeDialog.kind === 'folder' ? 'New Folder' : 'New Request'}
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitCreateNode()
                  }
                }}
                autoFocus
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateNodeDialog({
                  isOpen: false,
                  kind: 'folder',
                  collectionName: null,
                  parentPath: null,
                })
                setNewNodeName('')
              }}
              className="h-8 px-4 text-sm font-normal"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitCreateNode}
              disabled={!newNodeName.trim()}
              className="h-8 px-4 text-sm font-medium"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialog.isOpen} onOpenChange={(open) => {
          if (!open) setRenameDialog({ isOpen: false, node: null })
        }}>
        <DialogContent className="sm:max-w-[420px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Rename Request
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-5">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm()
              }}
              autoFocus
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameDialog({ isOpen: false, node: null })}
              className="h-8 px-4 text-sm font-normal"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRenameConfirm}
              disabled={!renameValue.trim()}
              className="h-8 px-4 text-sm font-medium"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for Confirmations */}
      <AlertDialog open={alertDialog.isOpen} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={alertDialog.onConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
    </TooltipProvider>
  )
}
