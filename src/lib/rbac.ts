import { prisma } from '@/lib/prisma'

export type SystemRole = 'admin' | 'producer' | 'director' | 'supervisor' | 'coordinator' | 'artist'

export type ProjectRole =
  | 'producer'
  | 'director'
  | 'supervisor'
  | 'coordinator'
  | 'artist'
  | 'client'
  | 'vendor'

const PROJECT_ROLE_LEVEL: Record<ProjectRole, number> = {
  producer: 7,
  director: 6,
  supervisor: 5,
  coordinator: 4,
  artist: 3,
  client: 2,
  vendor: 1,
}

export type PermissionAction =
  | 'view'
  | 'edit'
  | 'generate'
  | 'delete'
  | 'review'
  | 'approve'
  | 'manage_members'
  | 'manage_settings'
  | 'manage_budget'
  | 'upload'

const ACTION_MIN_ROLE: Record<PermissionAction, ProjectRole> = {
  view: 'vendor',
  upload: 'vendor',
  edit: 'artist',
  generate: 'artist',
  review: 'client',
  approve: 'director',
  delete: 'coordinator',
  manage_members: 'supervisor',
  manage_settings: 'producer',
  manage_budget: 'producer',
}

export function hasPermission(userRole: ProjectRole, requiredRole: ProjectRole): boolean {
  return PROJECT_ROLE_LEVEL[userRole] >= PROJECT_ROLE_LEVEL[requiredRole]
}

export function canPerformAction(role: ProjectRole, action: PermissionAction): boolean {
  return hasPermission(role, ACTION_MIN_ROLE[action])
}

export async function getProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })

  if (project?.userId === userId) return 'producer'

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  })

  if (!membership) return null
  return membership.role as ProjectRole
}

export interface RoleViewConfig {
  showBudget: boolean
  showScheduling: boolean
  showReviewQueue: boolean
  showTaskList: boolean
  showFileBox: boolean
  showSpreadsheet: boolean
  showGantt: boolean
  showKanban: boolean
  showDashboard: boolean
  showAnnotation: boolean
  defaultView: string
}

export function getViewConfigForRole(role: ProjectRole): RoleViewConfig {
  switch (role) {
    case 'producer':
      return {
        showBudget: true, showScheduling: true, showReviewQueue: true,
        showTaskList: true, showFileBox: false, showSpreadsheet: true,
        showGantt: true, showKanban: true, showDashboard: true,
        showAnnotation: false, defaultView: 'dashboard',
      }
    case 'director':
      return {
        showBudget: false, showScheduling: false, showReviewQueue: true,
        showTaskList: false, showFileBox: false, showSpreadsheet: false,
        showGantt: false, showKanban: false, showDashboard: false,
        showAnnotation: true, defaultView: 'review',
      }
    case 'supervisor':
      return {
        showBudget: false, showScheduling: true, showReviewQueue: true,
        showTaskList: true, showFileBox: false, showSpreadsheet: true,
        showGantt: false, showKanban: true, showDashboard: true,
        showAnnotation: true, defaultView: 'kanban',
      }
    case 'coordinator':
      return {
        showBudget: false, showScheduling: true, showReviewQueue: false,
        showTaskList: true, showFileBox: false, showSpreadsheet: true,
        showGantt: true, showKanban: true, showDashboard: false,
        showAnnotation: false, defaultView: 'spreadsheet',
      }
    case 'artist':
      return {
        showBudget: false, showScheduling: false, showReviewQueue: false,
        showTaskList: true, showFileBox: true, showSpreadsheet: false,
        showGantt: false, showKanban: false, showDashboard: false,
        showAnnotation: false, defaultView: 'tasks',
      }
    case 'client':
      return {
        showBudget: false, showScheduling: false, showReviewQueue: true,
        showTaskList: false, showFileBox: false, showSpreadsheet: false,
        showGantt: false, showKanban: false, showDashboard: false,
        showAnnotation: true, defaultView: 'review',
      }
    case 'vendor':
      return {
        showBudget: false, showScheduling: false, showReviewQueue: false,
        showTaskList: true, showFileBox: true, showSpreadsheet: false,
        showGantt: false, showKanban: false, showDashboard: false,
        showAnnotation: false, defaultView: 'tasks',
      }
  }
}
