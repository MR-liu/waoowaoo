/**
 * AYON <-> NEXUS-X bridge service
 * Handles bidirectional data sync between AYON pipeline system and NEXUS-X
 */

import { prisma } from '@/lib/prisma'
import { createScopedLogger } from '@/lib/logging/core'
import { AyonClient, type AyonFolder, type AyonVersion } from './client'

const logger = createScopedLogger({ module: 'ayon-bridge' })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  foldersCreated: number
  foldersUpdated: number
  versionsCreated: number
  errors: SyncError[]
}

export interface SyncError {
  entity: 'folder' | 'version' | 'publish'
  entityId: string
  message: string
}

interface FolderTypeMapping {
  ayonFolderType: string
  nexusEntityType: 'sequence' | 'shot' | 'asset'
}

const FOLDER_TYPE_MAP: FolderTypeMapping[] = [
  { ayonFolderType: 'Sequence', nexusEntityType: 'sequence' },
  { ayonFolderType: 'Shot', nexusEntityType: 'shot' },
  { ayonFolderType: 'Asset', nexusEntityType: 'asset' },
]

function resolveNexusEntityType(ayonFolderType: string): 'sequence' | 'shot' | 'asset' | null {
  const mapping = FOLDER_TYPE_MAP.find((m) => m.ayonFolderType === ayonFolderType)
  return mapping?.nexusEntityType ?? null
}

// ---------------------------------------------------------------------------
// Sync: AYON -> NEXUS-X
// ---------------------------------------------------------------------------

export async function syncProjectFromAyon(
  ayonProjectName: string,
  nexusProjectId: string,
): Promise<SyncResult> {
  const client = new AyonClient()
  const result: SyncResult = {
    foldersCreated: 0,
    foldersUpdated: 0,
    versionsCreated: 0,
    errors: [],
  }

  logger.info({
    action: 'ayon.sync.start',
    message: `Starting sync from AYON project "${ayonProjectName}" to NEXUS-X project "${nexusProjectId}"`,
  })

  const project = await prisma.project.findUnique({ where: { id: nexusProjectId } })
  if (!project) {
    throw new Error(`NEXUS-X project ${nexusProjectId} not found`)
  }

  const folders = await client.listFolders(ayonProjectName)
  await syncFolders(folders, nexusProjectId, result)

  const versions = await client.listVersions(ayonProjectName)
  await syncVersions(versions, nexusProjectId, result)

  logger.info({
    action: 'ayon.sync.complete',
    message: `Sync complete: ${result.foldersCreated} folders created, ${result.versionsCreated} versions created, ${result.errors.length} errors`,
    details: { ...result },
  })

  return result
}

async function syncFolders(
  folders: AyonFolder[],
  nexusProjectId: string,
  result: SyncResult,
): Promise<void> {
  const sequenceFolders = folders.filter((f) => resolveNexusEntityType(f.folderType) === 'sequence')
  const shotFolders = folders.filter((f) => resolveNexusEntityType(f.folderType) === 'shot')
  const assetFolders = folders.filter((f) => resolveNexusEntityType(f.folderType) === 'asset')

  for (const folder of sequenceFolders) {
    try {
      const existing = await prisma.sequence.findFirst({
        where: { projectId: nexusProjectId, code: folder.name },
      })
      if (existing) {
        result.foldersUpdated++
      } else {
        await prisma.sequence.create({
          data: {
            projectId: nexusProjectId,
            name: folder.name,
            code: folder.name,
          },
        })
        result.foldersCreated++
      }
    } catch (error) {
      result.errors.push({
        entity: 'folder',
        entityId: folder.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const folder of shotFolders) {
    try {
      const parentSequence = sequenceFolders.find((sf) => sf.id === folder.parentId)
      if (!parentSequence) {
        result.errors.push({
          entity: 'folder',
          entityId: folder.id,
          message: `Shot "${folder.name}" has no parent sequence folder`,
        })
        continue
      }
      const sequence = await prisma.sequence.findFirst({
        where: { projectId: nexusProjectId, code: parentSequence.name },
      })
      if (!sequence) {
        result.errors.push({
          entity: 'folder',
          entityId: folder.id,
          message: `Parent sequence "${parentSequence.name}" not found in NEXUS-X`,
        })
        continue
      }
      const existingShot = await prisma.cgShot.findFirst({
        where: { sequenceId: sequence.id, code: folder.name },
      })
      if (existingShot) {
        result.foldersUpdated++
      } else {
        await prisma.cgShot.create({
          data: {
            sequenceId: sequence.id,
            code: folder.name,
            name: folder.name,
          },
        })
        result.foldersCreated++
      }
    } catch (error) {
      result.errors.push({
        entity: 'folder',
        entityId: folder.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const folder of assetFolders) {
    try {
      const existingAsset = await prisma.cgAsset.findFirst({
        where: { projectId: nexusProjectId, code: folder.name },
      })
      if (existingAsset) {
        result.foldersUpdated++
      } else {
        await prisma.cgAsset.create({
          data: {
            projectId: nexusProjectId,
            name: folder.name,
            code: folder.name,
            assetType: 'generic',
          },
        })
        result.foldersCreated++
      }
    } catch (error) {
      result.errors.push({
        entity: 'folder',
        entityId: folder.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function syncVersions(
  ayonVersions: AyonVersion[],
  nexusProjectId: string,
  result: SyncResult,
): Promise<void> {
  for (const av of ayonVersions) {
    try {
      const task = await prisma.productionTask.findFirst({
        where: { pipelineStep: { projectId: nexusProjectId } },
        orderBy: { createdAt: 'desc' },
      })
      if (!task) {
        result.errors.push({
          entity: 'version',
          entityId: av.id,
          message: `No production task found in project ${nexusProjectId} for AYON version ${av.id}`,
        })
        continue
      }

      const existingVersion = await prisma.cgVersion.findFirst({
        where: {
          productionTaskId: task.id,
          comment: `ayon:${av.id}`,
        },
      })
      if (existingVersion) continue

      const latestVersion = await prisma.cgVersion.findFirst({
        where: { productionTaskId: task.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      })
      const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

      await prisma.cgVersion.create({
        data: {
          productionTaskId: task.id,
          versionNumber: nextVersionNumber,
          comment: `ayon:${av.id}`,
          status: av.status === 'approved' ? 'approved' : 'pending_review',
          createdById: task.assigneeId ?? 'system',
          metadata: JSON.stringify({
            ayonVersionId: av.id,
            ayonProductId: av.productId,
            ayonAuthor: av.author,
            syncedAt: new Date().toISOString(),
          }),
        },
      })
      result.versionsCreated++
    } catch (error) {
      result.errors.push({
        entity: 'version',
        entityId: av.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Sync: single AYON version -> specific NEXUS-X task
// ---------------------------------------------------------------------------

export async function syncVersionToNexus(
  ayonVersion: AyonVersion,
  nexusTaskId: string,
): Promise<void> {
  const task = await prisma.productionTask.findUnique({ where: { id: nexusTaskId } })
  if (!task) {
    throw new Error(`ProductionTask ${nexusTaskId} not found`)
  }

  const existingVersion = await prisma.cgVersion.findFirst({
    where: {
      productionTaskId: nexusTaskId,
      comment: `ayon:${ayonVersion.id}`,
    },
  })
  if (existingVersion) {
    logger.info({
      action: 'ayon.version_sync.skip',
      message: `AYON version ${ayonVersion.id} already synced to task ${nexusTaskId}`,
    })
    return
  }

  const latestVersion = await prisma.cgVersion.findFirst({
    where: { productionTaskId: nexusTaskId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })
  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

  await prisma.cgVersion.create({
    data: {
      productionTaskId: nexusTaskId,
      versionNumber: nextVersionNumber,
      comment: `ayon:${ayonVersion.id}`,
      status: ayonVersion.status === 'approved' ? 'approved' : 'pending_review',
      createdById: task.assigneeId ?? 'system',
      metadata: JSON.stringify({
        ayonVersionId: ayonVersion.id,
        ayonProductId: ayonVersion.productId,
        ayonAuthor: ayonVersion.author,
        syncedAt: new Date().toISOString(),
      }),
    },
  })

  logger.info({
    action: 'ayon.version_sync.created',
    message: `Created NEXUS-X version v${nextVersionNumber} from AYON version ${ayonVersion.id}`,
  })
}

// ---------------------------------------------------------------------------
// Publish: NEXUS-X -> AYON
// ---------------------------------------------------------------------------

export async function publishFromNexusToAyon(nexusPublishId: string): Promise<void> {
  const publish = await prisma.cgPublish.findUnique({
    where: { id: nexusPublishId },
    include: {
      version: {
        include: {
          productionTask: {
            include: {
              pipelineStep: true,
              shot: { include: { sequence: true } },
              asset: true,
            },
          },
        },
      },
    },
  })

  if (!publish) {
    throw new Error(`CgPublish ${nexusPublishId} not found`)
  }

  const task = publish.version.productionTask
  const projectId = task.pipelineStep.projectId
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const client = new AyonClient()

  let folderName: string
  let folderType: string
  if (task.shot) {
    folderName = task.shot.code
    folderType = 'Shot'
  } else if (task.asset) {
    folderName = task.asset.code
    folderType = 'Asset'
  } else {
    throw new Error(`ProductionTask ${task.id} has neither shot nor asset association`)
  }

  const ayonProjectName = project.name.replace(/\s+/g, '_').toLowerCase()
  const existingFolders = await client.listFolders(ayonProjectName)
  const targetFolder = existingFolders.find(
    (f) => f.name === folderName && f.folderType === folderType,
  )

  if (!targetFolder) {
    let parentId: string | undefined
    if (task.shot?.sequence) {
      const seqFolder = existingFolders.find(
        (f) => f.name === task.shot!.sequence.code && f.folderType === 'Sequence',
      )
      parentId = seqFolder?.id
    }
    await client.createFolder(ayonProjectName, {
      name: folderName,
      folderType,
      parentId,
    })
  }

  logger.info({
    action: 'ayon.publish.complete',
    message: `Published NEXUS-X version to AYON folder "${folderName}" in project "${ayonProjectName}"`,
    details: {
      nexusPublishId,
      ayonProject: ayonProjectName,
      folder: folderName,
    },
  })
}
