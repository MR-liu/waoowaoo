# NEXUS-X 项目当前状态（供后续开发对话参考）

> 更新时间：2026-03-03

## 一、项目定位

从 fold-x（小说推文工具）转型为 NEXUS-X（CG/VFX 生产管理系统 + 小说推文双模式）。

## 二、已完成的架构变更

### 2.1 角色体系

- User.systemRole: admin / producer / director / supervisor / coordinator / artist
- ProjectMember.role: producer / director / supervisor / coordinator / artist / client / vendor
- RBAC 权限引擎: `src/lib/rbac.ts` — `getViewConfigForRole()` 返回每个角色的可见模块
- RBAC API 中间件: `src/lib/api-rbac.ts` — `auditAndCheck()` 在 9 个 CG 写 API 中已接入

### 2.2 IM 项目级展示

- IM 面板在项目工作区内展示（非全局跨页），由 `AppShell` 从 URL 路径解析 `projectId`，仅在项目工作区时挂载
- 支持: 私信 / 项目群 / 消息发送与拉取 / 成员管理

### 2.3 双模式项目

- Project.projectType: 'cg' | 'novel-promotion'
- 创建项目时选择类型，CG 项目自动创建 5 个默认 Pipeline Step
- page.tsx 根据 projectType 路由到不同工作区

### 2.4 CG 模块（NEXUS-X 核心）

数据模型（16 个新 Prisma 模型）:
- Sequence, CgShot, CgAsset, AssetVariation
- PipelineStep, ProductionTask, TaskDependency
- CgVersion, CgPublish, PublishDependency, CgNote
- Playlist, PlaylistItem, NamingTemplate, EventTrigger
- AuditLog

API 路由（17 个）:
- /api/cg/[projectId]/sequences, shots, assets, pipeline-steps
- /api/cg/[projectId]/production-tasks, versions, notes
- /api/cg/[projectId]/playlists, playlists/[id]/items
- /api/cg/[projectId]/gantt, vfs, filebox, ayon
- /api/cg/[projectId]/ai/breakdown, ai/schedule, search, dashboard
- /api/cg/[projectId]/approve

前端:
- CgWorkspace (Spreadsheet 三标签页: Shots/Assets/Tasks)
- CgDashboard (BI 仪表盘)
- SpreadsheetView (自研虚拟滚动表格)
- GanttChart (依赖引擎 + 幽灵条)

### 2.5 审片系统

- WebPlayer.tsx — 专业播放器 + 水印
- AnnotationCanvas.tsx — Canvas 标注 (pen/arrow/rect)
- VersionCompare.tsx — 三种对比模式
- GhostAnnotation.tsx — 幽灵标注叠加
- PlaylistManager.tsx — 审片播放列表
- 审批工作流: approve/reject/request_changes (`src/lib/approval/engine.ts`)

### 2.6 AI 智能

- 剧本拆解: `src/lib/ai/script-breakdown.ts`
- 生成式排期: `src/lib/ai/scheduling-engine.ts`
- 语义搜索: `src/lib/ai/semantic-search.ts`

### 2.7 安全

- 审计日志: `src/lib/audit.ts` + AuditLog 模型（已在 CG 写 API 中调用）
- 数字水印: `src/components/Watermark.tsx`（已在 WebPlayer 中集成）
- 会话管理: `src/lib/security/session-manager.ts`
- TPN 合规报告: `src/lib/security/tpn-compliance.ts`

### 2.8 审计日志查询

- `GET /api/admin/audit-logs` — 管理员查询审计日志（admin only）

## 三、视频编辑器（当前状态 + 待完成）

### 3.1 已完成

文件位置: `src/features/video-editor/`

**类型系统** (`types/editor.types.ts`):
- VideoClip 支持: speed, reversed, frozen, volume, crop, trim, transition, attachment
- 多轨道: timeline (VideoClip[]) + bgmTrack (BgmClip[])

**状态管理** (`hooks/useEditorState.ts`):
- 撤销/重做历史栈 (50步)
- 分割 splitAtPlayhead() — 在播放头位置将片段一分为二
- 复制/粘贴 copyClip()/pasteClip()
- 变速 setClipSpeed() — 0.1x-10x
- 定格 freezeFrame()
- 倒放 toggleReverse()
- 裁切 trimClipStart()/trimClipEnd()

**主界面** (`components/VideoEditorStage.tsx`):
- 剪映风格深色主题布局（顶部菜单 / 左素材面板 / 中预览 / 右属性 / 工具栏 / 时间线）
- 键盘快捷键: Ctrl+B(分割) / Ctrl+Z(撤销) / Ctrl+Y(重做) / Ctrl+C(复制) / Ctrl+V(粘贴) / Delete / 空格 / 方向键
- 属性面板: 变速滑块、倒放、定格按钮

### 3.2 待完成（下一个对话的重点）

**Timeline.tsx 需要完全重写**，当前是简陋原型：

需要实现:
1. 时间刻度尺 — 精确到帧的标尺，随缩放变化
2. 片段缩略图 — 在时间线上显示视频帧截图（而非序号）
3. 裁切手柄 — 片段左右边缘可拖拽调整入出点
4. 轨道控制面板 — 每轨左侧: 类型图标 + 锁定/隐藏/静音按钮
5. 字幕轨道 — 显示字幕文本块
6. 特效轨道 — 显示特效区间
7. 音频波形 — 配音轨显示简化波形
8. 分割可视化 — 分割操作在时间线上即时反映
9. 变速可视化 — 变速片段显示速度标签
10. 播放头精确定位 — 可点击刻度尺跳转

现有 Timeline.tsx 位置: `src/features/video-editor/components/Timeline/Timeline.tsx`
使用 @dnd-kit 实现拖拽排序（保留）

## 四、Novel-promotion 模块（原 fold-x 功能）

完整工作流: config → script → storyboard → videos → voice → editor → kanban → dashboard
全部阶段已在 CapsuleNav 和 WorkspaceStageContent 中注册
EditorStageRoute 已打通（不再被重定向到 videos）

## 五、文件结构

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx              — 集成 AppShell(项目级 IM)
│   │   ├── providers.tsx           — Session/Query/Toast/ErrorBoundary
│   │   └── workspace/
│   │       ├── page.tsx            — 项目列表（制片人/导演/艺术家视图）
│   │       ├── components/         — ProducerDashboard, DirectorReviewQueue, ArtistTaskList
│   │       └── [projectId]/
│   │           ├── page.tsx        — 根据 projectType 路由 CG/NP 工作区
│   │           └── modes/
│   │               ├── cg/         — CgWorkspace, CgDashboard
│   │               └── novel-promotion/  — NovelPromotionWorkspace + 8 阶段
│   └── api/
│       ├── admin/audit-logs/       — 审计日志查询
│       ├── voice-presets/          — 系统语音预设查询
│       ├── cg/[projectId]/         — CG API（含 approve, assets/variations）
│       ├── projects/[projectId]/   — share, chat, members
│       └── user/dashboard/         — 角色驱动仪表盘数据
├── components/
│   ├── im/                         — IMPanel, IMChatView, IMMessageInput, IMMemberList
│   ├── layout/AppShell.tsx         — 项目级 IM 布局壳（从 URL 解析 projectId）
│   ├── review/                     — WebPlayer, AnnotationCanvas, VersionCompare, GhostAnnotation
│   ├── spreadsheet/                — SpreadsheetView
│   ├── gantt/                      — GanttChart
│   ├── filebox/                    — FileBox
│   ├── Watermark.tsx
│   └── ErrorBoundary.tsx
├── features/video-editor/          — 视频编辑器（Timeline 待重写）
├── lib/
│   ├── rbac.ts                     — 角色权限
│   ├── api-rbac.ts                 — API RBAC 中间件
│   ├── audit.ts                    — 审计日志
│   ├── approval/engine.ts          — 审批工作流
│   ├── vfs/                        — VFS 路径引擎
│   ├── ayon/                       — AYON 桥接
│   ├── gantt/                      — 依赖引擎
│   ├── ai/                         — 剧本拆解/排期/搜索
│   └── security/                   — 会话/TPN合规
├── desktop/                        — Tauri 桌面端骨架
└── mobile/                         — Flutter 移动端骨架
```

## 六、待实现功能 (Planned)

- **CgPublish** — 发布工作流（从审批到发布的完整链路）
- **EventTrigger** — 自动化触发引擎（事件驱动的条件-动作执行）
- **LegacyMediaRefBackup** — 为迁移工具遗留，不做修改

## 七、数据与权限说明

- `Project.mode` 已统一为 `Project.projectType`，`mode` 字段已移除
- `requireProjectAccess(projectId)` — owner 或 ProjectMember 均可访问
