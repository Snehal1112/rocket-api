import { useState } from 'react'
import { HttpRequest, HttpResponse, QueryParam } from '@/types'
import { useCollectionsStore } from '@/store/collections'
import { EnvironmentsDialog } from '@/components/collections/EnvironmentsDialog'
import { CodeSnippetDialog } from '@/components/request-builder/CodeSnippetDialog'
import { RequestBuilderTabs } from '@/components/request-builder/RequestBuilderTabs'
import { RequestBuilderResponsePanel } from '@/components/request-builder/RequestBuilderResponsePanel'
import { RequestBuilderToolbar } from '@/components/request-builder/RequestBuilderToolbar'
import { useRequestBuilderState } from '@/components/request-builder/useRequestBuilderState'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface RequestBuilderProps {
  onRequestSent?: (request: HttpRequest, response: HttpResponse) => void
}

export function RequestBuilder({ onRequestSent }: RequestBuilderProps) {
  const [codeSnippetOpen, setCodeSnippetOpen] = useState(false)
  const {
    containerRef,
    requestHeight,
    isDragging,
    handleMouseDown,
    alertDialog,
    setAlertDialog,
    envDialogOpen,
    setEnvDialogOpen,
    activeCollection,
    environments,
    activeEnvironment,
    collectionVariables,
    setActiveEnvironment,
    name,
    setName,
    method,
    setMethod,
    url,
    setUrl,
    headers,
    queryParams,
    setQueryParams,
    pathParams,
    setPathParams,
    body,
    auth,
    scripts,
    setBody,
    setAuth,
    setScripts,
    isDirty,
    isLoading,
    response,
    handleSubmit,
    handleSaveRequest,
    handleSaveUrlVariable,
    handleImportCurl,
    addHeader,
    removeHeader,
    updateHeader,
    addQueryParam,
    removeQueryParam,
    updateQueryParam,
    addPathParam,
    removePathParam,
    updatePathParam,
    addFormDataField,
    removeFormDataField,
    updateFormDataField,
    handleFileUpload,
    handleBinaryUpload,
    updateActiveName,
  } = useRequestBuilderState({ onRequestSent })

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden bg-transparent">
      <div
        className="flex flex-col overflow-hidden bg-card/80"
        style={{ height: `${requestHeight}%`, minHeight: '20%', maxHeight: '80%' }}
      >
        <RequestBuilderToolbar
          name={name}
          setName={setName}
          method={method}
          setMethod={setMethod}
          url={url}
          setUrl={setUrl}
          isLoading={isLoading}
          isDirty={isDirty}
          activeCollection={activeCollection}
          activeEnvironment={activeEnvironment}
          environments={environments}
          collectionVariables={collectionVariables}
          pathParams={pathParams}
          queryParams={queryParams}
          onRequestNameChange={updateActiveName}
          onSetActiveEnvironment={(env) => {
            setActiveEnvironment(env)
            if (env && activeCollection) {
              useCollectionsStore.getState().fetchEnvironmentDetail(activeCollection.name, env.name)
            }
          }}
          onOpenEnvironmentsDialog={() => setEnvDialogOpen(true)}
          onSubmit={handleSubmit}
          onSave={handleSaveRequest}
          onSaveParamToken={async (tokenName, tokenValue, target) => {
            const upsert = (prev: QueryParam[]) => {
              const idx = prev.findIndex(p => p.key === tokenName)
              if (idx >= 0) {
                return prev.map((p, i) =>
                  i === idx ? { ...p, value: tokenValue, enabled: true } : p
                )
              }
              return [...prev, { key: tokenName, value: tokenValue, enabled: true }]
            }
            if (target === 'path') {
              setPathParams(prev => upsert(prev))
              return
            }
            setQueryParams(prev => upsert(prev))
          }}
          onSaveVariable={async (variableName, variableValue) => {
            try {
              await handleSaveUrlVariable(variableName, variableValue)
            } catch (error) {
              setAlertDialog({
                isOpen: true,
                title: 'Variable Update Failed',
                description:
                  error instanceof Error
                    ? error.message
                    : 'Unable to update variable value.',
              })
            }
          }}
          onGenerateCode={() => setCodeSnippetOpen(true)}
          onImportCurl={async (command) => {
            try {
              await handleImportCurl(command)
            } catch (error) {
              setAlertDialog({
                isOpen: true,
                title: 'cURL Import Failed',
                description:
                  error instanceof Error
                    ? error.message
                    : 'Unable to import cURL command.',
              })
            }
          }}
        />

        <RequestBuilderTabs
          headers={headers}
          queryParams={queryParams}
          pathParams={pathParams}
          body={body}
          auth={auth}
          scripts={scripts}
          setBody={setBody}
          setAuth={setAuth}
          setScripts={setScripts}
          addHeader={addHeader}
          removeHeader={removeHeader}
          updateHeader={updateHeader}
          addQueryParam={addQueryParam}
          removeQueryParam={removeQueryParam}
          updateQueryParam={updateQueryParam}
          addPathParam={addPathParam}
          removePathParam={removePathParam}
          updatePathParam={updatePathParam}
          addFormDataField={addFormDataField}
          removeFormDataField={removeFormDataField}
          updateFormDataField={updateFormDataField}
          handleFileUpload={handleFileUpload}
          handleBinaryUpload={handleBinaryUpload}
        />
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={`h-4 bg-muted/50 border-y border-border/80 flex items-center justify-center cursor-row-resize select-none transition-colors ${
          isDragging ? 'bg-primary/15 border-primary/50' : 'hover:bg-accent/70 hover:border-primary/40'
        }`}
      >
        <div className={`w-16 h-1.5 rounded-full transition-all ${isDragging ? 'w-24 h-2 bg-primary' : 'bg-muted-foreground/40'}`} />
      </div>

      <RequestBuilderResponsePanel response={response} />

      <AlertDialog open={alertDialog.isOpen} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EnvironmentsDialog open={envDialogOpen} onOpenChange={setEnvDialogOpen} />

      <CodeSnippetDialog
        open={codeSnippetOpen}
        onOpenChange={setCodeSnippetOpen}
        request={{ method, url, headers, queryParams, body, auth }}
      />
    </div>
  )
}
