import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import {
  parseLogicalPath,
  resolvePhysicalPath,
  buildLogicalPath,
  generateDirectoryTree,
  isVfsPlatform,
  defaultRootPath,
} from '@/lib/vfs/engine'

interface ResolveQuery {
  uri: string
  platform?: string
  rootPath?: string
}

/**
 * GET /api/cg/[projectId]/vfs?uri=nexus://...&platform=darwin&rootPath=/mnt/projects
 * Resolve a logical nexus:// path to a physical filesystem path.
 */
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const uri = request.nextUrl.searchParams.get('uri')
  if (!uri?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'uri query param is required' })
  }

  const platformParam = request.nextUrl.searchParams.get('platform') || 'linux'
  if (!isVfsPlatform(platformParam)) {
    throw new ApiError('INVALID_PARAMS', {
      message: `Invalid platform: "${platformParam}". Must be win32, darwin, or linux`,
    })
  }

  const rootPath = request.nextUrl.searchParams.get('rootPath') || defaultRootPath(platformParam)

  let components: ReturnType<typeof parseLogicalPath>
  try {
    components = parseLogicalPath(uri)
  } catch (error: unknown) {
    throw new ApiError('INVALID_PARAMS', {
      message: error instanceof Error ? error.message : 'Invalid VFS URI',
    })
  }

  const physicalPath = resolvePhysicalPath(components, {
    rootPath,
    platform: platformParam,
  })

  const logicalPath = buildLogicalPath(components)

  return NextResponse.json({
    logicalPath,
    physicalPath,
    components,
  })
})

interface GenerateTreeBody {
  shotCode: string
  steps: string[]
}

/**
 * POST /api/cg/[projectId]/vfs
 * Generate a standard directory tree for a shot.
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => ({})) as GenerateTreeBody

  if (!body.shotCode?.trim()) {
    throw new ApiError('INVALID_PARAMS', { message: 'shotCode is required' })
  }
  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'steps array is required and must not be empty' })
  }

  const invalidSteps = body.steps.filter((s) => typeof s !== 'string' || !s.trim())
  if (invalidSteps.length > 0) {
    throw new ApiError('INVALID_PARAMS', { message: 'All steps must be non-empty strings' })
  }

  const directories = generateDirectoryTree(body.shotCode, body.steps)

  return NextResponse.json({ directories }, { status: 201 })
})
