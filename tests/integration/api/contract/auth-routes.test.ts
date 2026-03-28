import { describe, it, expect } from 'vitest'
import { ROUTE_CATALOG } from '../../../contracts/route-catalog'

const AUTH_ROUTES = ROUTE_CATALOG.filter(
  (entry) => entry.contractGroup === 'auth-routes',
)

describe('auth-routes contract', () => {
  it('catalog contains auth routes', () => {
    expect(AUTH_ROUTES.length).toBeGreaterThan(0)
  })

  describe.each(AUTH_ROUTES)('$routeFile', ({ routeFile }) => {
    it('route file is registered in catalog', () => {
      expect(routeFile).toBeTruthy()
    })
  })
})
