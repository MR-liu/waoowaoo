# 视频生成系统说明

## 1. 文档目标

本文档描述当前项目中“视频生成”能力的实际实现方式，覆盖以下范围：

1. 前端触发与参数组织
2. API 参数清洗、能力校验与任务提交
3. 队列路由与 Worker 执行
4. 视频供应商调用与异步轮询
5. 数据落库与失败重试机制
6. 首尾帧模式与口型同步（Lip Sync）分支

## 2. 系统边界与核心对象

1. 视频生成主任务类型：`TASK_TYPE.VIDEO_PANEL`
2. 口型同步任务类型：`TASK_TYPE.LIP_SYNC`
3. 队列：`foldx-video`（BullMQ）
4. 核心实体：`NovelPromotionPanel`、`NovelPromotionVoiceLine`、`Task`

## 3. 端到端主链路

### 3.1 前端触发

前端在 Video Stage 中触发单个或批量视频生成：

1. 单个：传 `storyboardId + panelIndex + videoModel`，可选 `generationOptions`、`firstLastFrame`
2. 批量：传 `all=true + episodeId + videoModel`，可选 `generationOptions`

相关入口：

1. `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/hooks/useWorkspaceVideoActions.ts`
2. `src/lib/query/hooks/useStoryboards.ts`

### 3.2 API 层（`/generate-video`）

API 路由会进行严格处理：

1. 先构建 `taskPayload`（trim 字符串、过滤无关字段、标准化结构）
2. 强制校验 `videoModel`
3. 若有 `firstLastFrame`，校验 `flModel` 且必须支持 `firstlastframe`
4. 根据模型能力与定价配置校验 `generationOptions` 组合是否合法
5. 生成任务账单信息（不可识别组合会显式失败）
6. 单个模式：按 `storyboardId + panelIndex` 找 panel，提交 1 个任务
7. 批量模式：筛选当前剧集中有图且无视频的 panel，逐个提交任务

关键行为：

1. 去重键：`video_panel:${panel.id}`
2. 提交任务类型：`TASK_TYPE.VIDEO_PANEL`
3. 目标类型：`NovelPromotionPanel`

相关入口：

1. `src/app/api/novel-promotion/[projectId]/generate-video/route.ts`
2. `src/lib/task/submitter.ts`

### 3.3 任务提交与队列路由

`submitTask` 负责：

1. 规范化 payload（补 flow 元信息）
2. 创建任务记录（含 dedupe 逻辑）
3. 计费冻结（若为计费任务）
4. 发布任务创建事件
5. 根据任务类型路由队列并入队

队列路由规则中，`VIDEO_PANEL` 和 `LIP_SYNC` 都走 video 队列。

相关入口：

1. `src/lib/task/submitter.ts`
2. `src/lib/task/queues.ts`
3. `src/lib/task/service.ts`

### 3.4 Video Worker 执行（`video.worker.ts`）

Worker 启动后处理两类任务：

1. `VIDEO_PANEL`
2. `LIP_SYNC`

#### A. `VIDEO_PANEL` 处理流程

1. 校验 `payload.videoModel` 必填
2. 严格按 `targetType=NovelPromotionPanel + targetId` 定位 panel
3. 校验 payload 中 `storyboardId/panelIndex`（若提供）必须与 target panel 一致
4. 生成 prompt，优先级如下：
   1) `firstLastFrame.customPrompt`
   2) `panel.firstLastFramePrompt`
   3) `payload.customPrompt`
   4) `panel.videoPrompt`
   5) `panel.description`
5. 将首帧图转为可生成输入（base64）
6. 如果是首尾帧模式，尝试读取尾帧 panel 图片并转 base64
7. 调用 `resolveVideoSourceFromGeneration` 发起生成
8. 上传结果到 COS
9. 回写 `panel.videoUrl` 与 `panel.videoGenerationMode`

#### B. `LIP_SYNC` 处理流程

1. 严格按 `targetId` 定位 panel，要求存在基础视频 `panel.videoUrl`
2. 校验 `voiceLineId` 并读取语音文件 `audioUrl`
3. 对视频和音频生成签名 URL
4. 调用 `resolveLipSyncVideoSource`
5. 上传结果到 COS
6. 回写 `panel.lipSyncVideoUrl`，并清空 `lipSyncTaskId`

相关入口：

1. `src/lib/workers/video.worker.ts`
2. `src/lib/workers/shared.ts`

### 3.5 供应商调用与异步轮询

`worker/utils.ts` 统一封装视频调用逻辑：

1. `resolveVideoSourceFromGeneration`：
   1) 先检查任务是否已有 externalId（支持重启续跑）
   2) 按模型能力解析最终 generation options
   3) 调 `generateVideo` 统一入口
   4) 若同步返回视频地址，直接使用
   5) 若异步返回 externalId，进入轮询直到完成或失败
2. `resolveLipSyncVideoSource`：
   1) 先检查 externalId 续跑
   2) 提交 lip-sync 请求
   3) 轮询外部任务

统一生成入口 `generateVideo` 会先解析 `modelKey -> provider/modelId`，再通过工厂分派到具体供应商实现（fal/ark/google/minimax/vidu 等）。

相关入口：

1. `src/lib/workers/utils.ts`
2. `src/lib/generator-api.ts`
3. `src/lib/generators/factory.ts`

## 4. 首尾帧模式（First/Last Frame）

首尾帧属于视频生成的一个模式，不是独立任务类型：

1. 前端只在支持 `firstlastframe` 能力的模型中开放该模式
2. 提交时放入 `firstLastFrame` 对象（含 `flModel`、尾帧定位、可选 `customPrompt`）
3. API 校验 `flModel` 能力合法性
4. Worker 按 `generationMode='firstlastframe'` 组装参数，并可带 `lastFrameImageUrl`
5. 最终仍回写普通视频字段 `videoUrl`，并标记 `videoGenerationMode`

相关入口：

1. `src/lib/novel-promotion/stages/video-stage-runtime/useVideoFirstLastFrameFlow.ts`
2. `src/app/api/novel-promotion/[projectId]/generate-video/route.ts`
3. `src/lib/workers/video.worker.ts`

## 5. 任务状态与错误处理

任务生命周期由 `withTaskLifecycle` 统一管理：

1. 进入 processing
2. 持续上报进度与阶段
3. 成功则 completed 并结算账单
4. 失败则 failed 并回滚账单
5. 可重试错误会按队列策略重试并发出 retry 进度事件

视频任务的典型显式失败场景：

1. `videoModel` 缺失
2. 首尾帧模型不支持该能力
3. payload 与 target panel 不一致
4. panel 缺图、缺 prompt 或输入 URL 无效
5. 外部任务失败或超时

相关入口：

1. `src/lib/workers/shared.ts`
2. `src/lib/task/service.ts`
3. `src/lib/task/queues.ts`

## 6. 关键数据字段

与 panel 相关的主要视频字段：

1. `videoUrl`：基础生成视频 COS 地址
2. `videoGenerationMode`：`normal | firstlastframe`
3. `lipSyncVideoUrl`：口型同步后的视频 COS 地址
4. `firstLastFramePrompt`：首尾帧模式可复用提示词

## 7. 当前实现特征总结

1. 统一任务系统：视频与口型同步都走 Task + Queue + Worker 模式
2. 强校验策略：模型能力、参数组合、target 一致性均显式校验
3. 显式失败策略：不做静默兜底，不做隐式降级
4. 异步可恢复：externalId 持久化后可在服务重启后续跑，避免重复提交外部任务
5. 可扩展：供应商接入通过 generator factory 统一扩展

## 8. 导演视角优化建议（集成版）

> 日期：2026-02-27  
> 目标：在保持当前“强 prompt + 强任务系统”优势的前提下，补齐短剧/动漫生产中的工业化短板。

### 8.1 评估结论（先说结论）

1. 已具备优势：
   1) 镜头语言与分镜提示词体系较完整（景别/运镜/对话镜头约束/连续性规则）。
   2) 视频生成、首尾帧、口型同步都已进入统一任务流水线，可追踪、可计费、可重试。
2. 主要缺口：
   1) 跨镜头角色一致性仍偏弱（缺少显式“角色记忆”机制）。
   2) 动漫专项关键帧补间能力未形成产品化流程。
   3) 口型同步只有“生成”能力，缺“质量评估门控”。
   4) 音频后期只有基础混音参数，缺“出厂标准”。
   5) 缺少统一“出厂前质检门”（QC Gate）。

### 8.2 缺口矩阵（技巧 -> 现状 -> 缺口 -> 落地）

| 导演视角能力 | 当前现状 | 缺口判断 | 最小落地路径 |
| --- | --- | --- | --- |
| 跨镜头角色一致性（身份锁定） | 当前视频主链路按 panel 生成，输入是首帧图 + 可选尾帧图；尚无跨 shot 的角色记忆库 | 部分具备 | **P0**：新增 `character_consistency_pack`（角色锚点图 + 不可变特征 + 禁忌漂移词），每个镜头生成时强制注入；生成后做角色一致性打分，低于阈值显式失败 |
| 动作/镜头连续性（跨 shot 时序） | Prompt 里已有“连续性规则”，但执行层缺自动连续性检查 | 部分具备 | **P0**：新增 `continuity_check`（构图变化率、运动方向一致性、视线轴线规则）；不达标进入“明确可见的重生成队列” |
| 动漫关键帧补间（inbetweening） | 支持 I2V 与 first/last frame；未支持“多关键帧 -> 中间帧”生产链路 | 未具备 | **P1**：增加 `keyframe_pack` 输入（pose/表情/构图关键帧序列）和补间任务类型，优先用于动作场景与情绪爆点 |
| 口型同步质量门控（不仅生成） | 已有 `LIP_SYNC` 任务并落库，但没有自动质量评分与阈值策略 | 部分具备 | **P0**：引入 lip-sync 质量分（如同步置信度/人脸稳定度）；评分未达标时任务状态直接 `failed` 并带结构化错误码 |
| 音频出厂标准（对白/BGM） | 仅有音量、淡入淡出、轨道叠加，缺响度标准化与 ducking | 未具备 | **P0**：新增音频母版处理：对白优先 ducking、LUFS 归一、峰值限制；未达标准不允许导出 |
| 统一出厂 QC Gate | 当前“生成成功即可入库/导出”为主 | 未具备 | **P0**：在导出前新增 `qc_gate` 阶段（画面连续性、声画同步、音频规范），全部通过后才允许最终导出 |

### 8.3 优先级路线图（P0 / P1 / P2）

1. **P0（1-2 周）**：先补“质量门”
   1) `lip-sync` 质量评估与显式失败。
   2) 音频响度与 ducking 的出厂标准。
   3) 连续性检查器（基础版）与 QC Gate 接口。
2. **P1（2-4 周）**：补“动漫与一致性核心能力”
   1) 角色一致性记忆包（跨镜头）。
   2) 多关键帧补间任务链路（动漫专项）。
3. **P2（4-8 周）**：补“自动化优化闭环”
   1) 基于失败类型的可解释重生成策略。
   2) 建立“片段级 -> 全片级”质量报表与导演复核面板。

### 8.4 与现有系统的衔接原则

1. 不引入隐式兜底：所有质量不达标都以结构化错误显式失败，不静默降级。
2. 不破坏现有任务主链路：新增能力优先做成可插拔阶段（pre-QC / post-QC）。
3. 不做“黑盒自动修正”：任何自动重生成都要可见、可审计、可追溯。

### 8.5 外部方法依据（用于后续技术选型）

1. 视频提示与镜头控制：
   1) Google Veo Prompt Guide  
      https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide
   2) Google Veo Image/Style Reference  
      https://cloud.google.com/vertex-ai/generative-ai/docs/video/image-style-reference
   3) OpenAI Sora Prompting Guide  
      https://help.openai.com/en/articles/9957612-generating-videos-on-sora
2. 跨镜头一致性与记忆机制：
   1) StoryMem (2025)  
      https://arxiv.org/abs/2512.11280
3. 动漫关键帧/补间：
   1) ToonCrafter (2024)  
      https://arxiv.org/abs/2405.17933
   2) Animate Anything (2024)  
      https://arxiv.org/abs/2403.18975
4. 口型同步质量评估与基线：
   1) Wav2Lip (2020)  
      https://arxiv.org/abs/2008.10010
5. 音频出厂标准：
   1) EBU R128  
      https://tech.ebu.ch/publications/r128
   2) ITU-R BS.1770  
      https://www.itu.int/rec/R-REC-BS.1770
6. 工业流程参考：
   1) USD in Animated Feature Pipeline (Pixar)  
      https://graphics.pixar.com/usd/docs/USD-in-the-Animated-Feature-Production-Pipeline.html

### 8.6 补充确认（本轮新增并显式固化）

以下四项已作为强约束补充到本方案中，后续实现必须按此执行：

1. 建立“导演圣经”层：
   1) 在分镜 prompt 之上新增统一约束层，固定风格规则、角色表演规则、镜头节奏规则。
   2) 任何单镜头 prompt 只能在“导演圣经”允许范围内展开，不可越界漂移。
2. 增加自动 QC 门：
   1) 出厂前必须自动检查：角色一致性、嘴型可见性、lip-sync 评分、转场连续性。
   2) 任一项不达标即显式失败，不允许静默放行。
3. 增加声音出厂门：
   1) 出厂前必须检查：响度、峰值、对白清晰度（对齐交付规范）。
   2) 不满足标准时阻断导出，并返回结构化失败原因。
4. “一键成片”导出门控：
   1) 一键导出仅在全部 QC 门通过后可执行。
   2) 未通过 QC 时，系统只允许修复/重生成，不允许产出最终成片。

### 8.7 出厂门控的最小验收标准（建议）

1. 导演圣经层：
   1) 任意镜头可追溯到对应“风格/表演/节奏”规则 ID。
   2) 同一角色跨镜头外观漂移率低于阈值（阈值在项目级配置）。
2. 自动 QC 门：
   1) 必须输出结构化报告：`character_consistency`、`mouth_visibility`、`lip_sync_score`、`transition_continuity`。
   2) 报告中任一维度失败，成片状态必须为 `blocked_by_qc`。
3. 声音出厂门：
   1) 必须输出结构化报告：`loudness`、`peak`、`dialogue_intelligibility`。
   2) 报告失败时不得生成最终下载链接。
4. 一键成片：
   1) 执行前先读取 QC 汇总状态。
   2) 仅当状态为全通过时，才进入最终渲染与导出。
