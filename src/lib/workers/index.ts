import 'dotenv/config'
import { logInfo as _ulogInfo, logError as _ulogError } from '@/lib/logging/core'
import { createWorkersByLanes, parseWorkerLanes } from './selection'

const selectedLanes = parseWorkerLanes(process.env.WORKER_QUEUES)
const workers = createWorkersByLanes(selectedLanes)

_ulogInfo('[Workers] started:', workers.length)
_ulogInfo('[Workers] lanes:', selectedLanes.join(','))

for (const worker of workers) {
  worker.on('ready', () => {
    _ulogInfo(`[Workers] ready: ${worker.name}`)
  })

  worker.on('error', (err) => {
    _ulogError(`[Workers] error: ${worker.name}`, err.message)
  })

  worker.on('failed', (job, err) => {
    _ulogError(`[Workers] job failed: ${worker.name}`, {
      jobId: job?.id,
      taskId: job?.data?.taskId,
      taskType: job?.data?.type,
      error: err.message,
    })
  })
}

async function shutdown(signal: string) {
  _ulogInfo(`[Workers] shutdown signal: ${signal}`)
  await Promise.all(workers.map(async (worker) => await worker.close()))
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
