# fold-x 项目架构文档

## 1. 项目定位

fold-x 是一款 **AI 驱动的短剧/漫画视频制作工具**，核心能力是将小说文本自动转化为完整视频。

当前唯一业务模式为 **novel-promotion（小说推文）**，完整链路为：

```
小说文本 → AI 分析 → 角色/场景提取 → 剧本生成 → 分镜生成 → 图片生成 → 视频合成 → 配音 → 成片
```

---

## 2. 技术栈

| 层级         | 技术                                                  |
| ------------ | ----------------------------------------------------- |
| 前端框架     | Next.js 15 (App Router) + React 19                    |
| 样式         | Tailwind CSS v4 + CSS 变量设计系统（Glass 玻璃拟态）  |
| 状态管理     | TanStack React Query + React Context + URL State      |
| 认证         | NextAuth.js (Credentials Provider, JWT Session)       |
| 数据库       | MySQL 8 + Prisma ORM                                  |
| 任务队列     | Redis 7 + BullMQ（4 队列）                            |
| 国际化       | next-intl (zh / en)                                   |
| 视频编辑     | Remotion                                              |
| AI 服务      | Vercel AI SDK, OpenAI, Google AI, OpenRouter, Fal.ai  |
| 测试         | Vitest                                                |
| 部署         | Docker Compose + Kubernetes                           |

---

## 3. 目录结构

```
src/
├── app/                              # Next.js App Router
│   ├── [locale]/                     # 国际化路由
│   │   ├── workspace/                # 工作区
│   │   │   ├── [projectId]/          # 项目详情（多阶段工作流）
│   │   │   │   └── modes/novel-promotion/  # 小说推文模式核心 UI
│   │   │   └── asset-hub/            # 全局资产中心
│   │   ├── auth/                     # 登录/注册
│   │   ├── profile/                  # 个人设置
│   │   └── admin/                    # 管理员页面
│   ├── api/                          # ~150 条 API 路由
│   └── m/[publicId]/                 # 公开分享页
│
├── components/                       # 共享 UI 组件
│   ├── ui/primitives/                # 设计系统原子组件（GlassButton 等）
│   ├── ui/patterns/                  # 业务级 UI 模式
│   ├── ui/icons/                     # 图标系统
│   ├── media/                        # 媒体展示组件
│   ├── task/                         # 任务状态展示
│   ├── voice/                        # 语音相关组件
│   └── llm-console/                  # LLM 调试控制台
│
├── features/video-editor/            # Remotion 视频编辑器
│
├── lib/                              # 核心业务逻辑
│   ├── task/                         # 任务系统（类型、队列、服务、提交）
│   ├── billing/                      # 计费系统（冻结、结算、账本）
│   ├── workers/                      # BullMQ Worker 入口与 Handler
│   ├── generators/                   # AI 生成器工厂（图片/视频/音频）
│   ├── novel-promotion/              # 小说推文业务逻辑
│   │   ├── story-to-script/          # 小说→剧本流程
│   │   └── script-to-storyboard/     # 剧本→分镜流程
│   ├── llm/                          # LLM 调用层
│   ├── llm-observe/                  # LLM 流式观察
│   ├── model-capabilities/           # 模型能力声明
│   ├── model-pricing/                # 模型定价
│   ├── media/                        # 媒体对象服务
│   ├── query/                        # React Query hooks
│   ├── voice/                        # 语音处理
│   ├── api/                          # API 辅助函数
│   ├── sse/                          # SSE 推送
│   └── errors/                       # 错误处理
│
├── types/                            # 全局类型定义
├── styles/                           # 设计系统 CSS
├── hooks/                            # 通用 React Hooks
├── contexts/                         # React Context
└── i18n/                             # 国际化配置

prisma/                               # 数据库 Schema
tests/                                # 测试（unit / integration / contracts）
scripts/                              # 运维与迁移脚本
messages/                             # 国际化文案（zh / en）
config/                               # 发布配置
deploy/                               # Kubernetes 部署文件
```

---

## 4. 系统架构

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                     浏览器 (React 19)                      │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 工作区   │  │ 资产中心   │  │ 视频编辑  │  │ 个人设置  │ │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴─────────────┴──────────────┘       │
│                          │ HTTP / SSE                      │
└──────────────────────────┼────────────────────────────────┘
                           │
┌──────────────────────────┼────────────────────────────────┐
│              Next.js API Routes (~150 条)                  │
│  ┌───────────────┐  ┌───────────┐  ┌───────────────────┐ │
│  │ NextAuth 认证  │  │ Prisma ORM │  │ 任务提交 (BullMQ) │ │
│  └───────────────┘  └─────┬─────┘  └─────────┬─────────┘ │
└───────────────────────────┼───────────────────┼───────────┘
                            │                   │
                    ┌───────┴───────┐   ┌───────┴──────────┐
                    │  MySQL 8      │   │  Redis 7         │
                    │  (持久化存储)  │   │  (队列 + 缓存)   │
                    └───────────────┘   └───────┬──────────┘
                                                │
                    ┌───────────────────────────┼───────────┐
                    │         BullMQ Workers                 │
                    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
                    │  │image │ │video │ │voice │ │ text │ │
                    │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ │
                    └─────┼────────┼────────┼────────┼──────┘
                          │        │        │        │
                    ┌─────┴────────┴────────┴────────┴──────┐
                    │           外部 AI 服务                  │
                    │  Google / FAL / Ark / Minimax / Vidu   │
                    │  OpenRouter / Qwen TTS                 │
                    └───────────────────────────────────────┘
```

### 4.2 前端路由结构

所有页面路由位于 `src/app/[locale]/` 下，通过 URL 参数 `?stage=` 驱动工作区阶段切换：

| 路由                              | 说明           |
| --------------------------------- | -------------- |
| `/`                               | 落地页         |
| `/workspace`                      | 项目列表       |
| `/workspace/[projectId]`          | 项目工作区     |
| `/workspace/asset-hub`            | 全局资产中心   |
| `/auth/signin`                    | 登录           |
| `/profile`                        | 个人设置       |
| `/admin/users`                    | 管理员用户管理 |

工作区阶段（`?stage=`）：

```
config → script/assets → storyboard → videos → voice → editor
配置      剧本/资产      分镜          视频     配音    编辑器
```

### 4.3 API 路由分组

| 分组                        | 路径前缀                               | 说明                           |
| --------------------------- | -------------------------------------- | ------------------------------ |
| novel-promotion             | `/api/novel-promotion/[projectId]/*`   | 分镜、角色、场景、语音、视频   |
| asset-hub                   | `/api/asset-hub/*`                     | 全局资产 CRUD 与 AI 设计       |
| projects                    | `/api/projects/*`                      | 项目 CRUD                      |
| tasks                       | `/api/tasks/*`                         | 任务查询与管理                 |
| user                        | `/api/user/*`                          | 余额、交易、API 配置           |
| auth                        | `/api/auth/*`                          | NextAuth 认证                  |
| admin                       | `/api/admin/users/*`, `audit-logs`     | 管理员操作、审计日志查询       |
| cg                          | `/api/cg/[projectId]/*`                | CG 模块（含 approve, assets/variations） |
| voice-presets               | `/api/voice-presets`                   | 系统语音预设查询               |
| sse                         | `/api/sse`                             | 任务状态 SSE 推送              |

---

## 5. 核心业务模块

### 5.1 小说推文工作流 (Novel Promotion)

这是系统唯一的业务模式，将小说文本端到端转化为短视频：

```
阶段 1: Config（配置）
  ├── 输入小说文本 / SRT / 音频
  └── 选择 AI 模型与画风

阶段 2: Script / Assets（剧本 + 资产）
  ├── AI 分析小说 → 提取角色、场景
  ├── AI 生成剧本 → 分割 Clip
  ├── 生成角色形象图片（支持多形象）
  └── 生成场景图片（支持多候选）

阶段 3: Storyboard（分镜）
  ├── AI 将剧本转为分镜（Panel）
  ├── 为每个 Panel 生成图片
  └── 支持重新生成、变体、AI 修改

阶段 4: Videos（视频）
  ├── 将分镜图片转为视频片段
  ├── 支持首尾帧模式
  └── 口型同步 (Lip Sync)

阶段 5: Voice（配音）
  ├── AI 语音设计（角色音色）
  └── 多角色语音合成 (TTS)

阶段 6: Editor（编辑器）
  └── Remotion 视频编辑与预览
```

### 5.2 任务系统

任务系统是异步处理的核心，基于 BullMQ 实现：

**4 个队列：**

| 队列名          | 处理内容                                           |
| --------------- | -------------------------------------------------- |
| `foldx-image`   | 分镜图片、角色图片、场景图片、资产图片             |
| `foldx-video`   | 分镜视频、口型同步                                 |
| `foldx-voice`   | 语音合成、语音设计                                 |
| `foldx-text`    | LLM 任务（分析、剧本生成、分镜生成、AI 修改等）   |

**任务生命周期：**

```
创建 → queued → processing → completed / failed
                    │
                    └── 可选: dismissed（用户取消）
```

**任务类型（约 35 种）：**

- 图片类: `image_panel`, `image_character`, `image_location`, `panel_variant`, `modify_asset_image`, `regenerate_group`, `asset_hub_image`, `asset_hub_modify`
- 视频类: `video_panel`, `lip_sync`
- 语音类: `voice_line`, `voice_design`, `asset_hub_voice_design`
- LLM 类: `analyze_novel`, `story_to_script_run`, `script_to_storyboard_run`, `clips_build`, `screenplay_convert`, `voice_analyze`, `analyze_global`, `ai_modify_appearance`, `ai_modify_location`, `ai_modify_shot_prompt`, `reference_to_character`, `character_profile_confirm` 等

**SSE 推送：** 任务状态通过 `/api/sse` 实时推送到前端，事件类型分为 `task.lifecycle`（生命周期）和 `task.stream`（流式数据）。

### 5.3 生成器工厂

`src/lib/generators/factory.ts` 提供了 AI 生成服务的抽象工厂：

| 生成器类型 | 支持的 Provider                                                |
| ---------- | -------------------------------------------------------------- |
| 图片       | Google (Gemini/Imagen), FAL, Ark (Seedream), Flow2Api, NewApi  |
| 视频       | FAL, Ark (Seedance), Google (Veo), Minimax, Vidu, Flow2Api, NewApi |
| 音频       | Qwen TTS                                                      |

所有生成器继承统一基类 `ImageGenerator` / `VideoGenerator` / `AudioGenerator`，通过 `createImageGenerator(provider)` 等工厂方法实例化。

### 5.4 计费系统

`src/lib/billing/` 实现了完整的计费链路：

```
报价 → 冻结余额 → 执行任务 → 结算扣费 / 回滚释放
```

**三种计费模式 (`BillingMode`)：**

| 模式      | 行为                              |
| --------- | --------------------------------- |
| `OFF`     | 不计费                            |
| `SHADOW`  | 仅记录 UsageCost，不冻结/扣费     |
| `ENFORCE` | 完整冻结→结算流程，余额不足则拒绝 |

**计费 API 类型：** `text`, `image`, `video`, `voice`, `voice-design`, `lip-sync`

### 5.5 资产中心

全局资产中心（Asset Hub）提供跨项目的资产复用能力：

- **全局角色** (`GlobalCharacter`): 可复用的角色形象
- **全局场景** (`GlobalLocation`): 可复用的场景图片
- **全局语音** (`GlobalVoice`): 语音预设
- **文件夹** (`GlobalAssetFolder`): 资产组织

资产可从全局中心导入到具体项目中使用。

---

## 6. 数据模型

### 6.1 核心实体关系

```
User
 ├── Project
 │    └── NovelPromotionProject
 │         ├── Character → CharacterAppearance[]（多形象）
 │         ├── Location → LocationImage[]（多图片）
 │         ├── Episode（剧集）
 │         │    ├── Clip（片段）
 │         │    ├── Storyboard → Panel[]（分镜）
 │         │    ├── VoiceLine（语音行）
 │         │    └── Shot（镜头，SRT 模式）
 │         └── VoicePreset（语音预设）
 ├── UserBalance
 │    ├── BalanceFreeze（冻结记录）
 │    └── BalanceTransaction（交易流水）
 └── Task → TaskEvent[]（任务事件）

全局资产:
 GlobalAssetFolder
  ├── GlobalCharacter
  ├── GlobalLocation
  └── GlobalVoice

媒体:
 MediaObject（统一媒体存储引用 → 腾讯云 COS）
```

### 6.2 关键模型字段

**Project**: 项目基础信息 + 模式关联

**NovelPromotionProject**: 小说推文配置（模型选择、画风、工作流模式 srt/agent）

**Panel**: 分镜最小单元，包含图片 prompt、生成图片、视频、候选图片、摄影规则等

**Task**: 异步任务记录，关联 `targetType` + `targetId` 指向业务实体

---

## 7. 认证与权限

- **认证方式**: NextAuth Credentials Provider（用户名 + 密码 + bcrypt）
- **Session**: JWT 模式
- **权限层级**:
  - `requireAuth()`: 要求登录
  - `requireUserAuth()`: 用户级校验
  - `requireProjectAuth(projectId)`: 项目归属校验
  - `requireProjectAccess(projectId)`: owner 或 ProjectMember 均可访问
  - 管理员通过 `ADMIN_USERNAME` / `ADMIN_USERNAMES` 环境变量配置
- **内部调用**: Worker 通过 `x-internal-task-token` + `x-internal-user-id` Header 认证
- **注册**: 当前已关闭公开注册（返回 FORBIDDEN）

---

## 8. 运行架构

开发环境通过 `concurrently` 同时启动 4 个进程：

| 进程       | 端口   | 说明                     |
| ---------- | ------ | ------------------------ |
| Next.js    | 8901   | Web 应用                 |
| Worker     | -      | BullMQ 任务消费          |
| Watchdog   | -      | 进程与任务健康监控       |
| Bull Board | 3010   | 任务队列管理面板         |

Docker 部署通过 `docker-compose.yml` 编排 MySQL、Redis、应用容器，默认端口 13000。

生产环境支持 Kubernetes 部署（`deploy/k8s/`）。

---

## 9. 设计系统

采用 **玻璃拟态（Glassmorphism）** 视觉风格：

| CSS 文件                      | 作用                               |
| ----------------------------- | ---------------------------------- |
| `ui-tokens-glass.css`         | 设计 Token（颜色、阴影、圆角等）   |
| `ui-semantic-glass.css`       | 语义类（`.glass-page`, `.glass-surface` 等）|
| `motion-tokens.css`           | 动画 Token                         |
| `animations.css`              | 关键帧动画                         |

组件层级：

- **Primitives**: `GlassButton`, `GlassInput`, `GlassSurface` 等原子组件
- **Patterns**: `StoryboardHeaderV2`, `PanelCardV2` 等业务组合组件
- **Icons**: `AppIcon` 统一图标组件

---

## 10. 测试策略

| 测试类型 | 位置                     | 说明                             |
| -------- | ------------------------ | -------------------------------- |
| 单元测试 | `tests/unit/`            | Worker、Billing、Task 等核心逻辑 |
| 集成测试 | `tests/integration/`     | API 路由、计费链路               |
| 契约测试 | `tests/contracts/`       | 路由目录、任务类型目录           |
| 回归测试 | `npm run test:regression`| 功能验收标准                     |

覆盖率要求: billing 相关模块阈值 80%。

验收标准: 所有功能变更必须通过 `npm run test:regression`。
