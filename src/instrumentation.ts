// Next.js Instrumentation - 在应用启动时执行
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // 在 Edge Runtime 中直接返回，避免加载 Prisma（它使用了动态代码生成）
  if (process.env.NEXT_RUNTIME === 'edge') {
    return
  }

  // 只在 Node.js 服务端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('@/lib/prisma')
    const { logInfo: _ulogInfo, logError: _ulogError } = await import('@/lib/logging/core')

    // Phase 1: 将 processing 任务打回 queued
    try {
      const { resetProcessingTasksToQueuedOnStartup } = await import('@/lib/task/service')
      const resetCount = await resetProcessingTasksToQueuedOnStartup()

      if (resetCount > 0) {
        _ulogInfo(`[Instrumentation] Reset ${resetCount} processing tasks to queued`)
      }
    } catch (error) {
      _ulogError('[Instrumentation] Failed to reset processing tasks:', error)
    }

    // Phase 2: 将所有 queued 任务重新加入 BullMQ 队列
    // 解决 Redis 重启后 DB 仍为 queued 但 BullMQ Job 丢失的孤儿任务问题
    try {
      const { addTaskJob } = await import('@/lib/task/queues')
      const { markTaskEnqueued, markTaskEnqueueFailed, tryMarkTaskFailed } = await import('@/lib/task/service')
      const { locales } = await import('@/i18n/routing')
      const { TASK_TYPE } = await import('@/lib/task/types')
      type TaskBillingInfo = import('@/lib/task/types').TaskBillingInfo
      type TaskJobData = import('@/lib/task/types').TaskJobData
      type TaskType = import('@/lib/task/types').TaskType

      const TASK_TYPE_SET: ReadonlySet<string> = new Set(Object.values(TASK_TYPE))

      function toObject(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
        return value as Record<string, unknown>
      }

      function toTaskType(value: unknown): TaskType | null {
        if (typeof value !== 'string') return null
        if (!TASK_TYPE_SET.has(value)) return null
        return value as TaskType
      }

      function toTaskPayload(value: unknown): Record<string, unknown> | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null
        return value as Record<string, unknown>
      }

      function toTaskBillingInfo(value: unknown): TaskBillingInfo | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null
        const billing = value as Record<string, unknown>
        if (billing.billable !== true && billing.billable !== false) return null
        return billing as TaskBillingInfo
      }

      function resolveTaskLocaleFromPayload(payload: unknown): TaskJobData['locale'] | null {
        const payloadObj = toObject(payload)
        const payloadMeta = toObject(payloadObj.meta)
        const raw = typeof payloadMeta.locale === 'string'
          ? payloadMeta.locale
          : typeof payloadObj.locale === 'string'
            ? payloadObj.locale
            : ''
        if (!raw.trim()) return null
        const normalized = raw.trim().toLowerCase()
        for (const locale of locales) {
          if (normalized === locale || normalized.startsWith(`${locale}-`)) {
            return locale
          }
        }
        return null
      }

      const RE_ENQUEUE_BATCH_SIZE = 100
      const queuedTasks = await prisma.task.findMany({
        where: { status: 'queued' },
        select: {
          id: true,
          userId: true,
          projectId: true,
          episodeId: true,
          type: true,
          targetType: true,
          targetId: true,
          payload: true,
          billingInfo: true,
          priority: true,
        },
        orderBy: { createdAt: 'asc' },
        take: RE_ENQUEUE_BATCH_SIZE,
      })

      if (queuedTasks.length > 0) {
        _ulogInfo(`[Instrumentation] Found ${queuedTasks.length} queued tasks, re-enqueueing into BullMQ`)

        let enqueued = 0
        let failed = 0

        for (const task of queuedTasks) {
          try {
            const taskType = toTaskType(task.type)
            if (!taskType) {
              const marked = await tryMarkTaskFailed(
                task.id,
                'INVALID_TASK_TYPE',
                `invalid task type: ${String(task.type)}`,
              )
              if (!marked) {
                _ulogError(`[Instrumentation] Failed to mark INVALID_TASK_TYPE for task ${task.id}`)
              }
              failed++
              continue
            }

            const locale = resolveTaskLocaleFromPayload(task.payload)
            if (!locale) {
              const marked = await tryMarkTaskFailed(
                task.id,
                'TASK_LOCALE_REQUIRED',
                'task locale is missing',
              )
              if (!marked) {
                _ulogError(`[Instrumentation] Failed to mark TASK_LOCALE_REQUIRED for task ${task.id}`)
              }
              failed++
              continue
            }

            const jobData: TaskJobData = {
              taskId: task.id,
              type: taskType,
              locale,
              projectId: task.projectId,
              episodeId: task.episodeId || null,
              targetType: task.targetType,
              targetId: task.targetId,
              payload: toTaskPayload(task.payload),
              billingInfo: toTaskBillingInfo(task.billingInfo),
              userId: task.userId,
              trace: null,
            }
            await addTaskJob(jobData, {
              priority: typeof task.priority === 'number' ? task.priority : 0,
            })
            const marked = await markTaskEnqueued(task.id)
            if (!marked) {
              _ulogError(`[Instrumentation] Failed to mark task enqueued: ${task.id}`)
              failed++
              continue
            }
            enqueued++
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const marked = await markTaskEnqueueFailed(task.id, message || 're-enqueue failed')
            if (!marked) {
              _ulogError(`[Instrumentation] Failed to persist enqueue failure for task ${task.id}`)
            }
            _ulogError(`[Instrumentation] Failed to re-enqueue task ${task.id}:`, message)
            failed++
          }
        }

        if (enqueued > 0) {
          _ulogInfo(`[Instrumentation] Re-enqueued ${enqueued} orphaned tasks into BullMQ`)
        }
        if (failed > 0) {
          _ulogError(`[Instrumentation] Failed to re-enqueue ${failed} tasks`)
        }
      }
    } catch (error) {
      _ulogError('[Instrumentation] Failed to re-enqueue orphaned tasks:', error)
    }

    // ─── Phase 3: 启动 Task Watchdog（DB ↔ BullMQ 持续对账）───
    try {
      const { startTaskWatchdog } = await import('@/lib/task/reconcile')
      startTaskWatchdog()
      _ulogInfo('[Instrumentation] Task watchdog started')
    } catch (error) {
      _ulogError('[Instrumentation] Failed to start task watchdog:', error)
    }
  }
}
