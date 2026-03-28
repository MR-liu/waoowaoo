'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type { GanttTask, GhostBar, DependencyType } from '@/lib/gantt/dependency-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZoomLevel = 'day' | 'week' | 'month'

export interface GanttChartProps {
  tasks: GanttTask[]
  ghostBars?: GhostBar[]
  onTaskUpdate?: (taskId: string, update: { startDate: Date; endDate: Date }) => void
  onDependencyCreate?: (from: string, to: string, type: DependencyType) => void
}

interface TimelineColumn {
  date: Date
  label: string
  isToday: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 40
const TASK_BAR_HEIGHT = 24
const TASK_BAR_Y_OFFSET = (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2
const LABEL_COL_WIDTH = 220
const MIN_COLUMN_WIDTHS: Record<ZoomLevel, number> = {
  day: 36,
  week: 24,
  month: 16,
}
const HEADER_HEIGHT = 48
const DEPENDENCY_ARROW_SIZE = 6

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function formatHeaderLabel(date: Date, zoom: ZoomLevel): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  switch (zoom) {
    case 'day':
      return `${m}/${d}`
    case 'week':
      return `${m}/${d}`
    case 'month':
      return `${date.getFullYear()}-${String(m).padStart(2, '0')}`
  }
}

function computeTimelineRange(
  tasks: GanttTask[],
  ghostBars: GhostBar[],
): { start: Date; end: Date } {
  const now = startOfDay(new Date())
  let earliest = now
  let latest = addDays(now, 30)

  for (const t of tasks) {
    if (t.startDate < earliest) earliest = startOfDay(t.startDate)
    if (t.endDate > latest) latest = startOfDay(t.endDate)
  }
  for (const g of ghostBars) {
    if (g.projectedEnd > latest) latest = startOfDay(g.projectedEnd)
  }

  earliest = addDays(earliest, -2)
  latest = addDays(latest, 3)

  return { start: earliest, end: latest }
}

function generateColumns(
  start: Date,
  end: Date,
  zoom: ZoomLevel,
): TimelineColumn[] {
  const cols: TimelineColumn[] = []
  const today = startOfDay(new Date())
  let cursor = new Date(start)
  const step = zoom === 'month' ? 7 : zoom === 'week' ? 7 : 1

  while (cursor <= end) {
    cols.push({
      date: new Date(cursor),
      label: formatHeaderLabel(cursor, zoom),
      isToday:
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth() === today.getMonth() &&
        cursor.getDate() === today.getDate(),
    })
    cursor = addDays(cursor, step)
  }
  return cols
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GanttChart({
  tasks,
  ghostBars = [],
  onTaskUpdate,
  onDependencyCreate,
}: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day')
  const [dragState, setDragState] = useState<{
    taskId: string
    startX: number
    originalStart: Date
    originalEnd: Date
  } | null>(null)
  const [depStartTaskId, setDepStartTaskId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const colWidth = MIN_COLUMN_WIDTHS[zoom]
  const { start: timelineStart, end: timelineEnd } = useMemo(
    () => computeTimelineRange(tasks, ghostBars),
    [tasks, ghostBars],
  )
  const columns = useMemo(
    () => generateColumns(timelineStart, timelineEnd, zoom),
    [timelineStart, timelineEnd, zoom],
  )

  const totalDays = diffDays(timelineEnd, timelineStart)
  const chartWidth = totalDays * colWidth

  const dateToX = useCallback(
    (date: Date) => diffDays(startOfDay(date), timelineStart) * colWidth,
    [timelineStart, colWidth],
  )

  const taskIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach((t, i) => m.set(t.id, i))
    return m
  }, [tasks])

  // ----- Drag handlers -----

  const handleBarMouseDown = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      e.preventDefault()
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      setDragState({
        taskId,
        startX: e.clientX,
        originalStart: task.startDate,
        originalEnd: task.endDate,
      })
    },
    [tasks],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return
      const dx = e.clientX - dragState.startX
      const daysDelta = Math.round(dx / colWidth)
      if (daysDelta === 0) return

      const newStart = addDays(dragState.originalStart, daysDelta)
      const newEnd = addDays(dragState.originalEnd, daysDelta)
      onTaskUpdate?.(dragState.taskId, { startDate: newStart, endDate: newEnd })
    },
    [dragState, colWidth, onTaskUpdate],
  )

  const handleMouseUp = useCallback(() => {
    setDragState(null)
  }, [])

  // ----- Dependency creation -----

  const handleDepDotClick = useCallback(
    (taskId: string) => {
      if (!depStartTaskId) {
        setDepStartTaskId(taskId)
      } else if (depStartTaskId !== taskId) {
        onDependencyCreate?.(depStartTaskId, taskId, 'FS')
        setDepStartTaskId(null)
      } else {
        setDepStartTaskId(null)
      }
    },
    [depStartTaskId, onDependencyCreate],
  )

  // ----- Today indicator -----

  const today = startOfDay(new Date())
  const todayX =
    today >= timelineStart && today <= timelineEnd ? dateToX(today) : null

  // ----- Render -----

  const contentHeight = tasks.length * ROW_HEIGHT

  return (
    <div className="glass-surface" style={{ borderRadius: 'var(--glass-radius-md)', overflow: 'hidden' }}>
      {/* Zoom controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid var(--glass-stroke-soft)',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--glass-text-secondary)' }}>Zoom:</span>
        {(['day', 'week', 'month'] as const).map((level) => (
          <button
            key={level}
            className={zoom === level ? 'glass-btn-primary' : 'glass-btn-ghost'}
            style={{ padding: '4px 12px', fontSize: 12, borderRadius: 'var(--glass-radius-xs)' }}
            onClick={() => setZoom(level)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
        {depStartTaskId && (
          <span style={{ fontSize: 12, color: 'var(--glass-accent-from)', marginLeft: 'auto' }}>
            Select target task for dependency...
          </span>
        )}
      </div>

      {/* Main chart area */}
      <div
        ref={containerRef}
        style={{ display: 'flex', overflow: 'auto', position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Label column */}
        <div
          style={{
            minWidth: LABEL_COL_WIDTH,
            maxWidth: LABEL_COL_WIDTH,
            position: 'sticky',
            left: 0,
            zIndex: 3,
            background: 'var(--glass-bg-surface-strong)',
            borderRight: '1px solid var(--glass-stroke-soft)',
          }}
        >
          {/* Header spacer */}
          <div
            style={{
              height: HEADER_HEIGHT,
              borderBottom: '1px solid var(--glass-stroke-soft)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--glass-text-secondary)',
            }}
          >
            Task
          </div>
          {/* Task labels */}
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                height: ROW_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                fontSize: 13,
                color: 'var(--glass-text-primary)',
                borderBottom: '1px solid var(--glass-stroke-soft)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                cursor: 'pointer',
              }}
              onClick={() => handleDepDotClick(task.id)}
              title={depStartTaskId ? 'Click to create dependency' : task.name}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  marginRight: 8,
                  background:
                    task.progress >= 100
                      ? 'var(--glass-tone-success-bg)'
                      : 'var(--glass-accent-from)',
                  opacity: depStartTaskId === task.id ? 1 : 0.6,
                  flexShrink: 0,
                }}
              />
              {task.name}
              {task.assignee && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: 'var(--glass-text-secondary)',
                    opacity: 0.7,
                    paddingLeft: 8,
                  }}
                >
                  {task.assignee}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div style={{ flex: 1, position: 'relative', minWidth: chartWidth }}>
          {/* Column headers */}
          <div
            style={{
              height: HEADER_HEIGHT,
              display: 'flex',
              borderBottom: '1px solid var(--glass-stroke-soft)',
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: 'var(--glass-bg-surface)',
            }}
          >
            {columns.map((col, i) => (
              <div
                key={i}
                style={{
                  width: zoom === 'day' ? colWidth : colWidth * 7,
                  minWidth: zoom === 'day' ? colWidth : colWidth * 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: col.isToday
                    ? 'var(--glass-accent-from)'
                    : 'var(--glass-text-secondary)',
                  fontWeight: col.isToday ? 700 : 400,
                  borderRight: '1px solid var(--glass-stroke-soft)',
                }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Grid + bars */}
          <div style={{ position: 'relative', height: contentHeight }}>
            {/* Row backgrounds */}
            {tasks.map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid var(--glass-stroke-soft)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                }}
              />
            ))}

            {/* Today indicator */}
            {todayX !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: todayX,
                  width: 2,
                  height: contentHeight,
                  background: 'var(--glass-accent-from)',
                  opacity: 0.5,
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Ghost bars */}
            {ghostBars.map((ghost, gi) => {
              const rowIdx = taskIndexMap.get(ghost.taskId)
              if (rowIdx === undefined) return null
              const x = dateToX(ghost.projectedStart)
              const w = Math.max(
                colWidth,
                dateToX(ghost.projectedEnd) - x,
              )
              return (
                <div
                  key={`ghost-${gi}`}
                  title={ghost.reason}
                  style={{
                    position: 'absolute',
                    top: rowIdx * ROW_HEIGHT + TASK_BAR_Y_OFFSET,
                    left: x,
                    width: w,
                    height: TASK_BAR_HEIGHT,
                    borderRadius: 'var(--glass-radius-xs)',
                    background: 'var(--glass-tone-danger-bg)',
                    border: '1px dashed rgba(220, 38, 38, 0.4)',
                    opacity: 0.55,
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                />
              )
            })}

            {/* Task bars */}
            {tasks.map((task) => {
              const rowIdx = taskIndexMap.get(task.id)!
              const x = dateToX(task.startDate)
              const w = Math.max(colWidth, dateToX(task.endDate) - x)
              const progressW = (w * task.progress) / 100

              return (
                <div
                  key={task.id}
                  style={{
                    position: 'absolute',
                    top: rowIdx * ROW_HEIGHT + TASK_BAR_Y_OFFSET,
                    left: x,
                    width: w,
                    height: TASK_BAR_HEIGHT,
                    borderRadius: 'var(--glass-radius-xs)',
                    background: 'var(--glass-bg-surface-strong)',
                    border: '1px solid var(--glass-stroke-base)',
                    cursor: 'grab',
                    zIndex: 2,
                    overflow: 'hidden',
                  }}
                  onMouseDown={(e) => handleBarMouseDown(task.id, e)}
                >
                  {/* Progress fill */}
                  <div
                    style={{
                      width: progressW,
                      height: '100%',
                      background:
                        task.progress >= 100
                          ? 'rgba(22, 163, 74, 0.35)'
                          : 'linear-gradient(90deg, var(--glass-accent-from), var(--glass-accent-to))',
                      opacity: 0.4,
                      borderRadius: 'var(--glass-radius-xs)',
                    }}
                  />
                  {/* Label inside bar */}
                  {w > 60 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 6,
                        right: 6,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 11,
                        color: 'var(--glass-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        pointerEvents: 'none',
                      }}
                    >
                      {task.name}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Dependency lines (SVG overlay) */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: chartWidth,
                height: contentHeight,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {tasks.flatMap((task) =>
                task.dependencies
                  .filter((dep) => taskIndexMap.has(dep.taskId))
                  .map((dep) => {
                    const fromIdx = taskIndexMap.get(dep.taskId)!
                    const toIdx = taskIndexMap.get(task.id)!
                    const fromTask = tasks[fromIdx]

                    const x1 = dateToX(fromTask.endDate)
                    const y1 = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                    const x2 = dateToX(task.startDate)
                    const y2 = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2

                    const midX = (x1 + x2) / 2

                    return (
                      <g key={`dep-${dep.taskId}-${task.id}`}>
                        <path
                          d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                          fill="none"
                          stroke="var(--glass-stroke-base)"
                          strokeWidth={1.5}
                          opacity={0.6}
                        />
                        {/* Arrowhead */}
                        <polygon
                          points={`${x2},${y2} ${x2 - DEPENDENCY_ARROW_SIZE},${y2 - DEPENDENCY_ARROW_SIZE / 2} ${x2 - DEPENDENCY_ARROW_SIZE},${y2 + DEPENDENCY_ARROW_SIZE / 2}`}
                          fill="var(--glass-stroke-base)"
                          opacity={0.6}
                        />
                      </g>
                    )
                  }),
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
