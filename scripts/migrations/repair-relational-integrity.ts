import { prisma } from '@/lib/prisma'

type CountRow = {
  count: bigint | number
}

type RepairSummary = {
  mode: 'dry-run' | 'apply'
  checkedAt: string
  repaired: Record<string, number>
  remaining: Record<string, number>
}

function hasApplyFlag() {
  return process.argv.includes('--apply')
}

function toNumber(value: bigint | number): number {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return value
}

async function count(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql)
  const first = rows[0]
  if (!first) return 0
  return toNumber(first.count)
}

async function snapshotCounts() {
  return {
    task_without_project: await count(`
      SELECT COUNT(*) AS count
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.projectId
      WHERE p.id IS NULL
    `),
    task_without_user: await count(`
      SELECT COUNT(*) AS count
      FROM tasks t
      LEFT JOIN user u ON u.id = t.userId
      WHERE u.id IS NULL
    `),
    task_event_orphan: await count(`
      SELECT COUNT(*) AS count
      FROM task_events e
      LEFT JOIN tasks t ON t.id = e.taskId
      LEFT JOIN projects p ON p.id = e.projectId
      LEFT JOIN user u ON u.id = e.userId
      WHERE t.id IS NULL OR p.id IS NULL OR u.id IS NULL
    `),
    balance_freeze_without_user: await count(`
      SELECT COUNT(*) AS count
      FROM balance_freezes f
      LEFT JOIN user u ON u.id = f.userId
      WHERE u.id IS NULL
    `),
    balance_freeze_without_task: await count(`
      SELECT COUNT(*) AS count
      FROM balance_freezes f
      LEFT JOIN tasks t ON t.id = f.taskId
      WHERE f.taskId IS NOT NULL AND t.id IS NULL
    `),
    balance_transaction_without_user: await count(`
      SELECT COUNT(*) AS count
      FROM balance_transactions bt
      LEFT JOIN user u ON u.id = bt.userId
      WHERE u.id IS NULL
    `),
    balance_transaction_without_freeze: await count(`
      SELECT COUNT(*) AS count
      FROM balance_transactions bt
      LEFT JOIN balance_freezes bf ON bf.id = bt.freezeId
      WHERE bt.freezeId IS NOT NULL AND bf.id IS NULL
    `),
  }
}

async function main() {
  const apply = hasApplyFlag()
  const before = await snapshotCounts()

  const repaired: Record<string, number> = {
    task_event_orphan_deleted: 0,
    task_orphan_deleted: 0,
    balance_freeze_without_user_deleted: 0,
    balance_freeze_without_task_cleared: 0,
    balance_transaction_without_user_deleted: 0,
    balance_transaction_without_freeze_cleared: 0,
  }

  if (apply) {
    await prisma.$transaction(async (tx) => {
      repaired.task_event_orphan_deleted = await tx.$executeRawUnsafe(`
        DELETE e FROM task_events e
        LEFT JOIN tasks t ON t.id = e.taskId
        LEFT JOIN projects p ON p.id = e.projectId
        LEFT JOIN user u ON u.id = e.userId
        WHERE t.id IS NULL OR p.id IS NULL OR u.id IS NULL
      `)

      repaired.task_orphan_deleted = await tx.$executeRawUnsafe(`
        DELETE t FROM tasks t
        LEFT JOIN projects p ON p.id = t.projectId
        LEFT JOIN user u ON u.id = t.userId
        WHERE p.id IS NULL OR u.id IS NULL
      `)

      repaired.balance_freeze_without_user_deleted = await tx.$executeRawUnsafe(`
        DELETE f FROM balance_freezes f
        LEFT JOIN user u ON u.id = f.userId
        WHERE u.id IS NULL
      `)

      repaired.balance_freeze_without_task_cleared = await tx.$executeRawUnsafe(`
        UPDATE balance_freezes f
        LEFT JOIN tasks t ON t.id = f.taskId
        SET f.taskId = NULL
        WHERE f.taskId IS NOT NULL AND t.id IS NULL
      `)

      repaired.balance_transaction_without_user_deleted = await tx.$executeRawUnsafe(`
        DELETE bt FROM balance_transactions bt
        LEFT JOIN user u ON u.id = bt.userId
        WHERE u.id IS NULL
      `)

      repaired.balance_transaction_without_freeze_cleared = await tx.$executeRawUnsafe(`
        UPDATE balance_transactions bt
        LEFT JOIN balance_freezes bf ON bf.id = bt.freezeId
        SET bt.freezeId = NULL
        WHERE bt.freezeId IS NOT NULL AND bf.id IS NULL
      `)
    })
  }

  const after = await snapshotCounts()

  const summary: RepairSummary = {
    mode: apply ? 'apply' : 'dry-run',
    checkedAt: new Date().toISOString(),
    repaired,
    remaining: after,
  }

  process.stdout.write(`${JSON.stringify({
    before,
    ...summary,
  }, null, 2)}\n`)
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
