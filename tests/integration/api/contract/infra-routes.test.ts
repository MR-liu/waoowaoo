import { describe, it, expect } from 'vitest'
import { ROUTE_CATALOG } from '../../../contracts/route-catalog'

const INFRA_ROUTES = ROUTE_CATALOG.filter(
  (entry) => entry.contractGroup === 'infra-routes',
)

describe('infra-routes contract', () => {
  it('catalog contains infra routes', () => {
    expect(INFRA_ROUTES.length).toBeGreaterThan(0)
  })

  describe.each(INFRA_ROUTES)('$routeFile', ({ routeFile }) => {
    it('route file is registered in catalog', () => {
      expect(routeFile).toBeTruthy()
    })
  })
})
