# Phase 6 Gray Release & Closure

## Goals
- P0 门禁严格阻断，P1/P2 允许灰度放量。
- 发布过程标准化：发布前检查、灰度策略、回滚策略、稳定窗口收口。

## Release Gate
- 执行命令：
  - `npm run release:gate`
- 严格模式（包含 observability 阻断）：
  - `npm run release:gate:strict`
- Dry-run（仅生成计划与报告，不执行检查）：
  - `tsx scripts/release-gate.ts --dry-run`
- 报告 artifact（默认写入 `.artifacts/release/`）：
  - `tsx scripts/release-gate.ts --artifact-dir=.artifacts/release`
  - `tsx scripts/release-gate.ts --artifact-file=.artifacts/release/release-gate-manual.json`
- 可选跳过项：
  - `tsx scripts/release-gate.ts --skip-observability`
  - `tsx scripts/release-gate.ts --skip-regression`

## Canary Plan
- 配置文件：`config/release/canary-plan.json`
- 校验命令：`npm run release:canary:validate`
- 默认放量阶梯：
  - 5% -> 20% -> 50% -> 100%
- 每个阶段都包含：
  - entry criteria（进入条件）
  - rollback criteria（回滚条件）
  - hold duration（观察窗口）

## Rollback Rules (P0)
- 任一条件触发立即停止放量并回滚：
  - `taskFailureRate >= 0.05`
  - `terminalMismatchRate >= 0.005`
  - `maxQueueBacklog >= 500`
  - `staleProcessingCount >= 30`
  - `billingCompensationFailedCount >= 5`

## Stability Window
- 全量后保持至少 14 天稳定窗口。
- 每日执行：
  - `npm run ops:observability:alert-check`
- 每周执行：
  - P0 主链路健康审查 + 技术债清单更新

## Release Templates
- 灰度阶段记录：
  - `docs/release/templates/canary-stage-log.md`
- 回滚记录：
  - `docs/release/templates/rollback-log.md`
- 稳定窗口日报：
  - `docs/release/templates/stability-window-daily.md`
