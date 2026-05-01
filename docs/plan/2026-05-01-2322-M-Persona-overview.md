# M-Persona 多 persona 数据隔离 — 总览

> Spec: `docs/superpowers/specs/2026-05-01-multi-persona-sim-card-design.md`

## 里程碑结构

里程碑 M-Persona 拆为 6 个 PR，每个 PR 独立可上线、可回归。**严格按顺序合入**。

| PR | 文件 | 状态 | 阻塞依赖 |
|---|---|---|---|
| PR1 | `2026-05-01-2323-PR1-persona-context-leak-fix.md` | 待执行 | — |
| PR2 | 待编写（PR1 合入后写） | — | PR1 |
| PR3 | 待编写（PR2 合入后写） | — | PR2 |
| PR4 | 待编写（PR3 合入后写） | — | PR3 |
| PR5 | 待编写（PR4 合入后写） | — | PR4 |
| PR6 | 待编写（PR5 合入后写） | — | PR5 |

## 为什么不一次性把 6 个 plan 全写完

PR2-PR6 的具体步骤依赖 PR1/PR2 中实际选定的 helper API、命名、类型签名。提前写"全细节" plan 等于猜测——上游一旦微调下游 plan 全部要返工。**采用流水线式：上一 PR 合入并验证后再写下一 PR 的 plan**，每个 plan 写出来就是可执行的、不需要返工。

## 每个 PR 概要

### PR1 — 修复"会话对方"误用 active persona 的潜伏 bug
**目标**：消除 8 处直接 `usePersonaStore.getState().getActivePersona()` 当"会话对方"的捷径，改成显式 personaId 入参从被处理对象的归属反查。
**为何独立**：现存 bug，与多 persona 上线解耦。先合入一个 release 验证单 persona 行为不变，再开始下游改造。

### PR2 — `'me'` 字面量大替换 + IDB 一次性迁移
**目标**：建立 `src/platform/identity/` helper；80+ 处 `'me'` 字面量替换为 helper 调用；启动时迁移 IDB（Pass A/B/C）。
**交付后状态**：系统仍是单 persona，但所有 key/value 已是新格式（`persona-default`）。

### PR3 — Phone-local stores 按 owner 隔离
**目标**：calendar / springboard / installedUserApps / assistiveTouch / system / sticker / bubbleSkin / 新建 userProfileStore 全部包成 `EntityStoreRegistry`；写 `useXxxStore` hook 模式。
**交付后状态**：基础设施就绪，但仍只有 `persona-default` 一个 owner。

### PR4 — Memory 双键 `(charId, peerId)` 落地
**目标**：`characterMemoryStore` / `memoryStateStore` 的 entries/records 改成双键 Map；压缩 pipeline / heartbeat 改成 (char, peer) 维度调度；所有 callsite 显式传 peerId。
**交付后状态**：数据结构上 ready 多 persona；UI 上仍单 persona。

### PR5 — Settings persona CRUD + 切换 UI
**目标**：PersonaPage 新建/编辑/删除/切换；切换时 phone-local hooks 重订阅；切换不联动 phoneOwnerStore。
**交付后状态**：用户首次能在 UI 创建第二个 persona 并真正实现 SIM 卡式隔离。

### PR6 — E2E 测试 + 边界场景
**目标**：双 persona 平行流、迁移幂等、群聊跨 persona 可见性、查 char 手机聚合等场景的 Playwright + 单测覆盖。
**交付后状态**：里程碑收口，可宣传上线。

## 执行约定

- 每个 PR 在自己的特性分支上完成、合入 `feat/m1-architecture`（或当前主开发分支）
- 每个 PR 合入后跑全量回归（`pnpm test` + `pnpm build` + 手动冒烟），确认单 persona 行为不退化
- 跑完且单 persona 行为稳定 1-2 天后，再写下一个 PR 的 plan、开始下一个 PR
