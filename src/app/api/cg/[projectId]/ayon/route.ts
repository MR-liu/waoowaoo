import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'
import { syncProjectFromAyon, type SyncResult } from '@/lib/ayon/bridge'
import { startEventListener, type EventListenerHandle } from '@/lib/ayon/event-listener'

// ---------------------------------------------------------------------------
// Module-level listener registry (keyed by nexusProjectId)
// ---------------------------------------------------------------------------

const activeListeners = new Map<string, EventListenerHandle>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TriggerSyncBody {
  ayonProjectName: string
  /** If true, also start a background event listener */
  startListener?: boolean
  pollIntervalMs?: number
}

interface SyncStatusResponse {
  listenerActive: boolean
  listenerState: {
    running: boolean
    lastEventId: string | null
    processedCount: number
    errorCount: number
    lastPollAt: string | null
  } | null
  lastSyncResult: SyncResult | null
}

// Keep track of last sync result per project
const lastSyncResults = new Map<string, SyncResult>()

/**
 * POST /api/cg/[projectId]/ayon
 * Trigger a full sync from AYON and optionally start a background event listener.
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'ayon')
  if (!rbac.allowed) return rbac.response

  const body = await request.json().catch(() => ({})) as TriggerSyncBody

  if (!body.ayonProjectName?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'ayonProjectName is required' })
  }

  const result = await syncProjectFromAyon(body.ayonProjectName.trim(), projectId)
  lastSyncResults.set(projectId, result)

  if (body.startListener) {
    const existing = activeListeners.get(projectId)
    if (existing) {
      existing.stop()
    }
    const handle = startEventListener({
      ayonProjectName: body.ayonProjectName.trim(),
      nexusProjectId: projectId,
      pollIntervalMs: body.pollIntervalMs,
    })
    activeListeners.set(projectId, handle)
  }

  return NextResponse.json({ syncResult: result }, { status: 200 })
})

/**
 * GET /api/cg/[projectId]/ayon
 * Return current sync status and listener state.
 */
export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const listener = activeListeners.get(projectId)
  const listenerState = listener?.getState() ?? null

  const response: SyncStatusResponse = {
    listenerActive: !!listener,
    listenerState: listenerState
      ? {
          ...listenerState,
          lastPollAt: listenerState.lastPollAt?.toISOString() ?? null,
        }
      : null,
    lastSyncResult: lastSyncResults.get(projectId) ?? null,
  }

  return NextResponse.json(response)
})
