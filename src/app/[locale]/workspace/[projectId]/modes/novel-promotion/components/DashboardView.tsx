'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useWorkspaceProvider } from '../WorkspaceProvider'
import { useWorkspaceEpisodeStageData } from '../hooks/useWorkspaceEpisodeStageData'
import { AppIcon } from '@/components/ui/icons'
import type { NovelPromotionPanel, NovelPromotionStoryboard } from '@/types/project'

interface StatCard {
  label: string
  value: number
  total: number
  icon: string
  color: string
}

export default function DashboardView() {
  const t = useTranslations('dashboard')
  const { storyboards, clips } = useWorkspaceEpisodeStageData()

  const stats = useMemo(() => {
    const allPanels = storyboards.flatMap(
      (sb: NovelPromotionStoryboard) => sb.panels ?? []
    )
    const totalPanels = allPanels.length
    const panelsWithImage = allPanels.filter((p: NovelPromotionPanel) => p.imageUrl).length
    const panelsWithVideo = allPanels.filter((p: NovelPromotionPanel) => p.videoUrl).length

    const cards: StatCard[] = [
      {
        label: t('stats.clips'),
        value: clips.length,
        total: clips.length,
        icon: 'film',
        color: 'var(--glass-tone-info-fg)',
      },
      {
        label: t('stats.storyboards'),
        value: storyboards.length,
        total: storyboards.length,
        icon: 'clapperboard',
        color: 'var(--glass-accent-from)',
      },
      {
        label: t('stats.images'),
        value: panelsWithImage,
        total: totalPanels,
        icon: 'image',
        color: 'var(--glass-tone-success-fg)',
      },
      {
        label: t('stats.videos'),
        value: panelsWithVideo,
        total: totalPanels,
        icon: 'video',
        color: 'var(--glass-tone-warning-fg)',
      },
    ]

    return { cards, totalPanels, panelsWithImage, panelsWithVideo }
  }, [storyboards, clips, t])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.cards.map((card) => {
          const pct = card.total > 0 ? Math.round((card.value / card.total) * 100) : 0

          return (
            <div key={card.label} className="glass-surface p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${card.color} 15%, transparent)` }}
                >
                  <AppIcon
                    name={card.icon as Parameters<typeof AppIcon>[0]['name']}
                    className="w-4 h-4"
                    style={{ color: card.color }}
                  />
                </div>
                <span className="text-xs font-semibold text-[var(--glass-text-tertiary)]">
                  {card.label}
                </span>
              </div>
              <div className="text-2xl font-bold text-[var(--glass-text-primary)] mb-1">
                {card.value}
                <span className="text-sm font-normal text-[var(--glass-text-tertiary)]"> / {card.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--glass-bg-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: card.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="glass-surface p-6 rounded-xl">
        <h3 className="text-sm font-bold text-[var(--glass-text-primary)] mb-4">
          {t('burndown.title')}
        </h3>
        <div className="h-48 flex items-end gap-1">
          {['storyboard', 'image', 'video', 'voice'].map((stage, i) => {
            const heights = [80, stats.totalPanels > 0 ? (stats.panelsWithImage / stats.totalPanels) * 100 : 0, stats.totalPanels > 0 ? (stats.panelsWithVideo / stats.totalPanels) * 100 : 0, 0]
            const pct = Math.max(4, heights[i])
            const colors = [
              'var(--glass-tone-info-fg)',
              'var(--glass-tone-success-fg)',
              'var(--glass-tone-warning-fg)',
              'var(--glass-accent-from)',
            ]

            return (
              <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex justify-center">
                  <div
                    className="w-8 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${pct * 1.8}px`,
                      background: colors[i],
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span className="text-[10px] text-[var(--glass-text-tertiary)] font-medium">
                  {t(`burndown.stages.${stage}`)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
