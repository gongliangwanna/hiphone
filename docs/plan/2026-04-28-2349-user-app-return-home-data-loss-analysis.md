# User App 返回桌面数据丢失排查计划

## 用户需求

用户提供 `/Users/wanqilin/Downloads/ai-app-draft-598d.zip`，反馈这个 user app 每次退回到桌面后数据就丢失。需要分析原因，明确是 app 自身状态写法、user app SDK 存储能力、安装/运行时生命周期、还是桌面返回时组件卸载导致的问题。

## 关键决策

1. 先不直接修改业务代码，先复现和定位数据丢失链路，避免误把宿主生命周期问题当成 user app 代码问题。
2. 对照压缩包源码、`src/platform/userApp` SDK/沙箱/存储实现、`src/apps/AppScene.tsx` 与 shell 返回桌面的卸载逻辑，判断状态应如何被保存。
3. 如果确认是 user app 使用 `useState` 这类内存态导致卸载后重置，会给出具体代码位置和应改用的持久化接口。
4. 如果确认宿主没有在返回桌面时保留 scene 或没有给 user app SDK 正确注入持久化存储，会补充测试建议；本轮先以原因分析为主，除非定位到小范围确定性缺陷再修。

## 排查步骤

1. 解包并阅读 `manifest.json`、`App.tsx`、`hooks/useRecords.ts` 和新增/列表组件，确认数据源和写入方式。
2. 阅读 user app SDK 的 `storage`、`hooks`、`wrap`、`sandbox`、`installer`，确认平台期望的持久化 API。
3. 阅读 app runtime / AppScene / AppHost / Springboard 返回桌面流程，确认 user app 在回桌面时是否会 unmount。
4. 结合测试用例验证已有约束，必要时运行相关 Vitest。
5. 输出结论、证据路径和修复建议。
