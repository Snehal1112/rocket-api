import { IRouteObject } from '@/providers/Routes/Context'
import App from '@/App'
import { NotFoundPage } from '@/routes/NotFoundPage'

export const routes: IRouteObject[] = [
  {
    path: '/',
    element: <App />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]

export default routes

