# Phase 0 Baseline (Industrialization)

## Scope
- Stabilize the execution baseline for industrial refactor.
- Enforce explicit-failure behavior on critical paths.
- Establish response contract migration path without breaking current clients.

## Target Outcomes
- `test:guards` and `test:regression` can be executed in CI and local environments.
- Core task path has no silent critical fallback in dedupe/reconcile checks.
- API responses support unified success envelope with backward-compatible top-level fields.
- Auth path removes `any` in core config and app route initialization.

## Acceptance Gates
- P0 gate command set:
  - `npm run test:guards`
  - `npm run test:unit:all`
  - `npm run test:integration:api`
  - `npm run test:integration:chain`
- No `any` remains in:
  - `src/lib/auth.ts`
  - `src/app/api/auth/[...nextauth]/route.ts`
- Critical silent-catch elimination is implemented in:
  - `src/lib/task/service.ts`
  - `src/app/api/sse/route.ts`
  - `src/lib/query/hooks/run-stream/recovered-run-subscription.ts`
  - `src/lib/api-errors.ts`

## SLO Probes (Phase 0)
- Task terminal consistency (DB vs SSE terminal event) >= 99.9%
- P0 async task completion rate (24h) >= 97%
- P0 API non-5xx availability >= 99.5%

## Implemented in This Iteration
- Added `apiSuccess(...)` helper in `src/lib/api-errors.ts`.
  - Envelope: `{ success, code, message, requestId, data }`
  - Backward compatibility: optional top-level flatten of object-like data.
- Applied success envelope on core task-facing APIs:
  - `src/lib/llm-observe/route-task.ts`
  - `src/app/api/tasks/route.ts`
  - `src/app/api/tasks/[taskId]/route.ts`
- Removed `any` usage from NextAuth critical path:
  - `src/lib/auth.ts`
  - `src/app/api/auth/[...nextauth]/route.ts`
- Replaced silent catch blocks with observable handling on critical path:
  - task reconcile check now logs and throws `RECONCILE_CHECK_FAILED` on verification failure
  - sse close/unsubscribe/parse errors now emit warning logs
  - run-stream replay failures now emit warning logs
  - route params resolve failure now emits warning logs

## Known Blockers
- Local environment may not have dependencies installed (`tsx` missing), which blocks guard/test execution.
- Baseline fix: run dependency bootstrap before declaring Phase 0 complete.
