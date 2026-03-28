import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { auditAndCheck } from '@/lib/api-rbac'
import { uploadToCOS, generateUniqueKey } from '@/lib/cos'
import { validateFileName, extractVersionNumber, DEFAULT_NAMING_TEMPLATE } from '@/lib/vfs/naming'

/**
 * POST /api/cg/[projectId]/filebox
 * Validate filename, upload file to storage, and auto-create a CgVersion entity.
 *
 * Accepts multipart form data:
 *   - file: the uploaded file
 *   - productionTaskId: target production task
 *   - namingTemplate: (optional) override naming template
 *   - comment: (optional) version comment
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const userId = authResult.session.user.id
  const rbac = await auditAndCheck(userId, projectId, 'edit', 'version')
  if (!rbac.allowed) return rbac.response

  const formData = await request.formData().catch(() => {
    throw new ApiError('INVALID_PARAMS', { message: 'Expected multipart form data' })
  })

  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new ApiError('INVALID_PARAMS', { message: 'file field is required and must be a File' })
  }

  const productionTaskId = formData.get('productionTaskId')
  if (typeof productionTaskId !== 'string' || !productionTaskId.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'productionTaskId is required' })
  }

  const formTemplate =
    typeof formData.get('namingTemplate') === 'string' && (formData.get('namingTemplate') as string).trim()
      ? (formData.get('namingTemplate') as string).trim()
      : null

  let namingTemplate = formTemplate
  if (!namingTemplate) {
    const customTemplate = await prisma.namingTemplate.findUnique({
      where: { projectId_entityType: { projectId, entityType: 'version' } },
    })
    namingTemplate = customTemplate?.pattern ?? DEFAULT_NAMING_TEMPLATE
  }

  const comment =
    typeof formData.get('comment') === 'string'
      ? (formData.get('comment') as string).trim() || null
      : null

  const validation = validateFileName(file.name, namingTemplate)
  if (!validation.valid) {
    throw new ApiError('INVALID_PARAMS', {
      message: `Filename validation failed: ${validation.errors.join('; ')}`,
      validationErrors: validation.errors,
    })
  }

  const task = await prisma.productionTask.findFirst({
    where: {
      id: productionTaskId,
      pipelineStep: { projectId },
    },
  })
  if (!task) {
    throw new ApiError('NOT_FOUND', { message: 'ProductionTask not found in this project' })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const ext = file.name.split('.').pop() || 'bin'
  const storageKey = generateUniqueKey(`cg/${projectId}/${productionTaskId}`, ext)

  await uploadToCOS(fileBuffer, storageKey)

  const embeddedVersion = extractVersionNumber(file.name)

  const latestVersion = await prisma.cgVersion.findFirst({
    where: { productionTaskId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })
  const nextVersionNumber = embeddedVersion ?? ((latestVersion?.versionNumber ?? 0) + 1)

  const version = await prisma.cgVersion.create({
    data: {
      productionTaskId,
      versionNumber: nextVersionNumber,
      comment,
      status: 'pending_review',
      filePath: storageKey,
      mediaPath: file.name,
      createdById: authResult.session.user.id,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  })

  return NextResponse.json({ version }, { status: 201 })
})
