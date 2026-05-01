# 全量数据导出 / 导入

> 详细技术 plan 见 `/Users/wanqilin/.claude/plans/cryptic-finding-rossum.md`（plan 模式产物），本文件按项目 CLAUDE.md 规范留底。

## 用户需求原文

> "分析下我们有能力将所有数据导出 然后又支持导入吗? 支持难度如何"
>
> 选定方向：在 **设置 → 存储** 页面加"导出全部数据 / 导入数据"。

## 关键决策

1. **格式：ZIP**（每个 object store 一个 JSON + `manifest.json`）。复用项目里已有的 `jszip ^3.10.1`，对图片 base64 压缩比好。
2. **导入策略：完全替换 + 自动备份兜底**。点导入 → 自动下载一份当前数据 ZIP → 校验 manifest → 清空 store → 写入 → 刷新页面。失败不清空。
3. **版本管理**：第一版只在 manifest 写 `exportSchemaVersion`/`dbVersion`。现有 persist store 没有 `version`/`migrate`，跨版本导入暂时靠"严格匹配版本号"，未来 schema 演进再补 migrate。
4. **入口位置**：`StoragePage.tsx` "删除所有数据"上方加一组 ListSection，跳到新页面 `DataBackupPage`。

## 涵盖的数据源（8 个 object store）

- `kv`：~20 个 Zustand persist key（含 per-entity `hiPhone-notes::char-{id}` 副本）
- `messages` / `moments`：XingYu 高频 record store
- `characterMemory` / `characterMemoryState`：AI 角色记忆
- `app-meta` / `app-src` / `app-kv`：用户自制 app 系统

所有图片走 DataURL（base64 内嵌），无纯 Blob，整个备份是 JSON-safe 的。

## 任务清单

详见技术 plan。简版：

1. ✅ 写 plan
2. 提取 `downloadBlob` 工具（复用 builderPromptExport 模式）
3. 实现 `exportAllData` + 测试
4. 实现 `importAllData` + 测试（含自动备份兜底）
5. 注册 `dataBackup` 路由
6. 写 `DataBackupPage` UI
7. `StoragePage` 加跳转入口
8. 端到端验证

## 风险

- 导入中途失败：自动备份兜底
- 跨版本不兼容：manifest 严格校验版本号，宁可拒绝也不破坏
- 大体积（messages/photos 重度用户可能几十 MB）：DEFLATE 压缩 + Blob 流式下载，不在内存里拼大字符串
