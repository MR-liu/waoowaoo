import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  })

  const systemRole = (user?.systemRole as string) || 'artist'

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      projectType: true,
      updatedAt: true,
    },
  })

  const assignedTasks = await prisma.productionTask.findMany({
    where: { assigneeId: userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      pipelineStep: { select: { name: true, projectId: true } },
      shot: { select: { code: true } },
      asset: { select: { code: true } },
    },
  })

  const projectIdMap = new Map(projects.map(p => [p.id, p.name]))

  const pendingReviewVersions = await prisma.cgVersion.findMany({
    where: {
      status: 'pending_review',
      productionTask: {
        pipelineStep: {
          projectId: { in: projects.map(p => p.id) },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      productionTask: {
        include: {
          shot: { select: { code: true } },
          asset: { select: { code: true } },
          pipelineStep: { select: { projectId: true, name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json({
    systemRole,
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      projectType: p.projectType,
      updatedAt: p.updatedAt.toISOString(),
    })),
    assignedTasks: assignedTasks.map(t => ({
      id: t.id,
      projectId: t.pipelineStep.projectId,
      projectName: projectIdMap.get(t.pipelineStep.projectId) ?? '',
      shotCode: t.shot?.code ?? null,
      assetCode: t.asset?.code ?? null,
      stepName: t.pipelineStep.name,
      status: t.status,
      dueDate: t.dueDate?.toISOString() ?? null,
    })),
    reviewQueue: pendingReviewVersions.map(v => ({
      id: v.id,
      projectId: v.productionTask.pipelineStep.projectId,
      projectName: projectIdMap.get(v.productionTask.pipelineStep.projectId) ?? '',
      entityName: v.productionTask.shot?.code ?? v.productionTask.asset?.code ?? '',
      versionNumber: v.versionNumber,
      thumbnailUrl: v.thumbnailUrl,
      submittedBy: v.createdBy.name,
      submittedAt: v.createdAt.toISOString(),
    })),
  })
})
