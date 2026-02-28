import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  novelPromotionVoiceLine: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
  novelPromotionEpisode: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@fal-ai/client', () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn(),
  },
}))
vi.mock('@/lib/api-config', () => ({
  getAudioApiKey: vi.fn(),
  getProviderKey: vi.fn(),
  resolveModelSelectionOrSingle: vi.fn(),
}))
vi.mock('@/lib/cos', () => ({
  extractCOSKey: vi.fn(),
  getSignedUrl: vi.fn(),
  imageUrlToBase64: vi.fn(),
  toFetchableUrl: vi.fn((url: string) => url),
  uploadToCOS: vi.fn(),
}))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: vi.fn(),
}))

import { generateVoiceLine } from '@/lib/voice/generate-voice-line'

describe('generateVoiceLine speakerVoices contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.novelPromotionVoiceLine.findUnique.mockResolvedValue({
      id: 'line-1',
      episodeId: 'episode-1',
      speaker: 'Narrator',
      content: 'hello',
      emotionPrompt: null,
      emotionStrength: 0.4,
    })
    prismaMock.novelPromotionProject.findUnique.mockResolvedValue({
      id: 'np-project-1',
      characters: [],
    })
  })

  it('speakerVoices 非法 JSON 时显式失败，不允许静默回退', async () => {
    prismaMock.novelPromotionEpisode.findUnique.mockResolvedValueOnce({
      speakerVoices: '{broken-json',
    })

    await expect(generateVoiceLine({
      projectId: 'project-1',
      lineId: 'line-1',
      userId: 'user-1',
      episodeId: 'episode-1',
    })).rejects.toThrow('VOICE_LINE_SPEAKER_VOICES_INVALID')
  })

  it('speakerVoices 配置结构非法时显式失败', async () => {
    prismaMock.novelPromotionEpisode.findUnique.mockResolvedValueOnce({
      speakerVoices: JSON.stringify({ Narrator: { voiceType: 'preset-only-without-audio' } }),
    })

    await expect(generateVoiceLine({
      projectId: 'project-1',
      lineId: 'line-1',
      userId: 'user-1',
      episodeId: 'episode-1',
    })).rejects.toThrow('VOICE_LINE_SPEAKER_VOICES_INVALID')
  })
})
