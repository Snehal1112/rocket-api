import { useState } from 'react'
import { useCollectionsStore } from '@/store/collections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Plus, 
  Globe,
  Check,
  X,
  Save,
  Loader2
} from 'lucide-react'
import { Environment, EnvironmentVariable } from '@/types'

export function EnvironmentsPanel() {
  const { 
    environments, 
    activeEnvironment, 
    activeCollection,
    setActiveEnvironment
  } = useCollectionsStore()

  const [editingVars, setEditingVars] = useState<EnvironmentVariable[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleCreateEnvironment = () => {
    const name = prompt('Environment name:')
    if (name?.trim() && activeCollection) {
      console.log('Create environment:', name)
    }
  }

  const handleEditEnvironment = (env: Environment) => {
    setActiveEnvironment(env)
    setEditingVars([...env.variables])
    setIsEditing(true)
  }

  const handleAddVariable = () => {
    setEditingVars([...editingVars, { key: '', value: '', enabled: true }])
  }

  const handleUpdateVariable = (index: number, updates: Partial<EnvironmentVariable>) => {
    const newVars = [...editingVars]
    newVars[index] = { ...newVars[index], ...updates }
    setEditingVars(newVars)
  }

  const handleDeleteVariable = (index: number) => {
    setEditingVars(editingVars.filter((_, i) => i !== index))
  }

  const handleSaveEnvironment = async () => {
    if (!activeCollection || !activeEnvironment) return
    
    setIsSaving(true)
    try {
      console.log('Save environment:', activeEnvironment.name, editingVars)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TooltipProvider>
    <aside className="w-64 border-l border-border bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-muted/30">
        <span className="text-xs font-medium">Environments</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleCreateEnvironment}
              className="h-6 w-6"
              disabled={!activeCollection}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Environment</TooltipContent>
        </Tooltip>
      </div>

      {/* Environment Selector */}
      <div className="p-2 border-b border-border">
        <Select
          value={activeEnvironment?.name || 'none'}
          onValueChange={(value) => {
            if (value === 'none') {
              setActiveEnvironment(null)
            } else {
              const env = environments.find(env => env.name === value)
              if (env) handleEditEnvironment(env)
            }
          }}
          disabled={!activeCollection || environments.length === 0}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="No Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">No Environment</SelectItem>
            {environments.map(env => (
              <SelectItem key={env.name} value={env.name} className="text-xs">{env.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-auto p-2">
        {!activeCollection ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Globe className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">Select a collection first</p>
          </div>
        ) : activeEnvironment && isEditing ? (
          <div className="space-y-1.5">
            {editingVars.map((variable, index) => (
              <div key={index} className="flex items-center gap-1 p-1.5 bg-muted/50 rounded group">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUpdateVariable(index, { enabled: !variable.enabled })}
                  className={`w-4 h-4 rounded border p-0 shrink-0 ${
                    variable.enabled ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600' : 'border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {variable.enabled && <Check className="h-3 w-3" />}
                </Button>
                <Input
                  value={variable.key}
                  onChange={(e) => handleUpdateVariable(index, { key: e.target.value })}
                  placeholder="KEY"
                  className="h-7 text-xs flex-1 min-w-0"
                />
                <Input
                  value={variable.value}
                  onChange={(e) => handleUpdateVariable(index, { value: e.target.value })}
                  placeholder="value"
                  className="h-7 text-xs flex-1 min-w-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteVariable(index)}
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleAddVariable}
              className="w-full justify-start text-xs text-muted-foreground h-7"
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Variable
            </Button>
          </div>
        ) : activeEnvironment ? (
          <div className="space-y-1">
            {activeEnvironment.variables.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No variables</p>
            ) : (
              activeEnvironment.variables.map((variable, index) => (
                <div key={index} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/30 rounded">
                  <span className={`w-2 h-2 rounded-full ${variable.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-medium text-xs">{variable.key}</span>
                  <span className="text-muted-foreground text-xs truncate flex-1">{variable.value}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Globe className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              {environments.length === 0 ? 'No environments' : 'Select an environment'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {activeEnvironment && isEditing && (
        <div className="border-t border-border p-2 bg-muted/20">
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSaveEnvironment}
            disabled={isSaving}
            className="w-full text-xs h-8"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-2" />
            )}
            Save Environment
          </Button>
        </div>
      )}
    </aside>
    </TooltipProvider>
  )
}