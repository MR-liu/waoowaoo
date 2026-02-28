# fold-x 一次性切换发布 Runbook（内部工具）

## 目标
- 展示品牌统一为 `fold-x`
- 技术命名域保持 `foldx`
- 仅保留登录能力，注册链路关闭
- 队列/埋点/日志硬切换，不做双写兼容

## 发布步骤
1. 发布前 30 分钟冻结窗口并通知内部用户。
2. 在入口层暂停 Web 写入（暂停 ingress 或 web service）。
3. 检查旧前缀队列；如有在途任务，导出处置清单并完成清理。
4. 发布新版本 web 与 worker。
5. 验证：
   - `/[locale]/auth/signup` 重定向到 `/{locale}/auth/signin`
   - `POST /api/auth/register` 返回 `403` 且 `error.details.errorCode=REGISTER_DISABLED`
   - 队列仅消费 `foldx-*`
   - 观测属性仅写入 `foldx.*`
   - `LOG_SERVICE` 为 `foldx`
6. 恢复 Web 写入入口。
7. 发布后 30 分钟内执行观测快照并归档。

## 风险控制
- 队列清理属于不可逆操作，执行前必须二次人工确认。
- 若验证失败，立即回滚到发布前镜像并保持入口停写，完成异常复盘后再重试。
