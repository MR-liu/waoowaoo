'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AppIcon } from '@/components/ui/icons'

interface PlaylistVersion {
  id: string
  versionId: string
  sortOrder: number
  version: {
    id: string
    versionNumber: number
    comment: string | null
    status: string
    thumbnailUrl: string | null
    productionTask: {
      id: string
      shot?: { code: string } | null
      asset?: { code: string } | null
    }
  }
}

interface PlaylistManagerProps {
  projectId: string
  playlistId: string
  onPlayVersion?: (versionId: string, mediaSrc: string | null) => void
}

interface SortableItemProps {
  item: PlaylistVersion
  isActive: boolean
  onPlay: () => void
  onRemove: () => void
}

function getStatusChipClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'glass-chip-success'
    case 'rejected':
      return 'glass-chip-danger'
    case 'pending_review':
      return 'glass-chip-warning'
    default:
      return 'glass-chip-neutral'
  }
}

function SortableItem({ item, isActive, onPlay, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const entityCode =
    item.version.productionTask.shot?.code ??
    item.version.productionTask.asset?.code ??
    '—'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-list-row group ${isActive ? 'border-[var(--glass-accent-from)]' : ''}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="glass-icon-btn-sm cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorder"
        >
          <AppIcon name="menu" className="w-3.5 h-3.5" />
        </button>

        {item.version.thumbnailUrl && (
          <div className="w-12 h-8 rounded overflow-hidden bg-[var(--glass-bg-muted)] shrink-0">
            <img
              src={item.version.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <button
          onClick={onPlay}
          className="flex flex-col min-w-0 text-left"
        >
          <span className="text-xs font-semibold text-[var(--glass-text-primary)] truncate">
            {entityCode} — v{item.version.versionNumber}
          </span>
          {item.version.comment && (
            <span className="text-[10px] text-[var(--glass-text-tertiary)] truncate">
              {item.version.comment}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`glass-chip text-[10px] ${getStatusChipClass(item.version.status)}`}>
          {item.version.status.replace('_', ' ')}
        </span>
        <button
          onClick={onRemove}
          className="glass-icon-btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove from playlist"
        >
          <AppIcon name="close" className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export function PlaylistManager({
  projectId,
  playlistId,
  onPlayVersion,
}: PlaylistManagerProps) {
  const [items, setItems] = useState<PlaylistVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/cg/${projectId}/playlists/${playlistId}/items`,
      )
      if (!res.ok) {
        const errData = (await res.json()) as { message?: string }
        throw new Error(errData.message ?? `Failed to load playlist items (${res.status})`)
      }
      const data = (await res.json()) as { items: PlaylistVersion[] }
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [projectId, playlistId])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)

    void fetch(
      `/api/cg/${projectId}/playlists/${playlistId}/items`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((i) => i.id) }),
      },
    ).then((res) => {
      if (!res.ok) void fetchItems()
    }).catch(() => {
      void fetchItems()
    })
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      const res = await fetch(
        `/api/cg/${projectId}/playlists/${playlistId}/items?itemId=${itemId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const errData = (await res.json()) as { message?: string }
        throw new Error(errData.message ?? 'Failed to remove item')
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleBatchAction = async (action: 'approve' | 'reject') => {
    const status = action === 'approve' ? 'approved' : 'rejected'
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        version: { ...item.version, status },
      })),
    )

    for (const item of items) {
      try {
        await fetch(`/api/cg/${projectId}/versions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId: item.versionId, status }),
        })
      } catch {
        // Revert on error - refetch to get server state
        void fetchItems()
        return
      }
    }
  }

  if (loading) {
    return (
      <div className="glass-surface p-6 flex items-center justify-center">
        <AppIcon name="loader" className="w-5 h-5 animate-spin text-[var(--glass-text-tertiary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-surface p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--glass-tone-danger-fg)]">
          <AppIcon name="alert" className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => void fetchItems()}
          className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs mt-2"
        >
          <AppIcon name="refresh" className="w-3 h-3" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="glass-surface flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--glass-text-secondary)]">
          Playlist ({items.length})
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => void handleBatchAction('approve')}
            disabled={items.length === 0}
            className="glass-btn-base glass-btn-tone-success px-2 py-1 text-[10px]"
          >
            <AppIcon name="check" className="w-3 h-3" />
            Approve All
          </button>
          <button
            onClick={() => void handleBatchAction('reject')}
            disabled={items.length === 0}
            className="glass-btn-base glass-btn-tone-danger px-2 py-1 text-[10px]"
          >
            <AppIcon name="close" className="w-3 h-3" />
            Reject All
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--glass-text-tertiary)]">
          No versions in this playlist
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  isActive={item.id === activeItemId}
                  onPlay={() => {
                    setActiveItemId(item.id)
                    onPlayVersion?.(item.versionId, item.version.thumbnailUrl)
                  }}
                  onRemove={() => void handleRemoveItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
