import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestBuilderTabs } from '@/components/request-builder/RequestBuilderTabs'
import { AuthConfig, RequestBody, Scripts } from '@/types'

vi.mock('@/components/ui/monaco-editor', () => ({
  MonacoEditor: ({ value, onChange, language }: { value: string; onChange: (v: string) => void; language: string }) => (
    <textarea
      aria-label={`editor-${language}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

function renderComponent(overrides?: Partial<{ scripts: Scripts }>) {
  const setScripts = vi.fn()
  const scripts: Scripts = overrides?.scripts ?? {
    language: 'javascript',
    preRequest: "pm.environment.set('token', 'abc')",
    postResponse: "pm.test('ok', () => {})",
  }

  render(
    <RequestBuilderTabs
      headers={[]}
      queryParams={[]}
      pathParams={[]}
      body={{ type: 'none', content: '' } as RequestBody}
      auth={{ type: 'none' } as AuthConfig}
      scripts={scripts}
      setBody={vi.fn()}
      setAuth={vi.fn()}
      setScripts={setScripts}
      addHeader={vi.fn()}
      removeHeader={vi.fn()}
      updateHeader={vi.fn()}
      addQueryParam={vi.fn()}
      removeQueryParam={vi.fn()}
      updateQueryParam={vi.fn()}
      addPathParam={vi.fn()}
      removePathParam={vi.fn()}
      updatePathParam={vi.fn()}
      addFormDataField={vi.fn()}
      removeFormDataField={vi.fn()}
      updateFormDataField={vi.fn()}
      handleFileUpload={vi.fn()}
      handleBinaryUpload={vi.fn()}
    />
  )

  return { setScripts, scripts }
}

describe('RequestBuilderTabs scripts UI', () => {
  it('shows a Scripts tab with pre/post script panes', () => {
    renderComponent()

    expect(screen.getByText('Pre-request script')).toBeInTheDocument()
    expect(screen.getByText('Post-response script')).toBeInTheDocument()
  })

  it('calls setScripts when editing script content', () => {
    const { setScripts, scripts } = renderComponent()

    const editors = screen.getAllByRole('textbox', { hidden: true })
    const preEditor = editors[0]
    fireEvent.change(preEditor, { target: { value: "pm.environment.set('token', 'updated')" } })

    expect(setScripts).toHaveBeenCalledWith({
      ...scripts,
      preRequest: "pm.environment.set('token', 'updated')",
    })
  })
})
