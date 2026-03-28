import { describe, it, expect } from 'vitest'
import { ROUTE_CATALOG } from '../../../contracts/route-catalog'

const CG_ROUTES = ROUTE_CATALOG.filter(
  (entry) => entry.contractGroup === 'crud-cg-routes',
)

describe('crud-cg-routes contract', () => {
  it('catalog contains CG routes', () => {
    expect(CG_ROUTES.length).toBeGreaterThan(0)
  })

  describe.each(CG_ROUTES)('$routeFile', ({ routeFile }) => {
    it('route file is registered in catalog', () => {
      expect(routeFile).toBeTruthy()
    })
  })
})
