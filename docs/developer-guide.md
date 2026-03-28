# fold-x 开发者指南

## 1. 环境准备

### 1.1 系统要求

- Node.js >= 18.18.0
- npm >= 9.0.0
- MySQL 8.0
- Redis 7

### 1.2 快速启动（Docker 模式）

```bash
git clone https://github.com/saturndec/foldx.git
cd foldx
docker compose up -d
```

服务启动后：
- 应用: http://localhost:13000
- Bull Board: http://localhost:13010/admin/queues
- MySQL: localhost:13306
- Redis: localhost:16379

### 1.3 本地开发模式

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量配置
cp .env.example .env
# 编辑 .env，配置 DATABASE_URL、Redis 等

# 3. 初始化数据库
npx prisma db push

# 4. 启动开发环境（同时启动 4 个进程）
npm run dev
```

开发模式启动的进程：

| 进程       | 命令              | 端口 | 说明                 |
| ---------- | ----------------- | ---- | -------------------- |
| Next.js    | `npm run dev:next` | 8901 | Web 应用（Turbopack）|
| Worker     | `npm run dev:worker` | -  | BullMQ 任务消费      |
| Watchdog   | `npm run dev:watchdog` | - | 任务健康监控         |
| Bull Board | `npm run dev:board` | 3010 | 队列管理面板        |

---

## 2. 环境变量

完整配置参见 `.env.example`，关键变量：

### 数据库与存储

| 变量             | 说明                                    | 默认值                                      |
| ---------------- | --------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`   | MySQL 连接字符串                        | `mysql://root:foldx123@localhost:3306/foldx` |
| `STORAGE_TYPE`   | 存储类型 (`local` / `cos`)              | `local`                                     |
| `COS_SECRET_ID`  | 腾讯云 COS 密钥（`cos` 模式需要）      | -                                           |

### 认证

| 变量              | 说明                     |
| ----------------- | ------------------------ |
| `NEXTAUTH_URL`    | NextAuth 基础 URL        |
| `NEXTAUTH_SECRET` | JWT 签名密钥             |
| `ADMIN_USERNAME`  | 管理员用户名             |
| `ADMIN_PASSWORD`  | 管理员密码（>= 8 位）    |
| `ADMIN_USERNAMES` | 管理员白名单（逗号分隔） |

### Redis

| 变量             | 说明          |
| ---------------- | ------------- |
| `REDIS_HOST`     | Redis 地址    |
| `REDIS_PORT`     | Redis 端口    |
| `REDIS_PASSWORD` | Redis 密码    |

### Worker

| 变量                        | 说明                 | 默认值 |
| --------------------------- | -------------------- | ------ |
| `WATCHDOG_INTERVAL_MS`      | Watchdog 巡检间隔    | 30000  |
| `TASK_HEARTBEAT_TIMEOUT_MS` | 任务心跳超时         | 90000  |
| `QUEUE_CONCURRENCY_IMAGE`   | 图片队列并发数       | 50     |
| `QUEUE_CONCURRENCY_VIDEO`   | 视频队列并发数       | 50     |
| `QUEUE_CONCURRENCY_VOICE`   | 语音队列并发数       | 20     |
| `QUEUE_CONCURRENCY_TEXT`    | 文本队列并发数       | 50     |

### 计费与日志

| 变量           | 说明                                    | 默认值    |
| -------------- | --------------------------------------- | --------- |
| `BILLING_MODE` | 计费模式 (`OFF` / `SHADOW` / `ENFORCE`) | `ENFORCE` |
| `LOG_LEVEL`    | 日志级别                                | `ERROR`   |

---

## 3. 常用命令

### 3.1 开发

```bash
npm run dev              # 启动完整开发环境
npm run dev:next         # 仅启动 Next.js
npm run dev:worker       # 仅启动 Worker
npm run build            # 构建生产版本
npm run start            # 启动生产环境
```

### 3.2 数据库

```bash
npx prisma db push       # 同步 Schema 到数据库
npx prisma generate      # 生成 Prisma Client
npx prisma studio        # 启动数据库可视化面板
```

### 3.3 测试

```bash
# 完整回归测试（功能验收标准）
npm run test:regression

# PR 提交前测试
npm run test:pr

# 按模块测试
npm run test:unit:all              # 所有单元测试
npm run test:billing               # 计费模块测试（含覆盖率）
npm run test:integration:api       # API 集成测试
npm run test:integration:chain     # 链路集成测试

# 行为测试
npm run test:behavior:full         # 完整行为测试

# Guard 检查
npm run test:guards                # API Handler + 覆盖率 Guard
```

### 3.4 代码质量

```bash
npm run lint                            # ESLint 检查
npm run check:api-handler               # API Handler 规范检查
npm run check:logs                      # Console 日志检查
npm run check:config-center-guards      # 模型配置 Guard
npm run check:test-coverage-guards      # 测试覆盖率 Guard
npm run check:file-line-count           # 文件行数限制检查
```

### 3.5 运维

```bash
npm run stats:errors                            # 任务错误统计
npm run ops:observability:snapshot              # 可观测性快照
npm run billing:cleanup-pending-freezes         # 清理挂起的冻结
npm run billing:reconcile-ledger                # 账本对账
npm run migrate:audit-relational-integrity      # 关系完整性审计
```

---

## 4. 项目约定

### 4.1 代码规范

- **禁止 `any` 类型**，必须明确类型定义
- 大文件必须按职责拆分为清晰模块
- 公共能力抽离为可复用模块
- 命名体现职责，目录结构支持快速定位

### 4.2 错误处理

- **显式失败原则**：所有非预期行为必须原地崩溃并如实上报
- 禁止静默跳过错误、隐式配置兜底、自动模型降级
- 禁止提供默认回退值掩盖问题
- 禁止制造假数据

### 4.3 测试要求

- 新增/修改功能必须附带测试
- 修 bug 必须新增回归测试
- 断言必须检查具体值（DB 写入字段值、函数入参、返回值）
- 禁止 `toHaveBeenCalled()` 作为唯一主断言
- 禁止"自给自答"式 mock（mock 返回 X 再断言 X）
- `it()` 命名格式: `[条件] -> [预期结果]`
- 未通过 `npm run test:regression` 不得宣称功能完成

### 4.4 Git 规范

- 只读 Git 操作无需授权: `status`, `log`, `diff`, `show`, `branch`
- 任何修改 Git 状态的操作必须先获得确认: `commit`, `push`, `pull`, `merge`, `rebase` 等
- 高风险数据操作（删除/覆盖/结构变更）必须先获得用户确认

---

## 5. 关键文件索引

### 5.1 核心业务

| 文件                                              | 说明                   |
| ------------------------------------------------- | ---------------------- |
| `src/types/project.ts`                            | 项目与资产类型定义     |
| `src/lib/modes.ts`                                | 业务模式配置           |
| `src/lib/task/types.ts`                           | 任务类型与状态定义     |
| `src/lib/task/service.ts`                         | 任务服务（生命周期）   |
| `src/lib/task/queues.ts`                          | BullMQ 队列定义        |
| `src/lib/task/submitter.ts`                       | 任务提交入口           |
| `src/lib/generators/factory.ts`                   | AI 生成器工厂          |
| `src/lib/billing/service.ts`                      | 计费服务               |
| `src/lib/novel-promotion/story-to-script/`        | 小说→剧本编排          |

### 5.2 Worker 处理

| 文件                                              | 说明                   |
| ------------------------------------------------- | ---------------------- |
| `src/lib/workers/index.ts`                        | Worker 入口            |
| `src/lib/workers/image.worker.ts`                 | 图片 Worker            |
| `src/lib/workers/video.worker.ts`                 | 视频 Worker            |
| `src/lib/workers/voice.worker.ts`                 | 语音 Worker            |
| `src/lib/workers/text.worker.ts`                  | 文本/LLM Worker        |
| `src/lib/workers/handlers/`                       | 各任务类型 Handler     |

### 5.3 前端核心

| 文件                                                         | 说明                |
| ------------------------------------------------------------ | ------------------- |
| `src/app/[locale]/layout.tsx`                                | 根布局              |
| `src/app/[locale]/workspace/[projectId]/page.tsx`            | 项目工作区入口      |
| `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/` | 小说推文 UI    |
| `src/lib/query/keys.ts`                                     | React Query Keys    |
| `src/components/ui/primitives/`                              | 设计系统原子组件    |

### 5.4 配置与基础设施

| 文件                          | 说明              |
| ----------------------------- | ----------------- |
| `prisma/schema.prisma`        | 数据库 Schema     |
| `src/lib/auth.ts`             | NextAuth 配置     |
| `src/lib/api-auth.ts`        | API 权限校验      |
| `src/lib/prisma.ts`           | Prisma 客户端     |
| `src/lib/redis.ts`            | Redis 连接        |
| `src/lib/api-config.ts`       | API 密钥配置      |
| `src/lib/model-config-contract.ts` | 模型能力契约 |

### 5.5 测试

| 文件                           | 说明                |
| ------------------------------ | ------------------- |
| `tests/unit/`                  | 单元测试            |
| `tests/integration/`          | 集成测试            |
| `tests/contracts/`            | 契约测试            |
| `tests/contracts/route-catalog.ts` | 路由目录       |
| `tests/contracts/task-type-catalog.ts` | 任务类型目录 |

---

## 6. 新增功能开发流程

### 6.1 新增任务类型

1. 在 `src/lib/task/types.ts` 的 `TASK_TYPE` 中添加类型
2. 在 `src/lib/task/queues.ts` 中将类型分配到对应队列
3. 在对应 Worker 中添加 Handler（`src/lib/workers/handlers/`）
4. 在 Worker 入口注册 Handler（如 `image.worker.ts`）
5. 创建 API 路由提交任务
6. 更新 `tests/contracts/task-type-catalog.ts`
7. 编写行为测试
8. 运行 `npm run test:regression` 验证

### 6.2 新增 API 路由

1. 在 `src/app/api/` 下创建 `route.ts`
2. 使用 `requireAuth()` / `requireProjectAuth()` 进行权限校验
3. 更新 `tests/contracts/route-catalog.ts`
4. 编写集成测试
5. 运行 `npm run check:api-handler` 验证规范
6. 运行 `npm run test:regression` 验证

### 6.3 新增 AI Provider

1. 在 `src/lib/generators/` 下创建 Generator 实现类
2. 继承 `ImageGenerator` / `VideoGenerator` / `AudioGenerator` 基类
3. 在 `src/lib/generators/factory.ts` 中注册
4. 在 `src/lib/model-capabilities/` 中声明能力
5. 在 `src/lib/model-pricing/` 中配置定价
6. 编写测试

---

## 7. 调试技巧

### 7.1 Bull Board

开发模式下访问 http://localhost:3010/admin/queues 查看队列状态、任务详情、失败原因。

### 7.2 Prisma Studio

```bash
npx prisma studio
```

启动可视化数据库面板，方便查看和编辑数据。

### 7.3 任务错误统计

```bash
npm run stats:errors
```

查看各类型任务的错误分布。

### 7.4 日志

设置 `LOG_LEVEL=DEBUG` 和 `LOG_DEBUG_ENABLED=true` 开启详细日志。

日志通过 `createScopedLogger({ module: 'xxx' })` 创建，自动附加模块上下文。

### 7.5 SSE 调试

前端通过 `/api/sse` 接收任务状态推送。可在浏览器 DevTools 的 Network 面板中筛选 `EventStream` 类型查看实时事件。
