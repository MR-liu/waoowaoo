'use client'

import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import SpreadsheetView, { type ColumnDef } from '@/components/spreadsheet/SpreadsheetView'
import { queryKeys } from '@/lib/query/keys'
import { CgWorkspaceProvider, useCgWorkspace } from './CgWorkspaceProvider'

// ─── API response types ─────────────────────────────────────────

interface CgShotRow extends Record<string, unknown> {
  id: string
  code: string
  name: string | null
  status: string
  frameIn: number | null
  frameOut: number | null
  duration: number | null
  sequence: { id: string; name: string; code: string }
}

interface CgAssetRow extends Record<string, unknown> {
  id: string
  code: string
  name: string
  assetType: string
  status: string
}

interface CgProductionTaskRow extends Record<string, unknown> {
  id: string
  status: string
  bidDays: number | null
  actualDays: number | null
  startDate: string | null
  dueDate: string | null
  pipelineStep: { id: string; name: string; code: string; color: string | null; icon: string | null }
  shot: { id: string; code: string; name: string | null } | null
  asset: { id: string; code: string; name: string | null; assetType: string } | null
  assignee: { id: string; name: string | null; email: string; image: string | null } | null
}

type CgTab = 'shots' | 'assets' | 'tasks'

// ─── Status chip renderer ────────────────────────────────────────

const STATUS_CHIP_CLASS: Record<string, string> = {
  not_started: 'glass-chip glass-chip-neutral',
  in_progress: 'glass-chip glass-chip-info',
  pending_review: 'glass-chip glass-chip-warning',
  approved: 'glass-chip glass-chip-success',
  final: 'glass-chip glass-chip-success',
}

function StatusChip({ status, label }: { status: string; label: string }) {
  const cls = STATUS_CHIP_CLASS[status] ?? 'glass-chip glass-chip-neutral'
  return <span className={cls}>{label}</span>
}

// ─── Fetchers ────────────────────────────────────────────────────

async function fetchJson<T>(url: string, key: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  const json: Record<string, unknown> = await res.json()
  return json[key] as T[]
}

async function patchEntity(url: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(err.message ?? `PATCH failed (${res.status})`)
  }
}

// ─── Tab button ──────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="glass-segmented-item px-4 py-1.5 text-sm"
      data-active={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ─── Shots tab ───────────────────────────────────────────────────

function ShotsTab() {
  const { projectId } = useCgWorkspace()
  const t = useTranslations('cg')
  const queryClient = useQueryClient()

  const { data: shots = [], isLoading } = useQuery({
    queryKey: queryKeys.cg.shots(projectId),
    queryFn: () => fetchJson<CgShotRow>(`/api/cg/${projectId}/shots`, 'shots'),
  })

  const columns = useMemo<ColumnDef<CgShotRow>[]>(
    () => [
      { key: 'code', label: t('columns.code'), width: 120, frozen: true, sortable: true },
      { key: 'name', label: t('columns.name'), width: 180, editable: true, sortable: true },
      {
        key: 'status',
        label: t('columns.status'),
        width: 140,
        sortable: true,
        render: (val) => {
          const s = String(val ?? 'not_started')
          return <StatusChip status={s} label={t(`status.${s}` as 'status.not_started')} />
        },
      },
      { key: 'frameIn', label: t('columns.frameIn'), width: 100, editable: true, sortable: true },
      { key: 'frameOut', label: t('columns.frameOut'), width: 100, editable: true, sortable: true },
      { key: 'duration', label: t('columns.duration'), width: 100, sortable: true },
    ],
    [t],
  )

  const handleCellEdit = useCallback(
    (rowIndex: number, key: string, value: unknown) => {
      const row = shots[rowIndex]
      if (!row) return
      const numericKeys = new Set(['frameIn', 'frameOut', 'duration'])
      const parsed = numericKeys.has(key)
        ? (value === '' || value == null ? null : Number(value))
        : value
      void patchEntity(`/api/cg/${projectId}/shots`, { id: row.id, [key]: parsed }).then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.cg.shots(projectId) })
      })
    },
    [shots, projectId, queryClient],
  )

  if (isLoading) {
    return <p className="p-6 text-center" style={{ color: 'var(--glass-text-secondary)' }}>{t('loading')}</p>
  }
  if (shots.length === 0) {
    return <p className="p-6 text-center" style={{ color: 'var(--glass-text-tertiary)' }}>{t('empty')}</p>
  }

  return (
    <div style={{ height: 'calc(100vh - 220px)' }}>
      <SpreadsheetView data={shots} columns={columns} onCellEdit={handleCellEdit} />
    </div>
  )
}

// ─── Assets tab ──────────────────────────────────────────────────

function AssetsTab() {
  const { projectId } = useCgWorkspace()
  const t = useTranslations('cg')
  const queryClient = useQueryClient()

  const { data: assets = [], isLoading } = useQuery({
    queryKey: queryKeys.cg.assets(projectId),
    queryFn: () => fetchJson<CgAssetRow>(`/api/cg/${projectId}/assets`, 'assets'),
  })

  const columns = useMemo<ColumnDef<CgAssetRow>[]>(
    () => [
      { key: 'code', label: t('columns.code'), width: 120, frozen: true, sortable: true },
      { key: 'name', label: t('columns.name'), width: 200, editable: true, sortable: true },
      { key: 'assetType', label: t('columns.assetType'), width: 140, sortable: true },
      {
        key: 'status',
        label: t('columns.status'),
        width: 140,
        sortable: true,
        render: (val) => {
          const s = String(val ?? 'not_started')
          return <StatusChip status={s} label={t(`status.${s}` as 'status.not_started')} />
        },
      },
    ],
    [t],
  )

  const handleCellEdit = useCallback(
    (rowIndex: number, key: string, value: unknown) => {
      const row = assets[rowIndex]
      if (!row) return
      void patchEntity(`/api/cg/${projectId}/assets`, { id: row.id, [key]: value }).then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.cg.assets(projectId) })
      })
    },
    [assets, projectId, queryClient],
  )

  if (isLoading) {
    return <p className="p-6 text-center" style={{ color: 'var(--glass-text-secondary)' }}>{t('loading')}</p>
  }
  if (assets.length === 0) {
    return <p className="p-6 text-center" style={{ color: 'var(--glass-text-tertiary)' }}>{t('empty')}</p>
  }

  return (
    <div style={{ height: 'calc(100vh - 220px)' }}>
      <SpreadsheetView data={assets} columns={columns} onCellEdit={handleCellEdit} />
    </div>
  )
}

// ─── Tasks tab ───────────────────────────────────────────────────

function entityName(row: CgProductionTaskRow): string {
  if (row.shot) return row.shot.name ?? row.shot.code
  if (row.asset) return row.asset.name ?? row.asset.code
  return '—'
}

function TasksTab() {
  const { projectId } = useCgWorkspace()
  const t = useTranslations('cg')
  const queryClient = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: queryKeys.cg.productionTasks(projectId),
    queryFn: () =>
      fetchJson<CgProductionTaskRow>(`/api/cg/${projectId}/production-tasks`, 'tasks'),
  })

  const columns = useMemo<ColumnDef<CgProductionTaskRow>[]>(
    () => [
      {
        key: 'shot',
        label: t('columns.entity'),
        width: 180,
        frozen: true,
        sortable: false,
        render: (_val, row) => <span className="truncate">{entityName(row)}</span>,
      },
      {
        key: 'pipelineStep',
        label: t('columns.pipelineStep'),
        width: 160,
        sortable: false,
        render: (val) => {
          const step = val as CgProductionTaskRow['pipelineStep'] | null
          return step ? step.name : '—'
        },
      },
      {
        key: 'status',
        label: t('columns.status'),
        width: 140,
        sortable: true,
        render: (val) => {
          const s = String(val ?? 'not_started')
          return <StatusChip status={s} label={t(`status.${s}` as 'status.not_started')} />
        },
      },
      {
        key: 'assignee',
        label: t('columns.assignee'),
        width: 150,
        sortable: false,
        render: (val) => {
          const user = val as CgProductionTaskRow['assignee']
          return user ? (user.name ?? user.email) : '—'
        },
      },
      { key: 'bidDays', label: t('columns.bidDays'), width: 110, editable: true, sortable: true },
      { key: 'actualDays', label: t('columns.actualDays'), width: 110, editable: true, sortable: true },
      {
        key: 'startDate',
        label: t('columns.startDate'),
        width: 130,
        sortable: true,
        render: (val) => (val ? new Date(val as string).toLocaleDateString() : '—'),
      },
      {
        key: 'dueDate',
        label: t('columns.dueDate'),
        width: 130,
        sortable: true,
        render: (val) => (val ? new Date(val as string).toLocaleDateString() : '—'),
      },
    ],
    [t],
  )

  const handleCellEdit = useCallback(
    (rowIndex: number, key: string, value: unknown) => {
      const row = tasks[rowIndex]
      if (!row) return
      const numericKeys = new Set(['bidDays', 'actualDays'])
      const parsed = numericKeys.has(key)
        ? (value === '' || value == null ? null : Number(value))
        : value
      void patchEntity(`/api/cg/${projectId}/production-tasks`, { id: row.id, [key]: parsed }).then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.cg.productionTasks(projectId) })
      })
    },
    [tasks, projectId, queryClient],
  )

  if (isLoading) {
    return <p className="p-6 text-center" style={{ color: 'var(--glass-text-secondary)' }}>{t('loading')}</p>
  }
  if (tasks.length === 0) {
    return <p className="p-6 text-center" style={{ color: 'var(--glass-text-tertiary)' }}>{t('empty')}</p>
  }

  return (
    <div style={{ height: 'calc(100vh - 220px)' }}>
      <SpreadsheetView data={tasks} columns={columns} onCellEdit={handleCellEdit} />
    </div>
  )
}

// ─── Main workspace content ──────────────────────────────────────

function CgWorkspaceContent() {
  const [activeTab, setActiveTab] = useState<CgTab>('shots')
  const t = useTranslations('cg')

  const handleTabChange = useCallback((tab: CgTab) => setActiveTab(tab), [])

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="glass-segmented self-start">
        <TabButton active={activeTab === 'shots'} onClick={() => handleTabChange('shots')}>
          {t('tabs.shots')}
        </TabButton>
        <TabButton active={activeTab === 'assets'} onClick={() => handleTabChange('assets')}>
          {t('tabs.assets')}
        </TabButton>
        <TabButton active={activeTab === 'tasks'} onClick={() => handleTabChange('tasks')}>
          {t('tabs.tasks')}
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === 'shots' && <ShotsTab />}
      {activeTab === 'assets' && <AssetsTab />}
      {activeTab === 'tasks' && <TasksTab />}
    </div>
  )
}

// ─── Exported wrapper ────────────────────────────────────────────

interface CgWorkspaceProps {
  projectId: string
}

export default function CgWorkspace({ projectId }: CgWorkspaceProps) {
  return (
    <CgWorkspaceProvider projectId={projectId}>
      <CgWorkspaceContent />
    </CgWorkspaceProvider>
  )
}
