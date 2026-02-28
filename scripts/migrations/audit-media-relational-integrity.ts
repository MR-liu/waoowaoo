import { prisma } from '@/lib/prisma'
import { MEDIA_MODEL_MAPPINGS } from '../media-mapping'

type CountRow = {
  count: bigint | number
}

type MediaAuditItem = {
  tableName: string
  mediaIdField: string
  orphanCount: number
}

function hasStrictFlag() {
  return process.argv.includes('--strict')
}

function toNumber(value: bigint | number): number {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return value
}

async function countOrphans(tableName: string, mediaIdField: string): Promise<number> {
  const sql = `
    SELECT COUNT(*) AS count
    FROM ${tableName} t
    LEFT JOIN media_objects m ON m.id = t.${mediaIdField}
    WHERE t.${mediaIdField} IS NOT NULL AND m.id IS NULL
  `
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql)
  const first = rows[0]
  if (!first) return 0
  return toNumber(first.count)
}

async function main() {
  const strict = hasStrictFlag()
  const items: MediaAuditItem[] = []

  for (const mapping of MEDIA_MODEL_MAPPINGS) {
    for (const field of mapping.fields) {
      const orphanCount = await countOrphans(mapping.tableName, field.mediaIdField)
      items.push({
        tableName: mapping.tableName,
        mediaIdField: field.mediaIdField,
        orphanCount,
      })
    }
  }

  const totalOrphans = items.reduce((sum, item) => sum + item.orphanCount, 0)
  const withOrphans = items.filter((item) => item.orphanCount > 0)

  process.stdout.write(`${JSON.stringify({
    checkedAt: new Date().toISOString(),
    strict,
    totalOrphans,
    itemCount: items.length,
    withOrphans,
  }, null, 2)}\n`)

  if (strict && totalOrphans > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }, null, 2)}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
