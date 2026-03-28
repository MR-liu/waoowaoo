import { NextResponse } from 'next/server'
import { getProjectRole, canPerformAction, type PermissionAction } from '@/lib/rbac'
import { recordAudit } from '@/lib/audit'

interface RbacCheckResult {
  allowed: true
  userId: string
  role: string
}

interface RbacDeniedResult {
  allowed: false
  response: NextResponse
}

type RbacResult = RbacCheckResult | RbacDeniedResult

export async function requireProjectPermission(
  userId: string,
  projectId: string,
  action: PermissionAction,
): Promise<RbacResult> {
  const role = await getProjectRole(userId, projectId)

  if (!role) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'FORBIDDEN', message: 'Not a member of this project' },
        { status: 403 },
      ),
    }
  }

  if (!canPerformAction(role, action)) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'FORBIDDEN', message: `Role '${role}' cannot perform '${action}'` },
        { status: 403 },
      ),
    }
  }

  return { allowed: true, userId, role }
}

export async function auditAndCheck(
  userId: string,
  projectId: string,
  action: PermissionAction,
  resource: string,
  resourceId?: string,
): Promise<RbacResult> {
  const result = await requireProjectPermission(userId, projectId, action)

  if (result.allowed) {
    await recordAudit({
      userId,
      projectId,
      action,
      resource,
      resourceId,
    })
  }

  return result
}
