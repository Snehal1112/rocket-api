import Editor from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
}

const SUPPORTED_LANGUAGES = [
  { value: 'json', label: 'JSON', icon: '{ }' },
  { value: 'javascript', label: 'JavaScript', icon: 'JS' },
  { value: 'typescript', label: 'TypeScript', icon: 'TS' },
  { value: 'html', label: 'HTML', icon: '</>' },
  { value: 'xml', label: 'XML', icon: '</>' },
  { value: 'yaml', label: 'YAML', icon: 'YML' },
  { value: 'plaintext', label: 'Plain Text', icon: 'TXT' },
  { value: 'graphql', label: 'GraphQL', icon: 'GQL' },
  { value: 'sql', label: 'SQL', icon: 'SQL' },
]

export function MonacoEditor({
  value,
  onChange,
  language = 'json',
  height = '200px',
}: MonacoEditorProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch - suppressHydrationWarning handles the mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const defineThemes = (monaco: typeof import('monaco-editor')) => {
    monaco.editor.defineTheme('rocket-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#F7FAFC',
        'editor.foreground': '#111827',
        'editorLineNumber.foreground': '#64748B',
        'editorLineNumber.activeForeground': '#1E293B',
        'editorCursor.foreground': '#0D63CA',
        'editor.selectionBackground': '#BFDBFE',
        'editor.inactiveSelectionBackground': '#DBEAFE',
        'editor.lineHighlightBackground': '#EEF4FF',
      },
    })

    monaco.editor.defineTheme('rocket-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#141C2E',
        'editor.foreground': '#DDE7FB',
        'editorLineNumber.foreground': '#7D8BA8',
        'editorLineNumber.activeForeground': '#C2D4FF',
        'editorCursor.foreground': '#5DA2FF',
        'editor.selectionBackground': '#1E4F91',
        'editor.inactiveSelectionBackground': '#1B335D',
        'editor.lineHighlightBackground': '#1B273F',
      },
    })
  }

  const editorTheme = resolvedTheme === 'dark' ? 'rocket-dark' : 'rocket-light'

  if (!mounted) {
    return (
      <div 
        className="relative flex items-center justify-center bg-muted" 
        style={{ height }}
      >
        <span className="text-sm text-muted-foreground">Loading editor...</span>
      </div>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      <Editor
        height={height}
        language={language}
        value={value}
        theme={editorTheme}
        beforeMount={defineThemes}
        onChange={(newValue) => onChange(newValue || '')}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontSize: 14,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'on',
          lineNumbers: 'on',
          folding: true,
          formatOnPaste: true,
          formatOnType: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading editor...
          </div>
        }
      />
    </div>
  )
}

export { SUPPORTED_LANGUAGES }
