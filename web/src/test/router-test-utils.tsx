import type { ReactElement } from 'react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { OrgsProvider } from '@/lib/orgs-context'

import { render } from './test-utils'

/**
 * Renders `ui` at `/` inside a minimal in-memory router, for components
 * that use `<Link>`/`useNavigate` (e.g. links to `/orgs/$orgId`,
 * `/orgs/$orgId/members`, or `/boards/$boardId`) but don't need the app's
 * full route tree to be exercised. Registers those target routes with stub
 * components so `<Link>` resolves real hrefs.
 */
export function renderWithRouter(ui: ReactElement) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <OrgsProvider>{ui}</OrgsProvider>,
  })
  const orgDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/orgs/$orgId',
    component: () => <div>Org detail stub</div>,
  })
  const orgMembersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/orgs/$orgId/members',
    component: () => <div>Members stub</div>,
  })
  const boardDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/boards/$boardId',
    component: () => <div>Board detail stub</div>,
  })
  const routeTree = rootRoute.addChildren([
    indexRoute,
    orgDetailRoute,
    orgMembersRoute,
    boardDetailRoute,
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return render(<RouterProvider router={router} />)
}
