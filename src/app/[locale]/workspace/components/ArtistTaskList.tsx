'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface AssignedTask {
  id: string
  projectId: string
  projectName: string
  shotCode: string | null
  assetCode: string | null
  stepName: string
  status: string
  dueDate: string | null
}

interface ArtistTaskListProps {
  tasks: AssignedTask[]
}

const STATUS_CHIP: Record<string, string> = {
  not_started: 'glass-chip-neutral',
  in_progress: 'glass-chip-info',
  pending_review: 'glass-chip-warning',
  approved: 'glass-chip-success',
  revision_requested: 'glass-chip-danger',
}

export default function ArtistTaskList({ tasks }: ArtistTaskListProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">
          {t('artist.title')}
        </h1>
        <p className="text-sm text-[var(--glass-text-secondary)] mt-1">
          {t('artist.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatMini label={t('artist.todo')} value={tasks.filter(t => t.status === 'not_started').length} />
        <StatMini label={t('artist.inProgress')} value={tasks.filter(t => t.status === 'in_progress').length} />
        <StatMini label={t('artist.needsRevision')} value={tasks.filter(t => t.status === 'revision_requested').length} />
      </div>

      <div className="glass-surface rounded-xl">
        <div className="px-4 py-3 border-b border-[var(--glass-stroke-soft)]">
          <h3 className="text-sm font-bold text-[var(--glass-text-primary)]">{t('artist.myTasks')}</h3>
        </div>
        <div className="divide-y divide-[var(--glass-stroke-soft)]">
          {tasks.map(task => (
            <Link
              key={task.id}
              href={`/workspace/${task.projectId}?stage=tasks`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--glass-bg-muted)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--glass-text-primary)]">
                  {task.shotCode || task.assetCode} — {task.stepName}
                </div>
                <div className="text-xs text-[var(--glass-text-tertiary)]">{task.projectName}</div>
              </div>
              <span className={`glass-chip ${STATUS_CHIP[task.status] || 'glass-chip-neutral'}`}>
                {task.status.replace(/_/g, ' ')}
              </span>
              {task.dueDate && (
                <span className="text-xs text-[var(--glass-text-tertiary)]">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </Link>
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-12 text-[var(--glass-text-tertiary)] text-sm">
              {t('artist.noTasks')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-surface p-3 rounded-xl text-center">
      <div className="text-2xl font-bold text-[var(--glass-text-primary)]">{value}</div>
      <div className="text-xs text-[var(--glass-text-tertiary)] mt-0.5">{label}</div>
    </div>
  )
}
