import React from 'react'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { authOptions } from '@/lib/auth'
import { isAdminSession } from '@/lib/admin'
import AdminUsersClient from './AdminUsersClient'

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await getServerSession(authOptions)
  const t = await getTranslations({ locale, namespace: 'common' })

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/signin`)
  }

  if (!isAdminSession(session)) {
    return (
      <div className="glass-page min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="glass-surface-modal p-8 text-center">
            <h1 className="text-2xl font-semibold text-[var(--glass-text-primary)]">
              {t('adminUsers.forbiddenTitle')}
            </h1>
            <p className="mt-3 text-[var(--glass-text-secondary)]">
              {t('adminUsers.forbiddenDescription')}
            </p>
            <div className="mt-6">
              <Link href={`/${locale}/workspace`} className="glass-btn-base glass-btn-primary px-5 py-2.5 font-medium">
                {t('adminUsers.backToWorkspace')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-page min-h-screen">
      <Navbar />
      <AdminUsersClient />
    </div>
  )
}
