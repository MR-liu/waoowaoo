'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import IMPanel from '@/components/im/IMPanel'
import IMPanelCollapsed from '@/components/im/IMPanelCollapsed'
import { AppIcon } from '@/components/ui/icons'

const NO_IM_PATHS = ['/auth/', '/share/']

function shouldShowIM(pathname: string): boolean {
  return !NO_IM_PATHS.some(p => pathname.includes(p))
}

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/\/workspace\/([a-f0-9-]{36})\b/)
  return match ? match[1] : null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const [isIMCollapsed, setIsIMCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('nexus-im-collapsed') !== 'false'
  })

  const toggleIM = useCallback(() => {
    setIsIMCollapsed(prev => {
      const next = !prev
      localStorage.setItem('nexus-im-collapsed', String(next))
      return next
    })
  }, [])

  const showIM = !!session?.user && !!pathname && shouldShowIM(pathname)
  const projectId = useMemo(() => pathname ? extractProjectId(pathname) : null, [pathname])

  if (!showIM) {
    return <>{children}</>
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <aside
        className="glass-im-panel"
        data-collapsed={isIMCollapsed}
      >
        {isIMCollapsed ? (
          <IMPanelCollapsed onExpand={toggleIM} unreadCount={0} />
        ) : (
          <>
            <div className="flex items-center justify-end px-2 py-1.5">
              <button
                onClick={toggleIM}
                className="w-7 h-7 rounded-lg hover:bg-[var(--glass-bg-muted)] flex items-center justify-center text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)] transition-colors"
              >
                <AppIcon name="panelLeftClose" className="w-4 h-4" />
              </button>
            </div>
            {projectId ? (
              <IMPanel projectId={projectId} />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
                <AppIcon name="message" className="w-8 h-8 text-[var(--glass-text-tertiary)] mb-2" />
                <p className="text-xs text-[var(--glass-text-tertiary)]">
                  Enter a project to start chatting
                </p>
              </div>
            )}
          </>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
