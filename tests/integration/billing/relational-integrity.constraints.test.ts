import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { TASK_STATUS, TASK_TYPE } from '@/lib/task/types'
import { prisma } from '../../helpers/prisma'
import { resetBillingState } from '../../helpers/db-reset'
import { createTestProject, createTestUser } from '../../helpers/billing-fixtures'

describe('billing/task relational integrity constraints', () => {
  beforeEach(async () => {
    await resetBillingState()
  })

  it('tasks.projectId 必须引用有效 project', async () => {
    const user = await createTestUser()

    await expect(prisma.task.create({
      data: {
        userId: user.id,
        projectId: randomUUID(),
        type: TASK_TYPE.VOICE_LINE,
        targetType: 'NovelPromotionVoiceLine',
        targetId: 'line-1',
        status: TASK_STATUS.QUEUED,
      },
    })).rejects.toMatchObject({ code: 'P2003' })
  })

  it('task_events.projectId 必须引用有效 project', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: TASK_TYPE.VOICE_LINE,
        targetType: 'NovelPromotionVoiceLine',
        targetId: 'line-1',
        status: TASK_STATUS.QUEUED,
      },
    })

    await expect(prisma.taskEvent.create({
      data: {
        taskId: task.id,
        projectId: randomUUID(),
        userId: user.id,
        eventType: 'task.created',
      },
    })).rejects.toMatchObject({ code: 'P2003' })
  })

  it('balance_freezes.userId 必须引用有效 user', async () => {
    await expect(prisma.balanceFreeze.create({
      data: {
        userId: randomUUID(),
        amount: 1,
      },
    })).rejects.toMatchObject({ code: 'P2003' })
  })

  it('balance_transactions.freezeId 必须引用有效 balance_freeze', async () => {
    const user = await createTestUser()

    await expect(prisma.balanceTransaction.create({
      data: {
        userId: user.id,
        type: 'consume',
        amount: -1,
        balanceAfter: 0,
        freezeId: randomUUID(),
      },
    })).rejects.toMatchObject({ code: 'P2003' })
  })
})
