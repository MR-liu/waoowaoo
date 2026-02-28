import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

async function readWorkspaceFile(relativePath: string): Promise<string> {
  return await readFile(path.join(process.cwd(), relativePath), 'utf8')
}

describe('brand/auth regression', () => {
  it('removes signup entries and routes from public entry files', async () => {
    const [navbar, landing, signin] = await Promise.all([
      readWorkspaceFile('src/components/Navbar.tsx'),
      readWorkspaceFile('src/app/[locale]/page.tsx'),
      readWorkspaceFile('src/app/[locale]/auth/signin/page.tsx'),
    ])

    expect(navbar.includes('/auth/signup')).toBe(false)
    expect(navbar.includes("t('signup')")).toBe(false)
    expect(landing.includes('/auth/signup')).toBe(false)
    expect(signin.includes('/auth/signup')).toBe(false)
  })

  it('uses fold-x display brand and drops signup i18n keys', async () => {
    const [zhCommonRaw, enCommonRaw, zhLandingRaw, enLandingRaw, zhNavRaw, enNavRaw, zhAuthRaw, enAuthRaw] = await Promise.all([
      readWorkspaceFile('messages/zh/common.json'),
      readWorkspaceFile('messages/en/common.json'),
      readWorkspaceFile('messages/zh/landing.json'),
      readWorkspaceFile('messages/en/landing.json'),
      readWorkspaceFile('messages/zh/nav.json'),
      readWorkspaceFile('messages/en/nav.json'),
      readWorkspaceFile('messages/zh/auth.json'),
      readWorkspaceFile('messages/en/auth.json'),
    ])

    const zhCommon = JSON.parse(zhCommonRaw) as Record<string, unknown>
    const enCommon = JSON.parse(enCommonRaw) as Record<string, unknown>
    const zhLanding = JSON.parse(zhLandingRaw) as { title?: string; footer?: { copyright?: string } }
    const enLanding = JSON.parse(enLandingRaw) as { title?: string; footer?: { copyright?: string } }
    const zhNav = JSON.parse(zhNavRaw) as Record<string, unknown>
    const enNav = JSON.parse(enNavRaw) as Record<string, unknown>
    const zhAuth = JSON.parse(zhAuthRaw) as Record<string, unknown>
    const enAuth = JSON.parse(enAuthRaw) as Record<string, unknown>

    expect(zhCommon.appName).toBe('fold-x')
    expect(enCommon.appName).toBe('fold-x')
    expect(zhLanding.title).toBe('fold-x')
    expect(enLanding.title).toBe('fold-x')
    expect(zhLanding.footer?.copyright?.includes('fold-x')).toBe(true)
    expect(enLanding.footer?.copyright?.includes('fold-x')).toBe(true)

    expect('signup' in zhNav).toBe(false)
    expect('signup' in enNav).toBe(false)

    expect('signupNow' in zhAuth).toBe(false)
    expect('signupNow' in enAuth).toBe(false)
    expect('signupButton' in zhAuth).toBe(false)
    expect('signupButton' in enAuth).toBe(false)
    expect('noAccount' in zhAuth).toBe(false)
    expect('noAccount' in enAuth).toBe(false)
  })
})
