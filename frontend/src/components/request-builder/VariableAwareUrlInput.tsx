import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CollectionVar, Environment } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface VariableAwareUrlInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  activeEnvironment: Environment | null
  collectionVariables: CollectionVar[]
  onSaveVariable: (name: string, value: string) => Promise<void>
}

interface UrlToken {
  name: string
  source: 'env' | 'collection' | 'missing'
  value: string
}

const tokenRegex = /\{\{([^}]+)\}\}/g

const parseTokens = (
  url: string,
  activeEnvironment: Environment | null,
  collectionVariables: CollectionVar[]
): UrlToken[] => {
  const seen = new Set<string>()
  const tokens: UrlToken[] = []

  const envMap = new Map(
    (activeEnvironment?.variables ?? [])
      .filter(v => v.enabled && v.key)
      .map(v => [v.key, v.value])
  )
  const collectionMap = new Map(
    collectionVariables
      .filter(v => v.enabled && v.key)
      .map(v => [v.key, v.value])
  )

  for (const match of url.matchAll(tokenRegex)) {
    const name = match[1].trim()
    if (!name || seen.has(name)) continue
    seen.add(name)

    if (envMap.has(name)) {
      tokens.push({ name, source: 'env', value: envMap.get(name) ?? '' })
      continue
    }
    if (collectionMap.has(name)) {
      tokens.push({ name, source: 'collection', value: collectionMap.get(name) ?? '' })
      continue
    }
    tokens.push({ name, source: 'missing', value: '' })
  }

  return tokens
}

export function VariableAwareUrlInput({
  value,
  onChange,
  placeholder,
  className,
  activeEnvironment,
  collectionVariables,
  onSaveVariable,
}: VariableAwareUrlInputProps) {
  const tokens = useMemo(
    () => parseTokens(value, activeEnvironment, collectionVariables),
    [value, activeEnvironment, collectionVariables]
  )

  const [editingVarName, setEditingVarName] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const hoveredTokenRef = useRef<string | null>(null)
  const isContentHoveredRef = useRef(false)
  const suppressedReopenTokenRef = useRef<string | null>(null)
  const editingVarNameRef = useRef<string | null>(null)

  const tokenByName = useMemo(() => new Map(tokens.map(t => [t.name, t])), [tokens])

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openEditor = (token: UrlToken) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (suppressedReopenTokenRef.current === token.name) {
      return
    }
    if (editingVarName !== token.name) {
      setEditingVarName(token.name)
      setEditingValue(token.value)
    }
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      if (hoveredTokenRef.current || isContentHoveredRef.current) {
        return
      }
      if (editingVarNameRef.current) {
        suppressedReopenTokenRef.current = editingVarNameRef.current
      }
      closeEditor()
    }, 220)
  }

  const closeEditor = () => {
    setEditingVarName(null)
    setEditingValue('')
    setIsSaving(false)
  }

  useEffect(() => {
    editingVarNameRef.current = editingVarName
  }, [editingVarName])

  useEffect(() => {
    return () => {
      clearCloseTimer()
    }
  }, [])

  const handleTokenPointerEnter = (token: UrlToken) => {
    hoveredTokenRef.current = token.name
    openEditor(token)
  }

  const handleTokenPointerLeave = (tokenName: string) => {
    if (hoveredTokenRef.current === tokenName) {
      hoveredTokenRef.current = null
    }
    if (suppressedReopenTokenRef.current === tokenName) {
      suppressedReopenTokenRef.current = null
    }
    scheduleClose()
  }

  const handleSave = async () => {
    if (!editingVarName) return
    setIsSaving(true)
    try {
      await onSaveVariable(editingVarName, editingValue)
      closeEditor()
    } finally {
      setIsSaving(false)
    }
  }

  const tokenBadgeClass = (source: UrlToken['source']) => {
    if (source === 'env') return 'bg-primary/15 text-primary border-primary/30'
    if (source === 'collection') return 'bg-accent text-accent-foreground border-border/70'
    return 'bg-destructive/10 text-destructive border-destructive/30'
  }

  const renderHighlightedValue = () => {
    if (!value) return null

    const parts: Array<{ type: 'text' | 'token'; value: string; name?: string }> = []
    let lastIndex = 0

    for (const match of value.matchAll(tokenRegex)) {
      const start = match.index ?? 0
      const full = match[0]
      const name = match[1].trim()
      if (start > lastIndex) {
        parts.push({ type: 'text', value: value.slice(lastIndex, start) })
      }
      parts.push({ type: 'token', value: full, name })
      lastIndex = start + full.length
    }
    if (lastIndex < value.length) {
      parts.push({ type: 'text', value: value.slice(lastIndex) })
    }

    return parts.map((part, idx) => {
      if (part.type === 'text') {
        return (
          <span key={`text-${idx}`} className="text-foreground/85">
            {part.value}
          </span>
        )
      }
      const token = part.name ? tokenByName.get(part.name) : null
      const source = token?.source ?? 'missing'
      return (
        <DropdownMenu
          key={`token-${idx}`}
          open={editingVarName === (token?.name ?? null)}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <span
              onPointerEnter={() => token && handleTokenPointerEnter(token)}
              onPointerLeave={() => {
                const tokenName = token?.name
                if (!tokenName) return
                handleTokenPointerLeave(tokenName)
              }}
              onFocus={() => token && openEditor(token)}
              className={`pointer-events-auto rounded px-0.5 border cursor-pointer ${tokenBadgeClass(source)}`}
              title={source === 'missing' ? 'Missing variable' : 'Edit variable value'}
              tabIndex={0}
            >
              {part.value}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-72 p-3 space-y-2"
            onMouseEnter={() => {
              isContentHoveredRef.current = true
              clearCloseTimer()
            }}
            onMouseLeave={() => {
              isContentHoveredRef.current = false
              scheduleClose()
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{`{{${token?.name ?? part.name ?? ''}}}`}</span>
              <span className="text-muted-foreground capitalize">{source}</span>
            </div>
            <Input
              value={editingVarName === (token?.name ?? '') ? editingValue : token?.value ?? ''}
              onChange={(e) => {
                const tokenName = token?.name ?? ''
                if (!tokenName) return
                if (editingVarName !== tokenName) {
                  setEditingVarName(tokenName)
                }
                setEditingValue(e.target.value)
              }}
              className="h-8 text-xs"
              placeholder="Variable value"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={closeEditor}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={async () => {
                  const tokenName = token?.name
                  if (!tokenName) return
                  if (editingVarName !== tokenName) {
                    setEditingVarName(tokenName)
                    setEditingValue(token?.value ?? '')
                    await onSaveVariable(tokenName, token?.value ?? '')
                    closeEditor()
                    return
                  }
                  await handleSave()
                }}
                disabled={isSaving}
              >
                Save
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    })
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${className ?? ''} ${value ? 'text-transparent caret-foreground' : ''}`}
        />
        {value && (
          <div className="absolute inset-0 px-3 flex items-center pointer-events-none overflow-hidden">
            <div className="w-full truncate text-sm font-mono leading-none">
              {renderHighlightedValue()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
