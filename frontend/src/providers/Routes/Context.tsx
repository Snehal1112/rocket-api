/* eslint-disable react-refresh/only-export-components */
import { createContext } from 'react'
import { RouteObject } from 'react-router-dom'

export interface IRouteObject extends Omit<RouteObject, 'children'> {
  children?: IRouteObject[]
}

export interface IContext {
  routes: IRouteObject[]
  basename?: string
}

export const defaultState: IContext = {
  routes: [],
  basename: '',
}

export const Context = createContext<IContext>(defaultState)

export default Context
