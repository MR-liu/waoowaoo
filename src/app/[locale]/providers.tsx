'use client'

import { SessionProvider } from "next-auth/react"
import { MotionConfig } from "framer-motion"
import { ToastProvider } from "@/contexts/ToastContext"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { MOTION_PRESETS } from "@/lib/ui/motion"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig transition={MOTION_PRESETS.spring.gentle} reducedMotion="user">
      <SessionProvider
        refetchOnWindowFocus={false}
        refetchInterval={0}
      >
        <QueryProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </QueryProvider>
      </SessionProvider>
    </MotionConfig>
  )
}
