import { prisma } from '@/lib/prisma'

type AuditItem = {
  key: string
  description: string
  count: number
}

type CountRow = {
  count: bigint | number
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

async function countBySql(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql)
  const first = rows[0]
  if (!first) return 0
  return toNumber(first.count)
}

async function main() {
  const strict = hasStrictFlag()
  const checks: Array<{ key: string; description: string; sql: string }> = [
    {
      key: 'task_without_project',
      description: 'tasks.projectId 指向不存在的 projects.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.projectId
        WHERE p.id IS NULL
      `,
    },
    {
      key: 'task_without_user',
      description: 'tasks.userId 指向不存在的 user.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM tasks t
        LEFT JOIN user u ON u.id = t.userId
        WHERE u.id IS NULL
      `,
    },
    {
      key: 'task_event_without_task',
      description: 'task_events.taskId 指向不存在的 tasks.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM task_events e
        LEFT JOIN tasks t ON t.id = e.taskId
        WHERE t.id IS NULL
      `,
    },
    {
      key: 'task_event_without_project',
      description: 'task_events.projectId 指向不存在的 projects.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM task_events e
        LEFT JOIN projects p ON p.id = e.projectId
        WHERE p.id IS NULL
      `,
    },
    {
      key: 'task_event_without_user',
      description: 'task_events.userId 指向不存在的 user.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM task_events e
        LEFT JOIN user u ON u.id = e.userId
        WHERE u.id IS NULL
      `,
    },
    {
      key: 'balance_freeze_without_user',
      description: 'balance_freezes.userId 指向不存在的 user.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM balance_freezes f
        LEFT JOIN user u ON u.id = f.userId
        WHERE u.id IS NULL
      `,
    },
    {
      key: 'balance_freeze_without_task',
      description: 'balance_freezes.taskId 指向不存在的 tasks.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM balance_freezes f
        LEFT JOIN tasks t ON t.id = f.taskId
        WHERE f.taskId IS NOT NULL AND t.id IS NULL
      `,
    },
    {
      key: 'balance_transaction_without_user',
      description: 'balance_transactions.userId 指向不存在的 user.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM balance_transactions bt
        LEFT JOIN user u ON u.id = bt.userId
        WHERE u.id IS NULL
      `,
    },
    {
      key: 'balance_transaction_without_freeze',
      description: 'balance_transactions.freezeId 指向不存在的 balance_freezes.id',
      sql: `
        SELECT COUNT(*) AS count
        FROM balance_transactions bt
        LEFT JOIN balance_freezes bf ON bf.id = bt.freezeId
        WHERE bt.freezeId IS NOT NULL AND bf.id IS NULL
      `,
    },
  ]

  const items: AuditItem[] = []
  for (const check of checks) {
    items.push({
      key: check.key,
      description: check.description,
      count: await countBySql(check.sql),
    })
  }

  const violationCount = items.reduce((sum, item) => sum + item.count, 0)

  process.stdout.write(`${JSON.stringify({
    checkedAt: new Date().toISOString(),
    strict,
    violationCount,
    items,
  }, null, 2)}\n`)

  if (strict && violationCount > 0) {
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
