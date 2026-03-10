import { useEffect, useState } from 'react'
import { useCollectionsStore } from '@/store/collections'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import type { Environment, EnvironmentVariable } from '@/types'

interface EnvironmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnvironmentsDialog({ open, onOpenChange }: EnvironmentsDialogProps) {
  const {
    environments,
    activeCollection,
    activeEnvironment,
    createEnvironment,
    saveEnvironment,
    deleteEnvironment,
  } = useCollectionsStore()

  const [selectedEnvName, setSelectedEnvName] = useState<string | null>(null)
  const [editingVars, setEditingVars] = useState<EnvironmentVariable[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [revealedSecrets, setRevealedSecrets] = useState<Set<number>>(new Set())

  // Auto-select the active environment when the dialog opens and nothing is
  // selected yet, so the user immediately sees their current env's variables.
  useEffect(() => {
    if (open && !selectedEnvName && activeEnvironment) {
      setSelectedEnvName(activeEnvironment.name)
    }
  }, [open, activeEnvironment, selectedEnvName])

  const selectedEnv = environments.find(e => e.name === selectedEnvName) ?? null

  // Keep editingVars in sync when the store's environment data changes (e.g.
  // after pm.environment.set() writes back from a script), but only when the
  // user has no unsaved edits of their own.
  useEffect(() => {
    if (!isDirty && selectedEnv) {
      setEditingVars(selectedEnv.variables.map(v => ({ ...v })))
    }
  }, [selectedEnv, isDirty])

  const handleSelectEnv = (env: Environment) => {
    setSelectedEnvName(env.name)
    setEditingVars(env.variables.map(v => ({ ...v })))
    setIsDirty(false)
    setRevealedSecrets(new Set())
  }

  const handleVarChange = (index: number, field: keyof EnvironmentVariable, value: string | boolean) => {
    const updated = editingVars.map((v, i) => i === index ? { ...v, [field]: value } : v)
    setEditingVars(updated)
    setIsDirty(true)
  }

  const handleAddVar = () => {
    setEditingVars([...editingVars, { key: '', value: '', enabled: true, secret: false }])
    setIsDirty(true)
  }

  const handleDeleteVar = (index: number) => {
    setEditingVars(editingVars.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!activeCollection || !selectedEnv) return
    setIsSaving(true)
    try {
      await saveEnvironment(activeCollection.name, { ...selectedEnv, variables: editingVars })
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateEnv = async () => {
    const trimmed = newEnvName.trim()
    if (!trimmed || !activeCollection) return
    setIsCreating(true)
    try {
      await createEnvironment(activeCollection.name, trimmed)
      setNewEnvName('')
      setSelectedEnvName(trimmed)
      setEditingVars([])
      setIsDirty(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteEnv = async (name: string) => {
    if (!activeCollection) return
    if (!window.confirm(`Delete environment "${name}"? This cannot be undone.`)) return
    await deleteEnvironment(activeCollection.name, name)
    if (selectedEnvName === name) {
      setSelectedEnvName(null)
      setEditingVars([])
    }
  }

  const toggleRevealSecret = (index: number) => {
    setRevealedSecrets(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[520px] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">Manage Environments</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left column — env list */}
          <div className="w-48 border-r flex flex-col shrink-0">
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {environments.map(env => (
                <div
                  key={env.name}
                  className={`flex items-center group rounded px-2 py-1.5 cursor-pointer text-sm ${
                    selectedEnvName === env.name
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                  onClick={() => handleSelectEnv(env)}
                >
                  <span className="flex-1 truncate">{env.name}</span>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded hover:bg-destructive/10 text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDeleteEnv(env.name) }}
                    title={`Delete ${env.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* New environment input */}
            <div className="border-t p-2 space-y-1.5">
              <Input
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateEnv()}
                placeholder="New environment..."
                className="h-7 text-xs"
                disabled={isCreating || !activeCollection}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                onClick={handleCreateEnv}
                disabled={!newEnvName.trim() || isCreating || !activeCollection}
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1.5" />
                )}
                Add
              </Button>
            </div>
          </div>

          {/* Right column — variable editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedEnv ? (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
                  <span className="w-5 text-center">ON</span>
                  <span>KEY</span>
                  <span>VALUE</span>
                  <span className="w-6 text-center">
                    <Lock className="h-3 w-3 inline" />
                  </span>
                  <span className="w-6" />
                </div>

                {/* Variable rows */}
                <div className="flex-1 overflow-y-auto">
                  {editingVars.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No variables. Add one below.</p>
                  ) : (
                    editingVars.map((v, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 px-4 py-1.5 border-b items-center group"
                      >
                        {/* Enabled toggle */}
                        <input
                          type="checkbox"
                          checked={v.enabled}
                          onChange={(e) => handleVarChange(i, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded accent-orange-500"
                        />
                        {/* Key */}
                        <Input
                          value={v.key}
                          onChange={(e) => handleVarChange(i, 'key', e.target.value)}
                          placeholder="KEY"
                          className="h-7 text-xs font-mono"
                        />
                        {/* Value */}
                        <div className="relative">
                          <Input
                            type={v.secret && !revealedSecrets.has(i) ? 'password' : 'text'}
                            value={v.value}
                            onChange={(e) => handleVarChange(i, 'value', e.target.value)}
                            placeholder="value"
                            className="h-7 text-xs font-mono pr-7"
                          />
                          {v.secret && (
                            <button
                              type="button"
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleRevealSecret(i)}
                            >
                              {revealedSecrets.has(i) ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {/* Secret toggle */}
                        <button
                          type="button"
                          onClick={() => handleVarChange(i, 'secret', !v.secret)}
                          title={v.secret ? 'Secret (click to make plain)' : 'Plain (click to make secret)'}
                          className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                            v.secret
                              ? 'border-orange-400 text-orange-500 bg-orange-50 dark:bg-orange-500/10'
                              : 'border-transparent text-muted-foreground hover:border-border'
                          }`}
                        >
                          <Lock className="h-3 w-3" />
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteVar(i)}
                          className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/20 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddVar}
                    className="text-xs h-7"
                  >
                    <Plus className="h-3 w-3 mr-1.5" />
                    Add Variable
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="h-7 text-xs"
                  >
                    {isSaving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {environments.length === 0
                    ? 'Create an environment to get started.'
                    : 'Select an environment to edit.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
