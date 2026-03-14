import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppRouter from '@/AppRouter'
import './globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  </React.StrictMode>,
)
