import { describe, beforeEach, it, expect } from 'vitest'
import { useConsoleStore } from '@/store/console'
import { HttpRequest, HttpResponse } from '@/types'

const mockReq: HttpRequest = {
  id: 'req-1',
  name: 'Test',
  method: 'GET',
  url: 'https://api.example.com/users',
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  body: { type: 'none', content: '' },
  queryParams: [],
  auth: { type: 'none' },
}

const mockRes: HttpResponse = {
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: '{"users":[]}',
  size: 12,
  time: 142,
}

describe('useConsoleStore', () => {
  beforeEach(() => {
    useConsoleStore.setState({ entries: [] })
  })

  it('adds an entry with mapped fields', () => {
    useConsoleStore.getState().addEntry(mockReq, mockRes)
    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].method).toBe('GET')
    expect(entries[0].url).toBe('https://api.example.com/users')
    expect(entries[0].status).toBe(200)
    expect(entries[0].duration).toBe(142)
    expect(entries[0].requestHeaders).toEqual({ Accept: 'application/json' })
    expect(entries[0].requestBody).toBe('')
    expect(entries[0].responseBody).toBe('{"users":[]}')
  })

  it('prepends new entries (newest first)', () => {
    useConsoleStore.getState().addEntry(mockReq, mockRes)
    useConsoleStore.getState().addEntry({ ...mockReq, url: 'https://api.example.com/posts' }, mockRes)
    const entries = useConsoleStore.getState().entries
    expect(entries[0].url).toBe('https://api.example.com/posts')
  })

  it('excludes disabled request headers', () => {
    const reqWithDisabled: HttpRequest = {
      ...mockReq,
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'X-Debug', value: '1', enabled: false },
      ],
    }
    useConsoleStore.getState().addEntry(reqWithDisabled, mockRes)
    expect(useConsoleStore.getState().entries[0].requestHeaders).toEqual({
      Accept: 'application/json',
    })
  })

  it('clears all entries', () => {
    useConsoleStore.getState().addEntry(mockReq, mockRes)
    useConsoleStore.getState().clearEntries()
    expect(useConsoleStore.getState().entries).toHaveLength(0)
  })

  it('formats form-data body fields', () => {
    const reqWithFormData: HttpRequest = {
      ...mockReq,
      body: {
        type: 'form-data',
        content: '',
        formData: [
          { key: 'name', value: 'Alice', type: 'text', enabled: true },
          { key: 'avatar', value: '', type: 'file', fileName: 'photo.jpg', enabled: true },
          { key: 'disabled', value: 'x', type: 'text', enabled: false },
        ],
      },
    }
    useConsoleStore.getState().addEntry(reqWithFormData, mockRes)
    expect(useConsoleStore.getState().entries[0].requestBody).toBe('name: Alice\navatar: [file: photo.jpg]')
  })

  it('formats binary body', () => {
    const reqWithBinary: HttpRequest = {
      ...mockReq,
      body: { type: 'binary', content: '', fileName: 'data.bin' },
    }
    useConsoleStore.getState().addEntry(reqWithBinary, mockRes)
    expect(useConsoleStore.getState().entries[0].requestBody).toBe('[binary: data.bin]')
  })

  it('caps entries at 200, dropping oldest', () => {
    for (let i = 0; i < 201; i++) {
      useConsoleStore.getState().addEntry({ ...mockReq, url: `https://api.example.com/${i}` }, mockRes)
    }
    const entries = useConsoleStore.getState().entries
    expect(entries).toHaveLength(200)
    expect(entries[0].url).toBe('https://api.example.com/200')
    expect(entries.find(e => e.url === 'https://api.example.com/0')).toBeUndefined()
  })
})
