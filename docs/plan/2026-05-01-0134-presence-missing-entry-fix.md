# 在场 App 入口缺失修复

## 用户需求

本地页面出现 Vite import-analysis 错误：

`Failed to resolve import "./Presence/PresenceApp" from "src/apps/registerBuiltins.ts"`

用户当前在测试可爱信装扮，本错误阻断整个应用加载，需要立即修复启动链路。

## 关键决策

1. 不撤掉 `presence` 注册。
   - `src/apps/Presence` 已有 store、AI、memory、scene 类型等基础文件。
   - `registerBuiltins.ts` 和 `appCatalog.ts` 已经把「在场」作为内置 App 接入。
   - 缺的是入口组件 `PresenceApp.tsx`。

2. 本次补一个可运行 MVP 入口，而不是实现完整在场流程。
   - 目标是修复 Vite overlay，保证用户继续测试可爱信。
   - 入口展示角色、场景和历史记录，能创建/丢弃本地 session。
   - 暂不自动触发 AI 请求，避免引入新不稳定点。

3. 遵守 `src/apps/Presence/AGENTS.md`。
   - 文案使用“角色”，不写“AI 角色”。
   - 场景页不使用聊天气泡。
   - 进行中不写入长期记忆。
   - 已完成记录只读。

## 验收

- `src/apps/registerBuiltins.ts` 能成功解析 `./Presence/PresenceApp`。
- `pnpm exec tsc --noEmit --pretty false` 通过。
- 本地 Vite overlay 消失；如仍有其它错误，再按实际错误继续修。
