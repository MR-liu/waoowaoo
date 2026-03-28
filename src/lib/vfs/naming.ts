export const DEFAULT_NAMING_TEMPLATE = '{project}_{sequence}_{shot}_{step}_v{version:###}.{ext}'

export interface NamingRule {
  pattern: RegExp
  description: string
  example: string
}

interface FileNameComponents {
  project: string
  sequence: string
  shot: string
  step: string
  version: number
  ext: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Convert a naming template like `{project}_{sequence}_{shot}_{step}_v{version:###}.{ext}`
 * into a RegExp for validation.
 *
 * - `{version:###}` → 3+ digit zero-padded number
 * - `{ext}` → file extension (letters, digits, max 10 chars)
 * - Other placeholders → one or more word chars / hyphens
 */
function templateToRegex(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
    if (match === '{' || match === '}') return match
    return `\\${match}`
  })

  const withPlaceholders = escaped.replace(
    /\{(\w+)(?::([^}]+))?\}/g,
    (_match, name: string, format?: string) => {
      if (name === 'version') {
        const padLength = format ? format.length : 3
        return `(\\d{${padLength},})`
      }
      if (name === 'ext') {
        return '([a-zA-Z0-9]{1,10})'
      }
      return '([\\w-]+)'
    },
  )

  return new RegExp(`^${withPlaceholders}$`)
}

function templateToDescription(template: string): string {
  return template
    .replace(/\{version:[^}]+\}/, '{version: zero-padded number}')
    .replace(/\{ext\}/, '{ext: file extension}')
}

/**
 * Build a NamingRule from a template string.
 */
export function buildNamingRule(template: string): NamingRule {
  return {
    pattern: templateToRegex(template),
    description: templateToDescription(template),
    example: template
      .replace('{project}', 'MYPROJ')
      .replace('{sequence}', 'SQ010')
      .replace('{shot}', 'SH0010')
      .replace('{step}', 'anim')
      .replace(/\{version:[^}]+\}/, '001')
      .replace('{ext}', 'ma'),
  }
}

/**
 * Validate a filename against a naming template.
 */
export function validateFileName(
  fileName: string,
  template: string = DEFAULT_NAMING_TEMPLATE,
): ValidationResult {
  const errors: string[] = []

  if (!fileName.trim()) {
    errors.push('Filename is empty')
    return { valid: false, errors }
  }

  const rule = buildNamingRule(template)

  if (!rule.pattern.test(fileName)) {
    errors.push(
      `Filename "${fileName}" does not match naming convention: ${rule.description}. Example: ${rule.example}`,
    )
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Extract the version number from a filename.
 * Looks for the pattern `_v` followed by digits before the file extension.
 */
export function extractVersionNumber(fileName: string): number | null {
  const match = /_v(\d+)\.[a-zA-Z0-9]+$/.exec(fileName)
  if (!match) return null
  return parseInt(match[1], 10)
}

/**
 * Build a filename from structured components following the default template.
 */
export function buildFileName(components: FileNameComponents): string {
  const paddedVersion = String(components.version).padStart(3, '0')
  return `${components.project}_${components.sequence}_${components.shot}_${components.step}_v${paddedVersion}.${components.ext}`
}
