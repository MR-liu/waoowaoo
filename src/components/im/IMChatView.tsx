'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppIcon } from '@/components/ui/icons'

interface ChatMessageData {
  id: string
  content: string
  type: string
  createdAt: string
  sender: {
    id: string
    name: string
    image: string | null
  }
}

interface ChatResponse {
  channelId: string
  messages: ChatMessageData[]
  hasMore: boolean
}

interface IMChatViewProps {
  projectId: string
}

export default function IMChatView({ projectId }: IMChatViewProps) {
  const t = useTranslations('im')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<ChatResponse>({
    queryKey: ['chat', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/chat`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json()
    },
    refetchInterval: 5000,
  })

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (data?.messages?.length) {
      scrollToBottom()
    }
  }, [data?.messages?.length, scrollToBottom])

  const messages = data?.messages ?? []

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <AppIcon name="loader" className="w-5 h-5 text-[var(--glass-text-tertiary)] animate-spin" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--glass-bg-muted)] flex items-center justify-center mb-4">
          <AppIcon name="message" className="w-8 h-8 text-[var(--glass-text-tertiary)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--glass-text-secondary)] mb-1">
          {t('emptyChat.title')}
        </p>
        <p className="text-xs text-[var(--glass-text-tertiary)] text-center max-w-[200px]">
          {t('emptyChat.description')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 glass-provider-model-scroll">
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--glass-accent-from)] to-[var(--glass-accent-to)] flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-white">
              {msg.sender.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-xs font-bold text-[var(--glass-text-primary)]">{msg.sender.name}</span>
              <span className="text-[10px] text-[var(--glass-text-tertiary)]">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-[var(--glass-text-secondary)] break-words leading-relaxed">{msg.content}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
