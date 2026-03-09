import { render, screen, fireEvent } from '@testing-library/react'
import { describe, beforeEach, it, expect, vi } from 'vitest'
import { ConsolePanel } from '@/components/layout/ConsolePanel'
import { useConsoleStore } from '@/store/console'

const defaultProps = {
  isOpen: true,
  height: 280,
  onHeightChange: vi.fn(),
}

describe('ConsolePanel', () => {
  beforeEach(() => {
    useConsoleStore.setState({ entries: [] })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ConsolePanel {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows empty state when no entries', () => {
    render(<ConsolePanel {...defaultProps} />)
    expect(screen.getByText('No requests sent yet')).toBeInTheDocument()
  })

  it('shows an entry row with method, url, status', () => {
    useConsoleStore.setState({
      entries: [{
        id: '1',
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: 'https://api.example.com/users',
        status: 200,
        statusText: 'OK',
        duration: 142,
        size: 12,
        requestHeaders: {},
        requestBody: '',
        responseHeaders: {},
        responseBody: '{}',
      }],
    })
    render(<ConsolePanel {...defaultProps} />)
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(screen.getByText(/api\.example\.com\/users/)).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('expands entry detail on row click', () => {
    useConsoleStore.setState({
      entries: [{
        id: '1',
        timestamp: new Date().toISOString(),
        method: 'POST',
        url: 'https://api.example.com/users',
        status: 201,
        statusText: 'Created',
        duration: 88,
        size: 24,
        requestHeaders: { 'Content-Type': 'application/json' },
        requestBody: '{"name":"Alice"}',
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: '{"id":1}',
      }],
    })
    render(<ConsolePanel {...defaultProps} />)
    // Detail not visible initially
    expect(screen.queryByText('Request Headers')).not.toBeInTheDocument()
    // Click the row
    fireEvent.click(screen.getByText('POST').closest('[data-testid="console-entry-row"]')!)
    // Detail now visible
    expect(screen.getByText('Request Headers')).toBeInTheDocument()
    expect(screen.getByText('Content-Type')).toBeInTheDocument()
    expect(screen.getByText('Response Body')).toBeInTheDocument()
  })

  it('clears entries when Clear button is clicked', () => {
    useConsoleStore.setState({
      entries: [{
        id: '1',
        timestamp: new Date().toISOString(),
        method: 'GET',
        url: 'https://api.example.com',
        status: 200,
        statusText: 'OK',
        duration: 50,
        size: 0,
        requestHeaders: {},
        requestBody: '',
        responseHeaders: {},
        responseBody: '',
      }],
    })
    render(<ConsolePanel {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByText('No requests sent yet')).toBeInTheDocument()
  })
})
