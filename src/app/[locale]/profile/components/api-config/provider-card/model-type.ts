import type { ProviderCardGroupedModels, ProviderCardModelType } from './types'

const OPENAI_TEXT_FIRST_PROVIDER_KEYS = new Set<string>([
  'openrouter',
  'openai-compatible',
  'newapi',
])

const OPENAI_COMPATIBLE_PROVIDER_KEY = 'openai-compatible'
const MODEL_TYPE_ORDER: ProviderCardModelType[] = ['llm', 'image', 'video', 'audio']

function hasModelsOfType(groupedModels: ProviderCardGroupedModels, type: ProviderCardModelType): boolean {
  const models = groupedModels[type]
  return Array.isArray(models) && models.length > 0
}

export function getAddableModelTypes(providerKey: string): ProviderCardModelType[] {
  if (providerKey === OPENAI_COMPATIBLE_PROVIDER_KEY) {
    return ['llm']
  }

  return ['llm', 'image', 'video', 'audio']
}

export function getDefaultAddModelType(providerKey: string): ProviderCardModelType {
  if (OPENAI_TEXT_FIRST_PROVIDER_KEYS.has(providerKey)) {
    return 'llm'
  }

  return 'image'
}

export function getVisibleModelTypes(
  groupedModels: ProviderCardGroupedModels,
  addableTypes: ProviderCardModelType[],
): ProviderCardModelType[] {
  const addableTypeSet = new Set<ProviderCardModelType>(addableTypes)
  return MODEL_TYPE_ORDER.filter((type) => addableTypeSet.has(type) || hasModelsOfType(groupedModels, type))
}
