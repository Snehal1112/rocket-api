import { useState, useEffect, useMemo } from 'react'
import { useCollectionsStore } from '@/store/collections'
import { useHistoryStore } from '@/store/history'
import { computeCollectionStats } from '@/lib/collection-stats'
import { METHOD_BG_COLORS, METHOD_TEXT_COLORS } from '@/lib/constants'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollectionVariablesEditor } from './CollectionVariablesEditor'
import {
  FolderOpen,
  FileText,
  Folder,
  Globe,
  GitBranch,
  Download,
  Copy,
  Check,
  Pencil,
  Play,
  Clock,
} from 'lucide-react'

interface CollectionOverviewProps {
  collectionName: string
}

export function CollectionOverview({ collectionName }: CollectionOverviewProps) {
  const {
    collections,
    collectionTree,
    environments,
    activeCollection,
    setActiveCollection,
    fetchCollectionTree,
    exportBruno,
    exportPostman,
  } = useCollectionsStore()

  const { entries: historyEntries, fetchHistory } = useHistoryStore()

  const [description, setDescription] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [copied, setCopied] = useState(false)

  const collectionSummary = collections.find(c => c.name === collectionName)

  // Sync active collection when this overview is displayed
  useEffect(() => {
    if (activeCollection?.name !== collectionName && collectionSummary) {
      setActiveCollection(collectionSummary)
    }
  }, [collectionName, collectionSummary, activeCollection?.name, setActiveCollection])

  // Fetch collection tree when collection name changes
  useEffect(() => {
    fetchCollectionTree(collectionName)
  }, [collectionName, fetchCollectionTree])

  // Fetch history for activity section
  useEffect(() => {
    fetchHistory(10)
  }, [fetchHistory])

  const stats = useMemo(
    () => collectionTree ? computeCollectionStats(collectionTree, environments.length) : null,
    [collectionTree, environments.length]
  )

  const handleCopyPath = async () => {
    if (collectionSummary?.path) {
      await navigator.clipboard.writeText(collectionSummary.path)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Collection not found
  if (!collectionSummary) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Collection not found</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (!stats) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <div className="h-16 bg-muted animate-pulse rounded-lg" />
        <div className="flex gap-3">
          <div className="h-24 flex-1 bg-muted animate-pulse rounded-lg" />
          <div className="h-24 flex-1 bg-muted animate-pulse rounded-lg" />
          <div className="h-24 flex-1 bg-muted animate-pulse rounded-lg" />
          <div className="h-24 flex-1 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  const sortedMethods = Object.entries(stats.methodCounts).sort(([, a], [, b]) => b - a)
  const maxMethodCount = sortedMethods.length > 0 ? sortedMethods[0][1] : 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-6 shrink-0">
          <TabsList className="h-9 bg-transparent p-0 gap-0">
            <TabsTrigger
              value="overview"
              className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-3 text-xs"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="variables"
              className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-3 text-xs"
            >
              Variables
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                  <FolderOpen className="h-6 w-6 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold text-foreground">{collectionName}</h1>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {collectionSummary.path}
                  </p>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Requests</span>
                    </div>
                    <p className="text-2xl font-semibold">{stats.totalRequests}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Folders</span>
                    </div>
                    <p className="text-2xl font-semibold">{stats.totalFolders}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Environments</span>
                    </div>
                    <p className="text-2xl font-semibold">{stats.environmentsCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Methods</span>
                    </div>
                    <p className="text-2xl font-semibold">{Object.keys(stats.methodCounts).length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Two-Column Content */}
              <div className="grid grid-cols-3 gap-4">
                {/* Left Column - 2/3 width */}
                <div className="col-span-2 space-y-4">
                  {/* Description */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium">Description</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setIsEditingDescription(!isEditingDescription)}
                        >
                          {isEditingDescription ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      {isEditingDescription ? (
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Add a description for this collection..."
                          className="w-full min-h-[100px] resize-none text-sm bg-transparent border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                      ) : (
                        <p
                          className={`text-sm whitespace-pre-wrap ${description ? 'text-foreground' : 'text-muted-foreground italic cursor-pointer'}`}
                          onClick={() => !description && setIsEditingDescription(true)}
                        >
                          {description || 'Add a description for this collection...'}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Method Breakdown */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-sm font-medium mb-3">Method Breakdown</h3>
                      {sortedMethods.length > 0 ? (
                        <div className="space-y-2.5">
                          {sortedMethods.map(([method, count]) => {
                            const percentage = maxMethodCount > 0 ? (count / maxMethodCount) * 100 : 0
                            const bgColor = METHOD_BG_COLORS[method] || 'bg-gray-400'
                            const textColor = METHOD_TEXT_COLORS[method as keyof typeof METHOD_TEXT_COLORS] || 'text-gray-500'
                            return (
                              <div key={method} className="flex items-center gap-3">
                                <span className={`text-[10px] font-semibold w-16 shrink-0 ${textColor}`}>
                                  {method}
                                </span>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${bgColor}`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                                  {count}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No requests in this collection</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - 1/3 width */}
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-8"
                          onClick={() => exportBruno(collectionName)}
                        >
                          <Download className="h-3.5 w-3.5 mr-2" />
                          Export Bruno
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-8"
                          onClick={() => exportPostman(collectionName)}
                        >
                          <Download className="h-3.5 w-3.5 mr-2" />
                          Export Postman
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-8"
                          disabled
                          title="Coming soon"
                        >
                          <Play className="h-3.5 w-3.5 mr-2" />
                          Run All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-8"
                          onClick={handleCopyPath}
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 mr-2 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 mr-2" />
                          )}
                          {copied ? 'Copied!' : 'Copy Path'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Environments */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-sm font-medium mb-3">Environments</h3>
                      {environments.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {environments.map(env => (
                            <Badge key={env.id} variant="secondary" className="text-xs">
                              {env.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No environments configured</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
                  {historyEntries.length > 0 ? (
                    <div className="space-y-1.5">
                      {historyEntries.slice(0, 5).map(entry => {
                        let path = entry.url
                        try {
                          const urlObj = new URL(entry.url)
                          path = urlObj.pathname + urlObj.search
                        } catch {
                          // keep raw url
                        }
                        const timestamp = new Date(entry.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })

                        return (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-xs"
                          >
                            <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                              entry.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                              entry.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                              entry.method === 'PUT' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                              entry.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
                            }`}>
                              {entry.method}
                            </span>
                            <span className={`font-medium shrink-0 ${
                              entry.status >= 200 && entry.status < 300 ? 'text-green-600' :
                              entry.status >= 400 ? 'text-red-600' :
                              'text-yellow-600'
                            }`}>
                              {entry.status}
                            </span>
                            <span className="truncate text-muted-foreground font-mono" title={entry.url}>
                              {path}
                            </span>
                            <span className="text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timestamp}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="variables" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-2xl mx-auto">
              <CollectionVariablesEditor />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
