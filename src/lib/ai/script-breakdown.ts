import { prisma } from '@/lib/prisma'
import { chatCompletion, getCompletionContent } from '@/lib/llm-client'
import type { ChatMessage } from '@/lib/llm/types'
import { createScopedLogger } from '@/lib/logging/core'

const logger = createScopedLogger({ module: 'ai.script-breakdown' })

// ─── Types ──────────────────────────────────────────────────────

export interface ScriptScene {
  sceneNumber: number
  heading: string
  description: string
  location: string
  timeOfDay: string
  characters: string[]
  props: string[]
  vfxCues: string[]
  estimatedDuration: number
}

export interface ScriptCharacter {
  name: string
  description: string
  role: 'lead' | 'supporting' | 'extra'
}

export interface ScriptAsset {
  name: string
  type: 'character' | 'prop' | 'vehicle' | 'environment'
  description: string
  requiresVfx: boolean
}

export interface ScriptBreakdownResult {
  scenes: ScriptScene[]
  characters: ScriptCharacter[]
  assets: ScriptAsset[]
}

export interface BreakdownConfirmResult {
  sequences: number
  shots: number
  assets: number
}

// ─── Prompt construction ────────────────────────────────────────

function buildBreakdownPrompt(scriptText: string): ChatMessage[] {
  const systemPrompt = `You are an expert film production script supervisor. Analyze the provided script and extract a structured breakdown.

Return ONLY valid JSON matching this exact schema (no markdown fences, no commentary):
{
  "scenes": [
    {
      "sceneNumber": <integer>,
      "heading": "<scene heading / slugline>",
      "description": "<1-2 sentence summary>",
      "location": "<location name>",
      "timeOfDay": "<DAY|NIGHT|DAWN|DUSK|CONTINUOUS>",
      "characters": ["<character names present>"],
      "props": ["<notable props>"],
      "vfxCues": ["<VFX requirements if any>"],
      "estimatedDuration": <seconds as integer>
    }
  ],
  "characters": [
    {
      "name": "<character name>",
      "description": "<brief description>",
      "role": "<lead|supporting|extra>"
    }
  ],
  "assets": [
    {
      "name": "<asset name>",
      "type": "<character|prop|vehicle|environment>",
      "description": "<brief description>",
      "requiresVfx": <boolean>
    }
  ]
}

Rules:
- Number scenes sequentially starting from 1
- Extract every distinct character, even extras mentioned by name
- List props only when they are significant to the action
- Mark VFX cues for stunts, CG creatures, compositing, green screen, etc.
- estimatedDuration should be a rough estimate in seconds based on dialog and action density
- Deduplicate characters and assets across scenes`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: scriptText },
  ]
}

// ─── Response parsing ───────────────────────────────────────────

const VALID_ROLES = new Set<ScriptCharacter['role']>(['lead', 'supporting', 'extra'])
const VALID_ASSET_TYPES = new Set<ScriptAsset['type']>(['character', 'prop', 'vehicle', 'environment'])
const VALID_TIME_OF_DAY = new Set(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS'])

function parseBreakdownResponse(raw: string): ScriptBreakdownResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed: unknown = JSON.parse(cleaned)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('LLM returned non-object response')
  }

  const obj = parsed as Record<string, unknown>
  const rawScenes = Array.isArray(obj.scenes) ? obj.scenes : []
  const rawCharacters = Array.isArray(obj.characters) ? obj.characters : []
  const rawAssets = Array.isArray(obj.assets) ? obj.assets : []

  const scenes: ScriptScene[] = rawScenes.map((s: unknown, idx: number) => {
    const scene = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
    const timeOfDay = typeof scene.timeOfDay === 'string' && VALID_TIME_OF_DAY.has(scene.timeOfDay.toUpperCase())
      ? scene.timeOfDay.toUpperCase()
      : 'DAY'

    return {
      sceneNumber: typeof scene.sceneNumber === 'number' ? scene.sceneNumber : idx + 1,
      heading: typeof scene.heading === 'string' ? scene.heading : `Scene ${idx + 1}`,
      description: typeof scene.description === 'string' ? scene.description : '',
      location: typeof scene.location === 'string' ? scene.location : 'Unknown',
      timeOfDay,
      characters: Array.isArray(scene.characters) ? scene.characters.filter((c: unknown): c is string => typeof c === 'string') : [],
      props: Array.isArray(scene.props) ? scene.props.filter((p: unknown): p is string => typeof p === 'string') : [],
      vfxCues: Array.isArray(scene.vfxCues) ? scene.vfxCues.filter((v: unknown): v is string => typeof v === 'string') : [],
      estimatedDuration: typeof scene.estimatedDuration === 'number' ? scene.estimatedDuration : 30,
    }
  })

  const characters: ScriptCharacter[] = rawCharacters.map((c: unknown) => {
    const char = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
    const role = typeof char.role === 'string' && VALID_ROLES.has(char.role as ScriptCharacter['role'])
      ? (char.role as ScriptCharacter['role'])
      : 'extra'

    return {
      name: typeof char.name === 'string' ? char.name : 'Unknown',
      description: typeof char.description === 'string' ? char.description : '',
      role,
    }
  })

  const assets: ScriptAsset[] = rawAssets.map((a: unknown) => {
    const asset = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
    const assetType = typeof asset.type === 'string' && VALID_ASSET_TYPES.has(asset.type as ScriptAsset['type'])
      ? (asset.type as ScriptAsset['type'])
      : 'prop'

    return {
      name: typeof asset.name === 'string' ? asset.name : 'Unknown',
      type: assetType,
      description: typeof asset.description === 'string' ? asset.description : '',
      requiresVfx: typeof asset.requiresVfx === 'boolean' ? asset.requiresVfx : false,
    }
  })

  return { scenes, characters, assets }
}

// ─── Public API ─────────────────────────────────────────────────

export async function breakdownScript(
  scriptText: string,
  projectId: string,
): Promise<ScriptBreakdownResult> {
  logger.info({
    action: 'breakdown.start',
    message: 'Starting script breakdown',
    details: { projectId, scriptLength: scriptText.length },
  })

  const messages = buildBreakdownPrompt(scriptText)
  const completion = await chatCompletion(messages, 'openrouter::anthropic/claude-sonnet-4', {
    temperature: 0.2,
    projectId,
    action: 'script-breakdown',
  })

  const content = getCompletionContent(completion)
  if (!content) {
    throw new Error('LLM returned empty response for script breakdown')
  }

  const result = parseBreakdownResponse(content)

  logger.info({
    action: 'breakdown.complete',
    message: 'Script breakdown completed',
    details: {
      projectId,
      scenesCount: result.scenes.length,
      charactersCount: result.characters.length,
      assetsCount: result.assets.length,
    },
  })

  return result
}

export async function confirmBreakdown(
  projectId: string,
  result: ScriptBreakdownResult,
): Promise<BreakdownConfirmResult> {
  logger.info({
    action: 'breakdown.confirm.start',
    message: 'Confirming breakdown and creating entities',
    details: { projectId },
  })

  const locationGroups = new Map<string, ScriptScene[]>()
  for (const scene of result.scenes) {
    const key = scene.location.toLowerCase()
    const existing = locationGroups.get(key) ?? []
    existing.push(scene)
    locationGroups.set(key, existing)
  }

  let totalShots = 0

  const sequences = await Promise.all(
    Array.from(locationGroups.entries()).map(async ([, scenes], seqIdx) => {
      const firstScene = scenes[0]
      const seqCode = `SEQ_${String(seqIdx + 1).padStart(3, '0')}`

      const sequence = await prisma.sequence.create({
        data: {
          projectId,
          name: firstScene.heading,
          code: seqCode,
          sortOrder: seqIdx,
          description: firstScene.description,
          status: 'not_started',
        },
      })

      const shotPromises = scenes.map(async (scene, shotIdx) => {
        const shotCode = `SH_${String(scene.sceneNumber).padStart(4, '0')}`
        await prisma.cgShot.create({
          data: {
            sequenceId: sequence.id,
            code: shotCode,
            name: scene.heading,
            description: scene.description,
            sortOrder: shotIdx,
            status: 'not_started',
            duration: scene.estimatedDuration,
          },
        })
        totalShots++
      })

      await Promise.all(shotPromises)
      return sequence
    }),
  )

  const assetPromises = result.assets.map(async (asset, idx) => {
    const assetCode = `AST_${String(idx + 1).padStart(3, '0')}`
    await prisma.cgAsset.create({
      data: {
        projectId,
        name: asset.name,
        code: assetCode,
        assetType: asset.type,
        description: asset.description,
        status: 'not_started',
        metadata: JSON.stringify({ requiresVfx: asset.requiresVfx }),
      },
    })
  })

  await Promise.all(assetPromises)

  const confirmResult: BreakdownConfirmResult = {
    sequences: sequences.length,
    shots: totalShots,
    assets: result.assets.length,
  }

  logger.info({
    action: 'breakdown.confirm.complete',
    message: 'Breakdown entities created',
    details: { projectId, ...confirmResult },
  })

  return confirmResult
}
