# 世界书条目删除

## 用户需求

用户希望世界书里的条目支持删除。当前 `worldBookStore` 已有 `removeEntry`，但设置 App 的世界书条目编辑页没有删除入口。

## 关键决策

1. 删除入口放在 `WorldBookEntryEditPage` 底部，使用 iOS 设置页常见的红色危险操作行，文案为「删除条目」。
2. 点击删除前使用确认弹窗，避免误删；取消时不改变数据。
3. 确认删除后调用 `removeEntry(book.id, entry.id)`，再 `pop()` 回到世界书编辑页。
4. 不改底层 store 结构；保留已有 store 级 `removeEntry` 行为，包括清空正在编辑的 `editingEntryId`。

## 测试计划

1. 新增页面测试：从世界书条目编辑页点击「删除条目」并确认后，条目从 store 移除并回到世界书编辑页。
2. 新增取消测试：确认弹窗选择取消时，条目仍保留在 store 中。
3. 跑新增测试、现有 `worldBookStore.test.ts` 和 typecheck。
