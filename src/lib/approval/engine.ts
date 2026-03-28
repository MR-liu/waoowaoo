import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'

export type ApprovalAction = 'approve' | 'reject' | 'request_changes'

export type VersionStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'

export type TaskStatusAfterApproval =
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'revision_requested'
  | 'final'

const VERSION_TRANSITIONS: Record<VersionStatus, ApprovalAction[]> = {
  pending_review: ['approve', 'reject', 'request_changes'],
  approved: [],
  rejected: [],
  changes_requested: [],
}

const ACTION_TO_VERSION_STATUS: Record<ApprovalAction, VersionStatus> = {
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
}

const ACTION_TO_TASK_STATUS: Record<ApprovalAction, TaskStatusAfterApproval> = {
  approve: 'approved',
  reject: 'revision_requested',
  request_changes: 'revision_requested',
}

export function canPerformApproval(currentStatus: string, action: ApprovalAction): boolean {
  const allowed = VERSION_TRANSITIONS[currentStatus as VersionStatus]
  if (!allowed) return false
  return allowed.includes(action)
}

interface ApprovalInput {
  versionId: string
  action: ApprovalAction
  reviewerId: string
  comment?: string
  projectId: string
}

interface ApprovalResult {
  versionId: string
  newVersionStatus: VersionStatus
  taskId: string
  newTaskStatus: TaskStatusAfterApproval
}

export async function processApproval(input: ApprovalInput): Promise<ApprovalResult> {
  const version = await prisma.cgVersion.findUnique({
    where: { id: input.versionId },
    include: { productionTask: true },
  })

  if (!version) {
    throw new Error('VERSION_NOT_FOUND')
  }

  if (!canPerformApproval(version.status, input.action)) {
    throw new Error(`INVALID_TRANSITION: cannot ${input.action} version in status ${version.status}`)
  }

  const newVersionStatus = ACTION_TO_VERSION_STATUS[input.action]
  const newTaskStatus = ACTION_TO_TASK_STATUS[input.action]

  await prisma.$transaction([
    prisma.cgVersion.update({
      where: { id: input.versionId },
      data: { status: newVersionStatus },
    }),

    prisma.productionTask.update({
      where: { id: version.productionTaskId },
      data: {
        status: newTaskStatus,
        ...(input.action === 'approve' ? { completedAt: new Date() } : {}),
      },
    }),

    prisma.cgNote.create({
      data: {
        authorId: input.reviewerId,
        versionId: input.versionId,
        productionTaskId: version.productionTaskId,
        content: input.comment || `[${input.action.toUpperCase()}]`,
      },
    }),
  ])

  await recordAudit({
    userId: input.reviewerId,
    projectId: input.projectId,
    action: `version.${input.action}`,
    resource: 'cg_version',
    resourceId: input.versionId,
    metadata: { taskId: version.productionTaskId, comment: input.comment },
  })

  return {
    versionId: input.versionId,
    newVersionStatus,
    taskId: version.productionTaskId,
    newTaskStatus,
  }
}
