import React, { Suspense } from 'react'
import { HashRouter as Router } from 'react-router-dom'
import routes from '@/app/routes'
import { Provider as RoutesProvider, useRoutes } from '@/providers/Routes'

function Routes() {
  const element = useRoutes()
  return <React.Fragment>{element}</React.Fragment>
}

export default function AppRouter() {
  return (
    <RoutesProvider routes={routes}>
      <Suspense fallback={null}>
        <Router>
          <Routes />
        </Router>
      </Suspense>
    </RoutesProvider>
  )
}

