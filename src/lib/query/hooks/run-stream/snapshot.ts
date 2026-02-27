import type { RunState } from './types'
import { logWarn as _ulogWarn } from '@/lib/logging/core'

export const SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 6

type RunSnapshot = {
  savedAt: number
  runState: RunState
}

export function loadRunSnapshot(storageKey: string): RunState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RunSnapshot
    if (!parsed || typeof parsed !== 'object') {
      window.sessionStorage.removeItem(storageKey)
      return null
    }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > SNAPSHOT_TTL_MS) {
      window.sessionStorage.removeItem(storageKey)
      return null
    }
    const snapshotRunState = parsed.runState
    if (!snapshotRunState || typeof snapshotRunState !== 'object' || typeof snapshotRunState.runId !== 'string') {
      window.sessionStorage.removeItem(storageKey)
      return null
    }
    return snapshotRunState
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    _ulogWarn(`[RunSnapshot] load failed key=${storageKey} error=${message}`)
    try {
      window.sessionStorage.removeItem(storageKey)
    } catch (removeError: unknown) {
      const removeMessage = removeError instanceof Error ? removeError.message : String(removeError)
      _ulogWarn(`[RunSnapshot] cleanup after load failed key=${storageKey} error=${removeMessage}`)
    }
    return null
  }
}

export function saveRunSnapshot(storageKey: string, runState: RunState | null) {
  if (typeof window === 'undefined') return
  try {
    if (!runState) {
      window.sessionStorage.removeItem(storageKey)
      return
    }
    const snapshot: RunSnapshot = {
      savedAt: Date.now(),
      runState,
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    _ulogWarn(`[RunSnapshot] save failed key=${storageKey} error=${message}`)
  }
}

export function clearRunSnapshot(storageKey: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(storageKey)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    _ulogWarn(`[RunSnapshot] clear failed key=${storageKey} error=${message}`)
  }
}
