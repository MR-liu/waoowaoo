'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface ReviewItem {
  id: string
  projectId: string
  projectName: string
  entityName: string
  versionNumber: number
  thumbnailUrl: string | null
  submittedBy: string
  submittedAt: string
}

interface DirectorReviewQueueProps {
  items: ReviewItem[]
}

export default function DirectorReviewQueue({ items }: DirectorReviewQueueProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">
          {t('director.title')}
        </h1>
        <p className="text-sm text-[var(--glass-text-secondary)] mt-1">
          {t('director.subtitle')}
        </p>
      </div>

      <div className="flex gap-3">
        <div className="glass-surface px-4 py-3 rounded-xl">
          <div className="text-2xl font-bold text-[var(--glass-tone-warning-fg)]">{items.length}</div>
          <div className="text-xs text-[var(--glass-text-tertiary)]">{t('director.pendingReview')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <Link
            key={item.id}
            href={`/workspace/${item.projectId}?stage=review`}
            className="glass-surface rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-[var(--glass-bg-muted)] flex items-center justify-center">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.entityName} className="w-full h-full object-cover" />
              ) : (
                <AppIcon name="film" className="w-8 h-8 text-[var(--glass-text-tertiary)]" />
              )}
            </div>
            <div className="p-3">
              <div className="text-sm font-semibold text-[var(--glass-text-primary)]">
                {item.entityName} v{String(item.versionNumber).padStart(3, '0')}
              </div>
              <div className="text-xs text-[var(--glass-text-tertiary)] mt-1">
                {item.projectName} · {item.submittedBy}
              </div>
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center py-16">
            <AppIcon name="check" className="w-12 h-12 text-[var(--glass-tone-success-fg)] mx-auto mb-3" />
            <p className="text-sm text-[var(--glass-text-secondary)]">{t('director.allClear')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
