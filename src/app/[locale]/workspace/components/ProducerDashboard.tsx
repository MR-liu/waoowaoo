'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface ProjectSummary {
  id: string
  name: string
  projectType: string
  updatedAt: string
  stats?: { episodes: number; images: number; videos: number }
  totalCost?: number
}

interface ProducerDashboardProps {
  projects: ProjectSummary[]
  onCreateProject: () => void
}

export default function ProducerDashboard({ projects, onCreateProject }: ProducerDashboardProps) {
  const t = useTranslations('dashboard')

  const totalProjects = projects.length
  const cgProjects = projects.filter(p => p.projectType === 'cg').length
  const npProjects = projects.filter(p => p.projectType === 'novel-promotion').length
  const totalCost = projects.reduce((sum, p) => sum + (p.totalCost ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">
            {t('producer.title')}
          </h1>
          <p className="text-sm text-[var(--glass-text-secondary)] mt-1">
            {t('producer.subtitle')}
          </p>
        </div>
        <button
          onClick={onCreateProject}
          className="glass-btn-base glass-btn-primary px-5 py-2.5 rounded-xl"
        >
          <AppIcon name="plus" className="w-4 h-4" />
          {t('producer.newProject')}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('producer.totalProjects')} value={totalProjects} icon="folder" color="var(--glass-tone-info-fg)" />
        <StatCard label={t('producer.cgProjects')} value={cgProjects} icon="clapperboard" color="var(--glass-accent-from)" />
        <StatCard label={t('producer.npProjects')} value={npProjects} icon="film" color="var(--glass-tone-success-fg)" />
        <StatCard label={t('producer.totalCost')} value={`¥${totalCost.toFixed(0)}`} icon="coins" color="var(--glass-tone-warning-fg)" />
      </div>

      <div className="glass-surface rounded-xl p-4">
        <h3 className="text-sm font-bold text-[var(--glass-text-primary)] mb-3">{t('producer.recentProjects')}</h3>
        <div className="space-y-2">
          {projects.slice(0, 10).map(project => (
            <Link
              key={project.id}
              href={`/workspace/${project.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--glass-bg-muted)] transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                project.projectType === 'cg' ? 'bg-blue-500' : 'bg-purple-500'
              }`}>
                {project.projectType === 'cg' ? 'CG' : 'NP'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--glass-text-primary)] truncate">{project.name}</div>
                <div className="text-xs text-[var(--glass-text-tertiary)]">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <AppIcon name="chevronRight" className="w-4 h-4 text-[var(--glass-text-tertiary)]" />
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="text-center py-8 text-[var(--glass-text-tertiary)] text-sm">
              {t('producer.noProjects')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="glass-surface p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <AppIcon name={icon as Parameters<typeof AppIcon>[0]['name']} className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-[var(--glass-text-tertiary)]">{label}</span>
      </div>
      <div className="text-xl font-bold text-[var(--glass-text-primary)]">{value}</div>
    </div>
  )
}
