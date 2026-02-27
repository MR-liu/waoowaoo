import { Worker, type Job } from 'bullmq'
import { queueRedis } from '@/lib/redis'
import { generateVoiceLine } from '@/lib/voice/generate-voice-line'
import { QUEUE_NAME } from '@/lib/task/queues'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { reportTaskProgress, withTaskLifecycle } from './shared'
import { handleVoiceDesignTask } from './handlers/voice-design'

type AnyObj = Record<string, unknown>

async function handleVoiceLineTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as AnyObj
  if (job.data.targetType !== 'NovelPromotionVoiceLine' || !job.data.targetId) {
    throw new Error('VOICE_LINE_TASK_TARGET_INVALID: targetType must be NovelPromotionVoiceLine')
  }
  const lineId = typeof payload.lineId === 'string' ? payload.lineId.trim() : ''
  const episodeId = typeof payload.episodeId === 'string' ? payload.episodeId.trim() : ''
  const audioModel = typeof payload.audioModel === 'string' && payload.audioModel.trim()
    ? payload.audioModel.trim()
    : undefined
  if (!lineId) {
    throw new Error('VOICE_LINE_PAYLOAD_LINE_ID_REQUIRED: payload.lineId is required')
  }
  if (!episodeId) {
    throw new Error('VOICE_LINE_PAYLOAD_EPISODE_ID_REQUIRED: payload.episodeId is required')
  }
  if (lineId !== job.data.targetId) {
    throw new Error('VOICE_LINE_PAYLOAD_LINE_ID_MISMATCH: payload.lineId must equal task.targetId')
  }
  if (!job.data.episodeId || episodeId !== job.data.episodeId) {
    throw new Error('VOICE_LINE_PAYLOAD_EPISODE_ID_MISMATCH: payload.episodeId must equal task.episodeId')
  }

  await reportTaskProgress(job, 20, { stage: 'generate_voice_submit', lineId })

  const generated = await generateVoiceLine({
    projectId: job.data.projectId,
    episodeId,
    lineId,
    userId: job.data.userId,
    audioModel,
  })

  await reportTaskProgress(job, 95, { stage: 'generate_voice_persist', lineId })

  return generated
}

async function processVoiceTask(job: Job<TaskJobData>) {
  await reportTaskProgress(job, 5, { stage: 'received' })

  switch (job.data.type) {
    case TASK_TYPE.VOICE_LINE:
      return await handleVoiceLineTask(job)
    case TASK_TYPE.VOICE_DESIGN:
    case TASK_TYPE.ASSET_HUB_VOICE_DESIGN:
      return await handleVoiceDesignTask(job)
    default:
      throw new Error(`Unsupported voice task type: ${job.data.type}`)
  }
}

export function createVoiceWorker() {
  return new Worker<TaskJobData>(
    QUEUE_NAME.VOICE,
    async (job) => await withTaskLifecycle(job, processVoiceTask),
    {
      connection: queueRedis,
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY_VOICE || '10', 10) || 10,
    },
  )
}
