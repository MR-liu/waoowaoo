'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { AppIcon } from '@/components/ui/icons'

interface IMMessageInputProps {
  projectId: string
}

export default function IMMessageInput({ projectId }: IMMessageInputProps) {
  const t = useTranslations('im')
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim() || sending) return
    const content = message.trim()
    setMessage('')
    setSending(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['chat', projectId] })
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="px-3 py-3 border-t border-[var(--glass-stroke-soft)]">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={t('input.placeholder')}
            rows={1}
            className="glass-textarea-base w-full px-3 py-2 text-sm resize-none max-h-[120px]"
            style={{ minHeight: '36px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="w-8 h-8 rounded-lg bg-[var(--glass-accent-from)] hover:bg-[var(--glass-accent-to)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
        >
          <AppIcon name="send" className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  )
}
