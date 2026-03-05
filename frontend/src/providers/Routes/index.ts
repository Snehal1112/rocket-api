import { useContext } from 'react'
import { RouteObject, useRoutes as useRoutesBase } from 'react-router-dom'
import Context, { IContext } from '@/providers/Routes/Context'

export { default as Provider } from '@/providers/Routes/Provider'

export function useRoutesData(): IContext {
  return useContext(Context)
}

export function useRoutes(): ReturnType<typeof useRoutesBase> {
  const { routes, basename } = useContext(Context)
  return useRoutesBase(routes as RouteObject[], basename)
}

