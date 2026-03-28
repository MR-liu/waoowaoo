'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCgWorkspace } from '../CgWorkspaceProvider'

// ─── API response types ─────────────────────────────────────────

interface TaskStatusCount {
  status: string
  count: number
}

interface BurndownPoint {
  date: string
  planned: number
  actual: number
}

interface ResourceWeek {
  weekStart: string
  hoursAssigned: number
  taskCount: number
}

interface ResourceUtilization {
  userId: string
  userName: string
  weeks: ResourceWeek[]
}

interface PipelineStatusGroup {
  stepName: string
  stepCode: string
  color: string | null
  statusCounts: TaskStatusCount[]
}

interface CostSummary {
  totalBudgetDays: number
  actualSpentDays: number
  estimatedCostRate: number
}

interface DashboardData {
  totalShots: number
  totalAssets: number
  completionRate: number
  overdueTasks: number
  statusBreakdown: TaskStatusCount[]
  burndown: BurndownPoint[]
  resourceUtilization: ResourceUtilization[]
  pipelineStatus: PipelineStatusGroup[]
  costSummary: CostSummary
}

// ─── Fetcher ────────────────────────────────────────────────────

async function fetchDashboard(projectId: string): Promise<DashboardData> {
  const res = await fetch(`/api/cg/${projectId}/dashboard`)
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  const json: { dashboard: DashboardData } = await res.json()
  return json.dashboard
}

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'info' | 'success' | 'warning' | 'error'
}) {
  const accentColors: Record<string, string> = {
    info: 'var(--glass-accent-from)',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  }

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 24px',
        borderRadius: 'var(--glass-radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--glass-text-secondary)',
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: accent ? accentColors[accent] : 'var(--glass-text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── SVG Burndown Chart ─────────────────────────────────────────

function BurndownChart({ data }: { data: BurndownPoint[] }) {
  const t = useTranslations('cg')

  const chartMetrics = useMemo(() => {
    if (data.length === 0) return null

    const width = 600
    const height = 240
    const padding = { top: 20, right: 20, bottom: 40, left: 50 }
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom

    const maxVal = Math.max(...data.flatMap(d => [d.planned, d.actual]), 1)
    const xScale = innerWidth / Math.max(data.length - 1, 1)
    const yScale = innerHeight / maxVal

    const plannedPath = data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${padding.left + i * xScale} ${padding.top + innerHeight - d.planned * yScale}`)
      .join(' ')

    const actualPath = data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${padding.left + i * xScale} ${padding.top + innerHeight - d.actual * yScale}`)
      .join(' ')

    const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i))

    return { width, height, padding, innerWidth, innerHeight, maxVal, xScale, yScale, plannedPath, actualPath, yTicks }
  }, [data])

  if (!chartMetrics || data.length === 0) {
    return (
      <p style={{ color: 'var(--glass-text-tertiary)', textAlign: 'center', padding: 20 }}>
        {t('dashboard.noData')}
      </p>
    )
  }

  const { width, height, padding, innerHeight, xScale, yScale, plannedPath, actualPath, yTicks } = chartMetrics

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {yTicks.map(tick => (
        <line
          key={tick}
          x1={padding.left}
          y1={padding.top + innerHeight - tick * yScale}
          x2={width - padding.right}
          y2={padding.top + innerHeight - tick * yScale}
          stroke="var(--glass-stroke-soft)"
          strokeDasharray="4 4"
          opacity={0.5}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map(tick => (
        <text
          key={`label-${tick}`}
          x={padding.left - 8}
          y={padding.top + innerHeight - tick * yScale + 4}
          textAnchor="end"
          fontSize={11}
          fill="var(--glass-text-tertiary)"
        >
          {tick}
        </text>
      ))}

      {/* X-axis labels (show every other) */}
      {data.map((d, i) => (
        i % Math.max(1, Math.floor(data.length / 6)) === 0 ? (
          <text
            key={d.date}
            x={padding.left + i * xScale}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--glass-text-tertiary)"
          >
            {d.date.slice(5)}
          </text>
        ) : null
      ))}

      {/* Planned line */}
      <path d={plannedPath} fill="none" stroke="var(--glass-accent-from)" strokeWidth={2} opacity={0.6} strokeDasharray="6 3" />

      {/* Actual line */}
      <path d={actualPath} fill="none" stroke="#22c55e" strokeWidth={2.5} />

      {/* Legend */}
      <line x1={width - 180} y1={12} x2={width - 160} y2={12} stroke="var(--glass-accent-from)" strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
      <text x={width - 155} y={16} fontSize={11} fill="var(--glass-text-secondary)">{t('dashboard.planned')}</text>

      <line x1={width - 90} y1={12} x2={width - 70} y2={12} stroke="#22c55e" strokeWidth={2.5} />
      <text x={width - 65} y={16} fontSize={11} fill="var(--glass-text-secondary)">{t('dashboard.actual')}</text>
    </svg>
  )
}

// ─── Resource Heatmap ───────────────────────────────────────────

function ResourceHeatmap({ data }: { data: ResourceUtilization[] }) {
  const t = useTranslations('cg')

  if (data.length === 0 || data[0].weeks.length === 0) {
    return (
      <p style={{ color: 'var(--glass-text-tertiary)', textAlign: 'center', padding: 20 }}>
        {t('dashboard.noData')}
      </p>
    )
  }

  const maxHours = Math.max(...data.flatMap(r => r.weeks.map(w => w.hoursAssigned)), 1)

  function heatColor(hours: number): string {
    const intensity = Math.min(hours / maxHours, 1)
    if (intensity === 0) return 'var(--glass-bg-surface)'
    if (intensity < 0.3) return 'rgba(34, 197, 94, 0.2)'
    if (intensity < 0.6) return 'rgba(34, 197, 94, 0.4)'
    if (intensity < 0.8) return 'rgba(245, 158, 11, 0.5)'
    return 'rgba(239, 68, 68, 0.5)'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 12px',
                color: 'var(--glass-text-secondary)',
                fontWeight: 500,
                position: 'sticky',
                left: 0,
                background: 'var(--glass-bg-surface)',
                zIndex: 1,
              }}
            >
              {t('dashboard.resource')}
            </th>
            {data[0].weeks.map(w => (
              <th
                key={w.weekStart}
                style={{
                  padding: '6px 8px',
                  color: 'var(--glass-text-tertiary)',
                  fontWeight: 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {w.weekStart.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(resource => (
            <tr key={resource.userId}>
              <td
                style={{
                  padding: '6px 12px',
                  color: 'var(--glass-text-primary)',
                  fontWeight: 500,
                  position: 'sticky',
                  left: 0,
                  background: 'var(--glass-bg-surface)',
                  zIndex: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {resource.userName}
              </td>
              {resource.weeks.map(week => (
                <td
                  key={week.weekStart}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    background: heatColor(week.hoursAssigned),
                    borderRadius: 4,
                    color: 'var(--glass-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={`${week.hoursAssigned}h / ${week.taskCount} tasks`}
                >
                  {week.hoursAssigned > 0 ? week.hoursAssigned.toFixed(0) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pipeline Status Bar Chart ──────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  pending_review: '#f59e0b',
  approved: '#22c55e',
  final: '#10b981',
}

function PipelineStatusChart({ data }: { data: PipelineStatusGroup[] }) {
  const t = useTranslations('cg')

  if (data.length === 0) {
    return (
      <p style={{ color: 'var(--glass-text-tertiary)', textAlign: 'center', padding: 20 }}>
        {t('dashboard.noData')}
      </p>
    )
  }

  const maxCount = Math.max(
    ...data.map(step => step.statusCounts.reduce((sum, sc) => sum + sc.count, 0)),
    1,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(step => {
        const total = step.statusCounts.reduce((sum, sc) => sum + sc.count, 0)

        return (
          <div key={step.stepCode} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 120,
                fontSize: 13,
                fontWeight: 500,
                color: step.color ?? 'var(--glass-text-secondary)',
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {step.stepName}
            </span>
            <div
              style={{
                flex: 1,
                display: 'flex',
                height: 22,
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--glass-bg-surface)',
              }}
            >
              {step.statusCounts.map(sc => (
                <div
                  key={sc.status}
                  style={{
                    width: `${(sc.count / maxCount) * 100}%`,
                    background: STATUS_COLORS[sc.status] ?? '#94a3b8',
                    minWidth: sc.count > 0 ? 4 : 0,
                    transition: 'width 0.3s ease',
                  }}
                  title={`${t(`status.${sc.status}` as 'status.not_started')}: ${sc.count}`}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: 12,
                color: 'var(--glass-text-tertiary)',
                minWidth: 30,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {total}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Cost Summary ───────────────────────────────────────────────

function CostSummaryCard({ data }: { data: CostSummary }) {
  const t = useTranslations('cg')
  const usagePercent = Math.min(data.estimatedCostRate, 100)
  const barColor = usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span style={{ color: 'var(--glass-text-secondary)' }}>{t('dashboard.budgetDays')}</span>
        <span style={{ fontWeight: 600, color: 'var(--glass-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {data.totalBudgetDays.toFixed(1)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span style={{ color: 'var(--glass-text-secondary)' }}>{t('dashboard.actualDays')}</span>
        <span style={{ fontWeight: 600, color: 'var(--glass-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {data.actualSpentDays.toFixed(1)}
        </span>
      </div>
      <div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--glass-bg-surface)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${usagePercent}%`,
              background: barColor,
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--glass-text-tertiary)', marginTop: 4, display: 'block' }}>
          {data.estimatedCostRate}% {t('dashboard.utilized')}
        </span>
      </div>
    </div>
  )
}

// ─── Section wrapper ────────────────────────────────────────────

function DashboardSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 24px',
        borderRadius: 'var(--glass-radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--glass-text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────

export default function CgDashboard() {
  const { projectId } = useCgWorkspace()
  const t = useTranslations('cg')

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['cg', projectId, 'dashboard'],
    queryFn: () => fetchDashboard(projectId),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--glass-text-secondary)' }}>
        {t('loading')}
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--glass-text-tertiary)' }}>
        {t('dashboard.loadError')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0' }}>
      {/* Stats cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard label={t('dashboard.totalShots')} value={dashboard.totalShots} accent="info" />
        <StatCard label={t('dashboard.totalAssets')} value={dashboard.totalAssets} accent="info" />
        <StatCard label={t('dashboard.completionRate')} value={`${dashboard.completionRate}%`} accent="success" />
        <StatCard label={t('dashboard.overdueTasks')} value={dashboard.overdueTasks} accent={dashboard.overdueTasks > 0 ? 'error' : 'success'} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <DashboardSection title={t('dashboard.burndown')}>
          <BurndownChart data={dashboard.burndown} />
        </DashboardSection>

        <DashboardSection title={t('dashboard.costSummary')}>
          <CostSummaryCard data={dashboard.costSummary} />
        </DashboardSection>
      </div>

      {/* Pipeline status */}
      <DashboardSection title={t('dashboard.pipelineStatus')}>
        <PipelineStatusChart data={dashboard.pipelineStatus} />
      </DashboardSection>

      {/* Resource heatmap */}
      <DashboardSection title={t('dashboard.resourceUtilization')}>
        <ResourceHeatmap data={dashboard.resourceUtilization} />
      </DashboardSection>
    </div>
  )
}
