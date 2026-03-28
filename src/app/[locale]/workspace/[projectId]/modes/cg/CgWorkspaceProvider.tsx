'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface CgWorkspaceContextValue {
  projectId: string
}

const CgWorkspaceContext = createContext<CgWorkspaceContextValue | null>(null)

interface CgWorkspaceProviderProps {
  projectId: string
  children: ReactNode
}

export function CgWorkspaceProvider({ projectId, children }: CgWorkspaceProviderProps) {
  const value = useMemo<CgWorkspaceContextValue>(() => ({ projectId }), [projectId])
  return <CgWorkspaceContext.Provider value={value}>{children}</CgWorkspaceContext.Provider>
}

export function useCgWorkspace(): CgWorkspaceContextValue {
  const context = useContext(CgWorkspaceContext)
  if (!context) {
    throw new Error('useCgWorkspace must be used within CgWorkspaceProvider')
  }
  return context
}
