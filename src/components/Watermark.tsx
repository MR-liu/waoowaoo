'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'

interface WatermarkProps {
  children: React.ReactNode
  enabled?: boolean
}

export function Watermark({ children, enabled = true }: WatermarkProps) {
  const { data: session } = useSession()

  const watermarkText = useMemo(() => {
    if (!enabled || !session?.user) return null
    const username = session.user.name || session.user.email || 'user'
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    return `${username} ${timestamp}`
  }, [enabled, session])

  if (!watermarkText) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none"
        aria-hidden="true"
      >
        <div
          className="absolute inset-[-50%] flex flex-wrap items-center justify-center gap-24"
          style={{
            transform: 'rotate(-25deg)',
          }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="text-[11px] font-mono whitespace-nowrap"
              style={{
                color: 'rgba(128, 128, 128, 0.08)',
                userSelect: 'none',
              }}
            >
              {watermarkText}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
