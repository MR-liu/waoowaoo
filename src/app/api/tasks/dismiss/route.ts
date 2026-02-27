import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { dismissFailedTasksWithDetails } from '@/lib/task/service'
import { publishTaskEvent } from '@/lib/task/publisher'
import { TASK_EVENT_TYPE } from '@/lib/task/types'
import { readRequestJsonObject } from '@/lib/request-json'

function toObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

export const POST = apiHandler(async (request: NextRequest) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const body = await readRequestJsonObject(request)
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds : null

    if (!taskIds || taskIds.length === 0) {
        throw new ApiError('INVALID_PARAMS')
    }

    if (taskIds.length > 200) {
        throw new ApiError('INVALID_PARAMS')
    }

    const dismissedTasks = await dismissFailedTasksWithDetails(taskIds, session.user.id)
    await Promise.all(dismissedTasks.map(async (task) => {
        await publishTaskEvent({
            taskId: task.id,
            projectId: task.projectId,
            userId: task.userId,
            type: TASK_EVENT_TYPE.DISMISSED,
            taskType: task.type,
            targetType: task.targetType,
            targetId: task.targetId,
            episodeId: task.episodeId || null,
            payload: {
                ...toObject(task.payload),
                dismissed: true,
                stage: 'dismissed',
                message: 'Task dismissed by user',
            },
        })
    }))

    return NextResponse.json({
        success: true,
        dismissed: dismissedTasks.length,
        taskIds: dismissedTasks.map((task) => task.id),
    })
})
