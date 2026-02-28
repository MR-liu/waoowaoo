# Phase 5 Runbook (Observability & Ops)

## Scope
- P0 任务链路观测闭环：提交、入队、worker 执行、事件发布、SSE 连接/回放。
- 统一观测标签：`requestId`、`taskId`、`projectId`、`userId`。
- 快照巡检与阈值告警初版。

## Unified Metrics Contract
- Counter action: `task.metric.counter`
- Histogram action: `task.metric.histogram`
- 关键指标：
  - `task_submit_total`
  - `task_enqueue_total`
  - `task_worker_lifecycle_total`
  - `task_worker_duration_ms`
  - `task_event_publish_total`
  - `task_sse_connection_total`
  - `task_sse_replay_events_total`
  - `task_sse_payload_parse_failed_total`
  - `task_sse_connection_duration_ms`

## Alert Thresholds (v1)
- 任务失败率 `taskFailureRate`
  - `warn >= 0.03`
  - `critical >= 0.05`
- 终态错配率 `terminalMismatchRate`
  - `warn >= 0.001`
  - `critical >= 0.005`
- 最大队列堆积 `maxQueueBacklog`
  - `warn >= 200`
  - `critical >= 500`
- 陈旧 processing 任务数 `staleProcessingCount`
  - `warn >= 10`
  - `critical >= 30`
- 计费补偿失败数 `billingCompensationFailedCount`
  - `warn >= 1`
  - `critical >= 5`

## Commands
- 生成 60 分钟快照：
  - `npm run ops:observability:snapshot`
- 严格告警检查（warn/critical 返回非零）：
  - `npm run ops:observability:alert-check`
- 自定义窗口：
  - `tsx scripts/observability-p0-snapshot.ts --minutes=180 --stale-processing-minutes=10 --strict`

## Incident Playbook
1. 先跑快照，定位是否 `critical`。
2. 若队列堆积过高：
   - 检查 `queueBacklog` 中异常队列。
   - 在对应 worker deployment 扩容并确认消费速率恢复。
3. 若终态错配率升高：
   - 检查 `task_event_publish_total` 中 `result=failed` 的任务。
   - 按 `taskId` 回放 `task_events` 并执行重放修复脚本。
4. 若陈旧 processing 任务数升高：
   - 检查 worker 心跳与 watchdog 日志。
   - 按 runbook 执行 watchdog requeue 或 failover。
5. 若计费补偿失败：
   - 检查 `errorCode=BILLING_COMPENSATION_FAILED` 任务。
   - 触发计费补偿修复与对账脚本。

## Exit Criteria
- 连续两周 `ops:observability:alert-check` 无 critical。
- P0 SLO 达标并稳定。
