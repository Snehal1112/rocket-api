import { FC, ReactNode } from 'react'
import Context, { defaultState, IRouteObject } from '@/providers/Routes/Context'

interface Props {
  children: ReactNode
  routes?: IRouteObject[]
  basename?: string
}

export const RoutesProvider: FC<Props> = ({ children, routes, basename }) => (
  <Context.Provider
    value={{
      routes: routes || defaultState.routes,
      basename: basename || defaultState.basename,
    }}
  >
    {children}
  </Context.Provider>
)

export default RoutesProvider

