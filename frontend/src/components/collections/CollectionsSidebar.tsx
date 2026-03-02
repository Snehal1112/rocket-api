import { useState, useEffect } from 'react'
import { useCollectionsStore } from '@/store/collections'
import { useTabsStore } from '@/store/tabs-store'
import { useHistoryStore } from '@/store/history'
import { Template, Cookie as CookieType } from '@/types'
import { apiService } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
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
  Folder,
  FolderOpen,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  Clock,
  Upload,
  Download,
  Trash2,
  Loader2,
  LayoutTemplate,
  Cookie,
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

export function CollectionsSidebar() {
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateCategories, setTemplateCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  
  // Cookie state
  const [isCookiesDialogOpen, setIsCookiesDialogOpen] = useState(false)
  const [cookies, setCookies] = useState<CookieType[]>([])
  const [cookieDomains, setCookieDomains] = useState<string[]>([])
  const [selectedCookieDomain, setSelectedCookieDomain] = useState<string>('')
  
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
  } = useHistoryStore()
  
  const { 
    collections, 
    collectionTree,
    activeCollection, 
    isLoading,
    error,
    fetchCollections,
    fetchCollectionTree,
    createCollection,
    deleteCollection,
    setActiveCollection,
    importBruno,
    exportBruno
  } = useCollectionsStore()
  
  const { loadRequestFromPath, loadRequestInActiveTab } = useTabsStore()

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  useEffect(() => {
    if (activeCollection) {
      fetchCollectionTree(activeCollection.name)
    }
  }, [activeCollection, fetchCollectionTree])

  // Fetch history when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, fetchHistory])

  const toggleCollection = (id: string) => {
    setExpandedCollectionId(prev => prev === id ? null : id)
    setExpandedFolders(new Set())
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

  const loadTemplates = async () => {
    try {
      const [templatesData, categories] = await Promise.all([
        apiService.getTemplates(selectedCategory || undefined),
        apiService.getTemplateCategories()
      ])
      setTemplates(templatesData)
      setTemplateCategories(categories)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const handleUseTemplate = (template: Template) => {
    // Load the template into the active tab.
    loadRequestInActiveTab({
      id: template.id,
      name: template.name,
      method: template.method,
      url: template.url,
      headers: Object.entries(template.headers || {}).map(([key, value]) => ({
        key,
        value,
        enabled: true
      })),
      body: {
        type: template.bodyType as 'none' | 'json' | 'raw' | 'form-data' | 'binary',
        content: template.body || ''
      },
      queryParams: [],
      auth: { type: 'none' }
    })
    setIsTemplatesDialogOpen(false)
  }

  const loadCookies = async () => {
    try {
      const [cookiesData, domains] = await Promise.all([
        apiService.getCookies(selectedCookieDomain || undefined),
        apiService.getCookieDomains()
      ])
      setCookies(cookiesData)
      setCookieDomains(domains)
    } catch (error) {
      console.error('Failed to load cookies:', error)
    }
  }

  const handleDeleteCookie = async (id: string) => {
    try {
      await apiService.deleteCookie(id)
      loadCookies()
    } catch (error) {
      console.error('Failed to delete cookie:', error)
    }
  }

  const handleClearCookies = () => {
    setAlertDialog({
      isOpen: true,
      title: 'Clear All Cookies',
      description: 'Are you sure you want to clear all cookies from the cookie jar?',
      onConfirm: async () => {
        try {
          await apiService.clearCookies()
          loadCookies()
        } catch (error) {
          console.error('Failed to clear cookies:', error)
        }
        setAlertDialog(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleClearExpired = async () => {
    try {
      const count = await apiService.clearExpiredCookies()
      // Use a toast or notification instead of alert
      console.log(`Cleared ${count} expired cookies`)
      loadCookies()
    } catch (error) {
      console.error('Failed to clear expired cookies:', error)
    }
  }

  const getMethodColor = (method?: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700',
      POST: 'bg-green-100 text-green-700',
      PUT: 'bg-yellow-100 text-yellow-700',
      DELETE: 'bg-red-100 text-red-700',
      PATCH: 'bg-purple-100 text-purple-700',
    }
    return colors[method?.toUpperCase() || 'GET'] || 'bg-gray-100 text-gray-600'
  }

  const filteredCollections = (collections || []).filter(collection => 
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const paddingLeft = level * 16 + 8

    if (node.type === 'request') {
      const isActiveRequest = false // TODO: wire to active tab

      return (
        <div
          key={node.path || node.name}
          className={`flex items-center group hover:bg-accent/50 transition-colors ${
            isActiveRequest ? 'border-l-2 border-primary bg-accent/60' : 'border-l-2 border-transparent'
          }`}
          style={{ paddingLeft: `${paddingLeft + 24}px` }}
        >
          <button
            type="button"
            className="flex items-center gap-2 flex-1 min-w-0 py-1.5 pr-1 text-left"
            onClick={() => {
              if (activeCollection && node.path) {
                loadRequestFromPath(activeCollection.name, node.path)
              }
            }}
          >
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-[42px] text-center shrink-0 ${getMethodColor(node.method)}`}>
              {node.method || 'GET'}
            </span>
            <span className="truncate text-xs text-foreground">
              {node.name}
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded hover:bg-accent shrink-0 mr-1"
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
      )
    }

    if (node.type === 'folder') {
      const folderKey = node.path || node.name
      const isExpanded = expandedFolders.has(folderKey)
      return (
        <div key={node.path || node.name}>
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
            className="w-full justify-start gap-1.5 px-2 py-1.5 h-auto hover:bg-accent/50"
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
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <TooltipProvider>
    <aside className="w-64 border-r border-border bg-background flex flex-col shrink-0">
      {/* Sidebar Header */}
      <div className="h-11 border-b border-border flex items-center px-2 gap-1 bg-muted/30">
        <Button 
          variant={activeTab === 'collections' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('collections')}
          className={`text-xs h-7 px-2.5 gap-1.5 ${activeTab === 'collections' ? 'font-medium' : 'text-muted-foreground'}`}
        >
          <Folder className="h-3.5 w-3.5" />
          Collections
        </Button>
        <Button 
          variant={activeTab === 'history' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('history')}
          className={`text-xs h-7 px-2.5 gap-1.5 ${activeTab === 'history' ? 'font-medium' : 'text-muted-foreground'}`}
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
              className="h-6 w-6"
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
              className="h-6 w-6"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Collection</TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
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
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'collections' ? (
          <div className="py-1">
            {filteredCollections.map((collection) => {
              const isExpanded = expandedCollectionId === collection.id
              const isActive = activeCollection?.id === collection.id
              
              return (
                <div key={collection.id}>
                  {/* Collection Header */}
                  <div
                    className={`flex items-center gap-1 hover:bg-accent/50 transition-colors group ${
                      isActive ? 'bg-accent/40' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1.5 text-left"
                      onClick={() => {
                        toggleCollection(collection.id)
                        setActiveCollection(collection)
                      }}
                    >
                      <span className="shrink-0 h-5 w-5 flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 flex-1 min-w-0">
                        {isExpanded ? (
                          <FolderOpen className="h-4 w-4 text-orange-500 shrink-0" />
                        ) : (
                          <Folder className="h-4 w-4 text-orange-500 shrink-0" />
                        )}
                        <span className="truncate text-xs font-medium">{collection.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({collection.requestCount})
                        </span>
                      </span>
                    </button>

                    {/* Action icons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pr-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleExportBruno(collection.name) }}
                            className="h-6 w-6"
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
                            className="h-6 w-6 text-destructive hover:text-destructive"
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
                    <div className="border-l border-border/50 ml-4">
                      {collectionTree.children.map(child => renderTreeNode(child, 0))}
                    </div>
                  )}
                </div>
              )
            })}
            
            {filteredCollections.length === 0 && !isLoading && (
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
              <div className="space-y-0.5 p-1">
                {historyEntries.map((entry) => {
                  const timestamp = new Date(entry.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })
                  const urlObj = new URL(entry.url)
                  const path = urlObj.pathname + urlObj.search
                  const sizeKB = entry.size > 1024 ? `${(entry.size / 1024).toFixed(1)}KB` : `${entry.size}B`
                  
                  return (
                    <div
                      key={entry.id}
                      className="group flex flex-col gap-0.5 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-xs border-l-2 border-transparent hover:border-primary transition-colors"
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
                        <span className="truncate flex-1" title={urlObj.hostname}>
                          🌐 {urlObj.hostname}
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

      {/* Sidebar Footer */}
      <div className="border-t border-border p-2 space-y-1 bg-muted/20">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-xs h-7"
          onClick={handleCreateCollection}
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          New Collection
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-xs h-7"
          onClick={handleImportBruno}
        >
          <Upload className="h-3.5 w-3.5 mr-2" />
          Import Collection
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-xs h-7"
          onClick={() => {
            setIsTemplatesDialogOpen(true)
            loadTemplates()
          }}
        >
          <LayoutTemplate className="h-3.5 w-3.5 mr-2" />
          Templates
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-xs h-7"
          onClick={() => {
            setIsCookiesDialogOpen(true)
            loadCookies()
          }}
        >
          <Cookie className="h-3.5 w-3.5 mr-2" />
          Cookies ({cookies.length})
        </Button>
      </div>
      <Separator />

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

      {/* Templates Dialog */}
      <Dialog open={isTemplatesDialogOpen} onOpenChange={setIsTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Request Templates
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Choose a template to quickly start your request
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 pb-5">
            {/* Category Filter */}
            {templateCategories.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  variant={selectedCategory === '' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setSelectedCategory(''); loadTemplates() }}
                  className="text-xs h-7"
                >
                  All
                </Button>
                {templateCategories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => { setSelectedCategory(cat); loadTemplates() }}
                    className="text-xs h-7"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            )}
            
            {/* Templates List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      template.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                      template.method === 'POST' ? 'bg-green-100 text-green-700' :
                      template.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                      template.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {template.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {template.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate font-mono">
                        {template.url}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {template.category}
                    </span>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No templates found
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTemplatesDialogOpen(false)}
              className="h-8 px-4 text-sm font-normal"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cookies Dialog */}
      <Dialog open={isCookiesDialogOpen} onOpenChange={setIsCookiesDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">
              Cookie Jar
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Manage cookies for your API requests
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 pb-5">
            {/* Domain Filter */}
            {cookieDomains.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  variant={selectedCookieDomain === '' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setSelectedCookieDomain(''); loadCookies() }}
                  className="text-xs h-7"
                >
                  All Domains
                </Button>
                {cookieDomains.map(domain => (
                  <Button
                    key={domain}
                    variant={selectedCookieDomain === domain ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => { setSelectedCookieDomain(domain); loadCookies() }}
                    className="text-xs h-7"
                  >
                    {domain}
                  </Button>
                ))}
              </div>
            )}
            
            {/* Cookies Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Domain</th>
                    <th className="text-left px-3 py-2 font-medium">Path</th>
                    <th className="text-left px-3 py-2 font-medium">Expires</th>
                    <th className="text-left px-3 py-2 font-medium">Flags</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map(cookie => (
                    <tr key={cookie.id} className="border-t hover:bg-accent/30">
                      <td className="px-3 py-2 font-mono text-xs">{cookie.name}</td>
                      <td className="px-3 py-2 text-xs">{cookie.domain}</td>
                      <td className="px-3 py-2 text-xs">{cookie.path}</td>
                      <td className="px-3 py-2 text-xs">
                        {cookie.expires ? new Date(cookie.expires).toLocaleDateString() : 'Session'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex gap-1">
                          {cookie.secure && <span className="text-[10px] px-1 bg-yellow-100 text-yellow-700 rounded">Secure</span>}
                          {cookie.httpOnly && <span className="text-[10px] px-1 bg-blue-100 text-blue-700 rounded">HttpOnly</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCookie(cookie.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {cookies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">
                        No cookies in jar
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearExpired}
              className="h-8 px-4 text-sm font-normal"
            >
              Clear Expired
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCookies}
              className="h-8 px-4 text-sm font-normal"
            >
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCookiesDialogOpen(false)}
              className="h-8 px-4 text-sm font-normal"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialog.isOpen} onOpenChange={(open) => setRenameDialog(prev => ({ ...prev, isOpen: open }))}>
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
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameDialog(prev => ({ ...prev, isOpen: false }))}
              className="h-8 px-4 text-sm font-normal"
            >
              Cancel
            </Button>
            <Button
              size="sm"
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