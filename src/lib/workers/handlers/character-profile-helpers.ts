import { prisma } from '@/lib/prisma'

export type AnyObj = Record<string, unknown>

export function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readRequiredString(value: unknown, field: string): string {
  const text = readText(value).trim()
  if (!text) {
    throw new Error(`${field} is required`)
  }
  return text
}

export function parseVisualResponse(responseText: string): AnyObj {
  let cleaned = responseText.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }
  return JSON.parse(cleaned) as AnyObj
}

function resolveOptionalAnalysisModel(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function resolveProjectModel(projectId: string, overrideModel?: unknown) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      novelPromotionData: {
        select: {
          id: true,
          analysisModel: true,
        },
      },
    },
  })
  if (!project) throw new Error('Project not found')
  if (!project.novelPromotionData) throw new Error('Novel promotion data not found')
  const analysisModel = resolveOptionalAnalysisModel(overrideModel) || project.novelPromotionData.analysisModel || ''
  if (!analysisModel) throw new Error('请先在项目设置中配置分析模型')
  project.novelPromotionData.analysisModel = analysisModel
  return project
}
