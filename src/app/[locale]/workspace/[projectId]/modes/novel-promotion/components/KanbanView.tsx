'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useWorkspaceProvider } from '../WorkspaceProvider'
import { useWorkspaceEpisodeStageData } from '../hooks/useWorkspaceEpisodeStageData'
import { AppIcon } from '@/components/ui/icons'
import type { NovelPromotionPanel, NovelPromotionStoryboard } from '@/types/project'

type KanbanStatus = 'pending' | 'processing' | 'completed'

interface KanbanCard {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  videoUrl: string | null
  status: KanbanStatus
  type: 'character' | 'location' | 'storyboard' | 'video' | 'voice'
}

interface KanbanColumn {
  id: KanbanStatus
  title: string
  cards: KanbanCard[]
}

function resolveStatus(panel: NovelPromotionPanel): KanbanStatus {
  if (panel.videoUrl) return 'completed'
  if (panel.imageUrl) return 'processing'
  return 'pending'
}

export default function KanbanView() {
  const t = useTranslations('kanban')
  const { storyboards } = useWorkspaceEpisodeStageData()

  const columns = useMemo<KanbanColumn[]>(() => {
    const cards: KanbanCard[] = storyboards.flatMap((sb: NovelPromotionStoryboard) =>
      (sb.panels ?? []).map((panel: NovelPromotionPanel) => ({
        id: panel.id,
        title: `Panel ${panel.panelIndex + 1}`,
        description: panel.description,
        imageUrl: panel.imageUrl ?? null,
        videoUrl: panel.videoUrl ?? null,
        status: resolveStatus(panel),
        type: 'storyboard' as const,
      }))
    )

    return [
      {
        id: 'pending' as const,
        title: t('columns.pending'),
        cards: cards.filter(c => c.status === 'pending'),
      },
      {
        id: 'processing' as const,
        title: t('columns.inProgress'),
        cards: cards.filter(c => c.status === 'processing'),
      },
      {
        id: 'completed' as const,
        title: t('columns.completed'),
        cards: cards.filter(c => c.status === 'completed'),
      },
    ]
  }, [storyboards, t])

  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0)

  if (totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-[var(--glass-bg-muted)] flex items-center justify-center mb-4">
          <AppIcon name="clapperboard" className="w-8 h-8 text-[var(--glass-text-tertiary)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--glass-text-secondary)] mb-1">
          {t('empty.title')}
        </p>
        <p className="text-xs text-[var(--glass-text-tertiary)]">
          {t('empty.description')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {columns.map((column) => (
        <div key={column.id} className="flex-shrink-0 w-72">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-[var(--glass-text-primary)]">
              {column.title}
            </h3>
            <span className="glass-chip glass-chip-neutral text-[10px]">
              {column.cards.length}
            </span>
          </div>

          <div className="space-y-2">
            {column.cards.map((card) => (
              <div
                key={card.id}
                className="glass-surface p-3 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
              >
                {(card.imageUrl || card.videoUrl) && (
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-[var(--glass-bg-muted)]">
                    {card.videoUrl ? (
                      <video
                        src={card.videoUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    ) : card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    {card.videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <AppIcon name="playCircle" className="w-8 h-8 text-white/90" />
                      </div>
                    )}
                  </div>
                )}
                <div className="text-sm font-semibold text-[var(--glass-text-primary)] mb-1">
                  {card.title}
                </div>
                {card.description && (
                  <p className="text-xs text-[var(--glass-text-tertiary)] line-clamp-2">
                    {card.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
