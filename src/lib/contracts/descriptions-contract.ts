export class DescriptionsContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DescriptionsContractError'
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new DescriptionsContractError(`${fieldName} must be a JSON array`)
  }
  const invalidIndex = value.findIndex((item) => typeof item !== 'string')
  if (invalidIndex !== -1) {
    throw new DescriptionsContractError(`${fieldName}[${invalidIndex}] must be a string`)
  }
}

export function decodeDescriptionsStrict(raw: string, fieldName = 'descriptions'): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new DescriptionsContractError(`${fieldName} must be valid JSON`)
  }
  assertStringArray(parsed, fieldName)
  return parsed
}
