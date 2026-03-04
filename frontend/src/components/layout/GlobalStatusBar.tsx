import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Cookie, LayoutTemplate, Plus, Upload } from 'lucide-react'
import { apiService } from '@/lib/api'
import { useCollectionsStore } from '@/store/collections'
import { useTabsStore } from '@/store/tabs-store'
import type { Cookie as CookieType, Template } from '@/types'

export function GlobalStatusBar() {
  const { createCollection, importBruno } = useCollectionsStore()
  const { loadRequestInActiveTab } = useTabsStore()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateCategories, setTemplateCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')

  const [isCookiesDialogOpen, setIsCookiesDialogOpen] = useState(false)
  const [cookies, setCookies] = useState<CookieType[]>([])
  const [cookieDomains, setCookieDomains] = useState<string[]>([])
  const [selectedCookieDomain, setSelectedCookieDomain] = useState('')

  const [isClearCookiesConfirmOpen, setIsClearCookiesConfirmOpen] = useState(false)

  const handleCreateCollection = () => {
    setNewCollectionName('')
    setIsCreateDialogOpen(true)
  }

  const handleSubmitCreate = async () => {
    const nextName = newCollectionName.trim()
    if (!nextName) return

    await createCollection(nextName)
    setIsCreateDialogOpen(false)
    setNewCollectionName('')
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

  const loadTemplates = async (category?: string) => {
    try {
      const activeCategory = category ?? selectedCategory
      const [templatesData, categories] = await Promise.all([
        apiService.getTemplates(activeCategory || undefined),
        apiService.getTemplateCategories(),
      ])
      setTemplates(templatesData)
      setTemplateCategories(categories)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const openTemplatesDialog = async () => {
    setIsTemplatesDialogOpen(true)
    await loadTemplates('')
  }

  const handleUseTemplate = (template: Template) => {
    loadRequestInActiveTab({
      id: template.id,
      name: template.name,
      method: template.method,
      url: template.url,
      headers: Object.entries(template.headers || {}).map(([key, value]) => ({
        key,
        value,
        enabled: true,
      })),
      body: {
        type: template.bodyType as 'none' | 'json' | 'raw' | 'form-data' | 'binary',
        content: template.body || '',
      },
      queryParams: [],
      auth: { type: 'none' },
    })
    setIsTemplatesDialogOpen(false)
  }

  const loadCookies = async (domain?: string) => {
    try {
      const activeDomain = domain ?? selectedCookieDomain
      const [cookiesData, domains] = await Promise.all([
        apiService.getCookies(activeDomain || undefined),
        apiService.getCookieDomains(),
      ])
      setCookies(cookiesData)
      setCookieDomains(domains)
    } catch (error) {
      console.error('Failed to load cookies:', error)
    }
  }

  const openCookiesDialog = async () => {
    setIsCookiesDialogOpen(true)
    await loadCookies('')
  }

  const handleDeleteCookie = async (id: string) => {
    try {
      await apiService.deleteCookie(id)
      await loadCookies()
    } catch (error) {
      console.error('Failed to delete cookie:', error)
    }
  }

  const handleClearExpired = async () => {
    try {
      await apiService.clearExpiredCookies()
      await loadCookies()
    } catch (error) {
      console.error('Failed to clear expired cookies:', error)
    }
  }

  const handleClearCookies = async () => {
    try {
      await apiService.clearCookies()
      await loadCookies('')
    } catch (error) {
      console.error('Failed to clear cookies:', error)
    } finally {
      setIsClearCookiesConfirmOpen(false)
    }
  }

  return (
    <>
      <div className="h-7 shrink-0 border-t border-border/70 bg-card/85 backdrop-blur-sm px-2 flex items-center gap-1.5 text-[11px]">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[11px] gap-1"
          onClick={handleCreateCollection}
          title="New Collection"
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[11px] gap-1"
          onClick={handleImportBruno}
          title="Import Collection"
        >
          <Upload className="h-3 w-3" />
          Import
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[11px] gap-1"
          onClick={openTemplatesDialog}
          title="Templates"
        >
          <LayoutTemplate className="h-3 w-3" />
          Templates
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[11px] gap-1"
          onClick={openCookiesDialog}
          title="Cookies"
        >
          <Cookie className="h-3 w-3" />
          Cookies
        </Button>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[420px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">Create Collection</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Collections help you organize related API requests together.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name</label>
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

      <Dialog open={isTemplatesDialogOpen} onOpenChange={setIsTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">Request Templates</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Choose a template to quickly start your request
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-5">
            {templateCategories.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  variant={selectedCategory === '' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSelectedCategory('')
                    loadTemplates('')
                  }}
                  className="text-xs h-7"
                >
                  All
                </Button>
                {templateCategories.map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(cat)
                      loadTemplates(cat)
                    }}
                    className="text-xs h-7"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      template.method === 'GET'
                        ? 'bg-blue-100 text-blue-700'
                        : template.method === 'POST'
                          ? 'bg-green-100 text-green-700'
                          : template.method === 'PUT'
                            ? 'bg-yellow-100 text-yellow-700'
                            : template.method === 'DELETE'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                    }`}>
                      {template.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{template.description}</div>
                      <div className="text-xs text-muted-foreground mt-1 truncate font-mono">{template.url}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      {template.category}
                    </span>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">No templates found</div>
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

      <Dialog open={isCookiesDialogOpen} onOpenChange={setIsCookiesDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 space-y-1">
            <DialogTitle className="text-base font-semibold tracking-tight">Cookie Jar</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Manage cookies for your API requests
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-5">
            {cookieDomains.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  variant={selectedCookieDomain === '' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setSelectedCookieDomain('')
                    loadCookies('')
                  }}
                  className="text-xs h-7"
                >
                  All Domains
                </Button>
                {cookieDomains.map((domain) => (
                  <Button
                    key={domain}
                    variant={selectedCookieDomain === domain ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setSelectedCookieDomain(domain)
                      loadCookies(domain)
                    }}
                    className="text-xs h-7"
                  >
                    {domain}
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {cookies.map((cookie) => (
                <div key={cookie.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-medium text-sm truncate">{cookie.name}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCookie(cookie.id)}
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="truncate">Domain: {cookie.domain}</div>
                    <div className="truncate">Path: {cookie.path}</div>
                    <div className="truncate">Secure: {cookie.secure ? 'Yes' : 'No'}</div>
                    <div className="truncate">HttpOnly: {cookie.httpOnly ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              ))}
              {cookies.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">No cookies found</div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/40 gap-2">
            <Button variant="outline" size="sm" onClick={handleClearExpired} className="h-8 px-4 text-sm">
              Clear Expired
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearCookiesConfirmOpen(true)}
              className="h-8 px-4 text-sm"
            >
              Clear All
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCookiesDialogOpen(false)}
              className="h-8 px-4 text-sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isClearCookiesConfirmOpen} onOpenChange={setIsClearCookiesConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Cookies</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all cookies from the cookie jar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCookies}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
