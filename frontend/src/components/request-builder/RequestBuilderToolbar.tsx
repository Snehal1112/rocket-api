import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { VariableAwareUrlInput } from '@/components/request-builder/VariableAwareUrlInput'
import { METHOD_TEXT_COLORS } from '@/lib/constants'
import { CollectionVar, Environment, HttpMethod, QueryParam } from '@/types'
import { Globe, Loader2, Play, Save, Settings2 } from 'lucide-react'

interface RequestBuilderToolbarProps {
  name: string
  setName: (name: string) => void
  method: HttpMethod
  setMethod: (method: HttpMethod) => void
  url: string
  setUrl: (url: string) => void
  isLoading: boolean
  isDirty: boolean
  activeCollection: unknown | null
  activeEnvironment: Environment | null
  environments: Environment[]
  collectionVariables: CollectionVar[]
  pathParams: QueryParam[]
  queryParams: QueryParam[]
  onRequestNameChange: (name: string) => void
  onSetActiveEnvironment: (environment: Environment | null) => void
  onOpenEnvironmentsDialog: () => void
  onSubmit: (e?: React.FormEvent) => Promise<void>
  onSave: () => Promise<void>
  onSaveParamToken: (tokenName: string, tokenValue: string, target: 'path' | 'query') => Promise<void>
  onSaveVariable: (name: string, value: string) => Promise<void>
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

export function RequestBuilderToolbar({
  name,
  setName,
  method,
  setMethod,
  url,
  setUrl,
  isLoading,
  isDirty,
  activeCollection,
  activeEnvironment,
  environments,
  collectionVariables,
  pathParams,
  queryParams,
  onRequestNameChange,
  onSetActiveEnvironment,
  onOpenEnvironmentsDialog,
  onSubmit,
  onSave,
  onSaveParamToken,
  onSaveVariable,
}: RequestBuilderToolbarProps) {
  return (
    <div className="px-4 pt-3 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-sm space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            onRequestNameChange(e.target.value)
          }}
          placeholder="Untitled Request"
          className="h-7 text-sm font-medium border-0 border-b border-transparent hover:border-border focus:border-primary rounded-none bg-transparent px-0 focus-visible:ring-0 shadow-none flex-1"
        />
        <div className="flex items-center gap-1 shrink-0">
          <Select
            value={activeEnvironment?.name ?? 'none'}
            onValueChange={(value) => {
              if (value === 'none') {
                onSetActiveEnvironment(null)
              } else {
                const env = environments.find(e => e.name === value) ?? null
                onSetActiveEnvironment(env)
              }
            }}
            disabled={!activeCollection}
          >
            <SelectTrigger className="h-7 text-xs w-[120px] gap-1 border-dashed">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <SelectValue placeholder="No Env" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="none" className="text-xs">No Environment</SelectItem>
              {environments.map(env => (
                <SelectItem key={env.name} value={env.name} className="text-xs">{env.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenEnvironmentsDialog}
            title="Manage environments"
            disabled={!activeCollection}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <TooltipProvider>
        <form onSubmit={onSubmit} className="flex gap-3">
          <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
            <SelectTrigger className={`w-[110px] h-9 font-semibold text-sm ${METHOD_TEXT_COLORS[method]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m} className="text-sm font-medium">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1">
            <VariableAwareUrlInput
              value={url}
              onChange={setUrl}
              placeholder="https://api.example.com/v1/resource"
              className="text-sm h-9 font-mono bg-background/90"
              activeEnvironment={activeEnvironment}
              collectionVariables={collectionVariables}
              pathParams={pathParams}
              queryParams={queryParams}
              onSaveParamToken={onSaveParamToken}
              onSaveVariable={onSaveVariable}
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                disabled={isLoading}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 font-semibold px-4 rounded-md shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-2">Send</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Send Request (Ctrl+Enter)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={!activeCollection}
                className={`font-medium px-3 ${isDirty ? 'border-primary/40 text-primary hover:bg-accent/60' : 'hover:bg-accent/40'}`}
              >
                <Save className="h-4 w-4 mr-2" />
                {isDirty ? 'Save*' : 'Save'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isDirty ? 'Save changes (Ctrl+S)' : 'No changes to save'}</p>
            </TooltipContent>
          </Tooltip>
        </form>
      </TooltipProvider>
    </div>
  )
}

