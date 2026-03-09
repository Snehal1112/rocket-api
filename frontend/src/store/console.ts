import { create } from 'zustand'
import { ConsoleEntry, HttpRequest, HttpResponse } from '@/types'

const MAX_ENTRIES = 200

interface ConsoleState {
  entries: ConsoleEntry[]
  addEntry: (req: HttpRequest, res: HttpResponse) => void
  clearEntries: () => void
}

function formatRequestBody(body: HttpRequest['body']): string {
  if (body.type === 'form-data') {
    return (body.formData ?? [])
      .filter(f => f.enabled)
      .map(f => f.type === 'file' ? `${f.key}: [file: ${f.fileName ?? 'unknown'}]` : `${f.key}: ${f.value}`)
      .join('\n') || '(empty form)'
  }
  if (body.type === 'binary') {
    return body.fileName ? `[binary: ${body.fileName}]` : '[binary: no file]'
  }
  return body.content
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  entries: [],

  addEntry: (req, res) => {
    const entry: ConsoleEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.status,
      statusText: res.statusText,
      duration: res.time,
      size: res.size,
      requestHeaders: req.headers
        .filter(h => h.enabled)
        .reduce<Record<string, string>>((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
      requestBody: formatRequestBody(req.body),
      responseHeaders: res.headers,
      responseBody: res.body,
    }
    set(state => ({
      entries: [entry, ...state.entries].slice(0, MAX_ENTRIES),
    }))
  },

  clearEntries: () => set({ entries: [] }),
}))
