'use client'

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'

export interface ColumnDef<T> {
  key: keyof T & string
  label: string
  width: number
  editable?: boolean
  frozen?: boolean
  sortable?: boolean
  render?: (value: unknown, row: T) => ReactNode
}

export interface SpreadsheetProps<T extends Record<string, unknown>> {
  data: T[]
  columns: ColumnDef<T>[]
  rowHeight?: number
  onCellEdit?: (rowIndex: number, key: string, value: unknown) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  idKey?: string
}

type SortDir = 'asc' | 'desc'

interface SortState {
  key: string
  dir: SortDir | null
}

interface EditingCell {
  rowIndex: number
  colKey: string
}

const VIEWPORT_BUFFER = 5
const CHECKBOX_COL_WIDTH = 40

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  const numA = Number(a)
  const numB = Number(b)
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return dir === 'asc' ? numA - numB : numB - numA
  }

  const strA = String(a)
  const strB = String(b)
  const cmp = strA.localeCompare(strB)
  return dir === 'asc' ? cmp : -cmp
}

export default function SpreadsheetView<T extends Record<string, unknown>>({
  data,
  columns,
  rowHeight = 40,
  onCellEdit,
  onSelectionChange,
  idKey = 'id',
}: SpreadsheetProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortState, setSortState] = useState<SortState>({ key: '', dir: null })
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')

  // Observe container size for virtual scroll calculations
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortState.key || !sortState.dir) return data
    const dir = sortState.dir
    const key = sortState.key
    return [...data].sort((a, b) => compareValues(a[key], b[key], dir))
  }, [data, sortState])

  // Virtual scroll range
  const totalHeight = sortedData.length * rowHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - VIEWPORT_BUFFER)
  const visibleCount = Math.ceil(containerHeight / rowHeight) + 2 * VIEWPORT_BUFFER
  const endIndex = Math.min(sortedData.length, startIndex + visibleCount)
  const visibleRows = sortedData.slice(startIndex, endIndex)

  // Frozen column left offsets (cumulative widths including checkbox column)
  const frozenOffsets = useMemo(() => {
    const offsets = new Map<string, number>()
    let offset = CHECKBOX_COL_WIDTH
    for (const col of columns) {
      if (col.frozen) {
        offsets.set(col.key, offset)
        offset += col.width
      }
    }
    return offsets
  }, [columns])

  const totalWidth = useMemo(
    () => CHECKBOX_COL_WIDTH + columns.reduce((sum, col) => sum + col.width, 0),
    [columns],
  )

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleSort = useCallback((key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: '', dir: null }
    })
  }, [])

  const toggleRowSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onSelectionChange?.(next)
        return next
      })
    },
    [onSelectionChange],
  )

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === sortedData.length) {
        const next = new Set<string>()
        onSelectionChange?.(next)
        return next
      }
      const next = new Set(sortedData.map((row) => String(row[idKey])))
      onSelectionChange?.(next)
      return next
    })
  }, [sortedData, idKey, onSelectionChange])

  const startEditing = useCallback((rowIndex: number, colKey: string, currentValue: unknown) => {
    setEditingCell({ rowIndex, colKey })
    setEditValue(currentValue != null ? String(currentValue) : '')
  }, [])

  const confirmEdit = useCallback(() => {
    if (editingCell) {
      onCellEdit?.(editingCell.rowIndex, editingCell.colKey, editValue)
      setEditingCell(null)
    }
  }, [editingCell, editValue, onCellEdit])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  const allSelected = sortedData.length > 0 && selectedIds.size === sortedData.length

  return (
    <div
      ref={containerRef}
      className="glass-surface overflow-auto glass-provider-model-scroll"
      style={{ height: '100%' }}
      onScroll={handleScroll}
    >
      <div style={{ minWidth: totalWidth }}>
        {/* Sticky header */}
        <div
          className="flex sticky top-0 z-20"
          style={{
            height: rowHeight,
            background: 'var(--glass-bg-surface-strong)',
            borderBottom: '1px solid var(--glass-stroke-soft)',
          }}
        >
          {/* Checkbox header */}
          <div
            className="flex items-center justify-center shrink-0 sticky left-0 z-30"
            style={{
              width: CHECKBOX_COL_WIDTH,
              minWidth: CHECKBOX_COL_WIDTH,
              background: 'var(--glass-bg-surface-strong)',
              borderRight: '1px solid var(--glass-stroke-soft)',
            }}
          >
            <input
              type="checkbox"
              className="accent-[var(--glass-accent-from)] w-3.5 h-3.5 cursor-pointer"
              checked={allSelected}
              onChange={toggleSelectAll}
            />
          </div>

          {columns.map((col) => {
            const isFrozen = col.frozen
            const frozenLeft = isFrozen ? frozenOffsets.get(col.key) : undefined

            return (
              <div
                key={col.key}
                className={`flex items-center px-3 text-xs font-semibold tracking-wide select-none shrink-0 ${
                  col.sortable ? 'cursor-pointer' : ''
                }`}
                style={{
                  width: col.width,
                  minWidth: col.width,
                  color: 'var(--glass-text-secondary)',
                  borderRight: '1px solid var(--glass-stroke-soft)',
                  ...(isFrozen
                    ? {
                        position: 'sticky',
                        left: frozenLeft,
                        zIndex: 30,
                        background: 'var(--glass-bg-surface-strong)',
                      }
                    : {}),
                }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="truncate uppercase">{col.label}</span>
                {sortState.key === col.key && sortState.dir && (
                  <span className="ml-1" style={{ color: 'var(--glass-accent-from)' }}>
                    {sortState.dir === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Virtual scrolled body */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows.map((row, i) => {
            const actualIndex = startIndex + i
            const rowId = String(row[idKey])
            const isSelected = selectedIds.has(rowId)

            return (
              <div
                key={rowId}
                className="flex absolute w-full"
                style={{
                  height: rowHeight,
                  transform: `translateY(${actualIndex * rowHeight}px)`,
                  borderBottom: '1px solid var(--glass-stroke-soft)',
                  background: isSelected
                    ? 'color-mix(in srgb, var(--glass-accent-from) 8%, transparent)'
                    : undefined,
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background =
                      'color-mix(in srgb, var(--glass-accent-from) 4%, transparent)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = ''
                  }
                }}
              >
                {/* Checkbox cell */}
                <div
                  className="flex items-center justify-center shrink-0 sticky left-0 z-10"
                  style={{
                    width: CHECKBOX_COL_WIDTH,
                    minWidth: CHECKBOX_COL_WIDTH,
                    background: isSelected
                      ? 'color-mix(in srgb, var(--glass-accent-from) 8%, var(--glass-bg-surface))'
                      : 'var(--glass-bg-surface)',
                    borderRight: '1px solid var(--glass-stroke-soft)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--glass-accent-from)] w-3.5 h-3.5 cursor-pointer"
                    checked={isSelected}
                    onChange={() => toggleRowSelection(rowId)}
                  />
                </div>

                {/* Data cells */}
                {columns.map((col) => {
                  const isFrozen = col.frozen
                  const frozenLeft = isFrozen ? frozenOffsets.get(col.key) : undefined
                  const value = row[col.key]
                  const isEditing =
                    editingCell?.rowIndex === actualIndex && editingCell?.colKey === col.key

                  return (
                    <div
                      key={col.key}
                      className="flex items-center px-3 shrink-0"
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        color: 'var(--glass-text-primary)',
                        fontSize: 13,
                        borderRight: '1px solid var(--glass-stroke-soft)',
                        ...(isFrozen
                          ? {
                              position: 'sticky',
                              left: frozenLeft,
                              zIndex: 10,
                              background: isSelected
                                ? 'color-mix(in srgb, var(--glass-accent-from) 8%, var(--glass-bg-surface))'
                                : 'var(--glass-bg-surface)',
                            }
                          : {}),
                      }}
                      onDoubleClick={() => {
                        if (col.editable) startEditing(actualIndex, col.key, value)
                      }}
                    >
                      {isEditing ? (
                        <input
                          className="glass-input-base h-7 text-sm px-1.5"
                          value={editValue}
                          autoFocus
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          onBlur={confirmEdit}
                        />
                      ) : (
                        <span className="truncate">
                          {col.render
                            ? col.render(value, row)
                            : value != null
                              ? String(value)
                              : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
