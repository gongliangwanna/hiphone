# 多实体数据架构

## 概述

hiPhone 中每个实体（玩家 + 各 AI 角色）拥有独立的"手机"视角。通过 `phoneOwnerStore` 切换当前视角，所有 App 据此展示对应实体的数据。

## 数据分类

| 分类 | 说明 | 策略 | 示例 |
|------|------|------|------|
| **A: 共享关系型** | 多方共享的数据 | 视角变换 `usePerspective()` | 消息、对话、朋友圈 |
| **B: 独立实体** | 纯属个人数据 | `EntityStoreRegistry` 命名空间 | 备忘录、日历 |
| **C: 全局共享** | 所有实体共享 | 不变 | 角色卡、AI配置 |

## 核心模块

### `phoneOwnerStore`

`src/platform/stores/phoneOwnerStore.ts`

- `phoneOwnerId: string | null` — null=玩家, string=角色 characterId
- 不持久化，每次启动默认玩家
- `viewPhone(characterId)` / `returnToMyPhone()`

### `usePerspective()` hook

`src/platform/hooks/usePerspective.ts`

- `selfSenderId` — 当前手机主人的 senderId (`'me'` 或 `'char-{id}'`)
- `isSelf(senderId)` — 判断某 senderId 是否是当前手机主人
- `isViewingOther` — 是否正在查看别人的手机

### `EntityStoreRegistry`

`src/platform/storage/entityStoreRegistry.ts`

为 Category B 数据提供基于实体的 IDB key 命名空间隔离。

## 新 App 开发 checklist

当开发新 App 时，按以下步骤支持"查手机"功能：

1. **判断数据类型**: 该 App 的数据属于 A/B/C 哪类？
2. **Category A**: 使用 `usePerspective()` 替代所有 `=== 'me'` 判断
3. **Category B**: 用 `EntityStoreRegistry` 注册 store，创建 proxy hook
4. **Category C**: 无需改动
5. **只读模式**: 当 `isViewingOther === true` 时隐藏所有编辑入口
6. **测试**: 切换视角后 App 行为是否正确

## 禁止事项

- 禁止硬编码 `senderId === 'me'`，应使用 `usePerspective().isSelf()`
- 禁止在 AI 心跳系统中读取 `phoneOwnerId`（心跳始终以 AI 身份运行）
- 禁止修改 promptAssembly.ts 中的 `'me'` 语义（那里 `'me'` 始终=玩家）
