import { describe, it, expect } from 'vitest'
import { ROUTE_CATALOG } from '../../../contracts/route-catalog'

const USER_PROJECT_ROUTES = ROUTE_CATALOG.filter(
  (entry) => entry.contractGroup === 'user-project-routes',
)

describe('user-project-routes contract', () => {
  it('catalog contains user-project routes', () => {
    expect(USER_PROJECT_ROUTES.length).toBeGreaterThan(0)
  })

  describe.each(USER_PROJECT_ROUTES)('$routeFile', ({ routeFile }) => {
    it('route file is registered in catalog', () => {
      expect(routeFile).toBeTruthy()
    })
  })
})
