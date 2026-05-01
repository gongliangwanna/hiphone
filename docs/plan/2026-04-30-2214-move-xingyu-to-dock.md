# 可爱信移入 Dock 计划

## 用户需求

用户要求：可爱信也移到 Dock。

当前状态：可爱信位于 Springboard 主屏幕网格，Dock 已有设置、Safari、音乐三个入口。

## 关键决策

1. “移到 Dock”延续前一次规则：从主屏幕网格移除，只在 Dock 显示。
2. Dock 中复用真实 app id `xingyu`，不新增 `xingyu-dock`，避免最近任务、生命周期和 AI 上下文被拆成两份。
3. Dock 顺序保持现有入口不动，把可爱信追加为第四项：设置、Safari、音乐、可爱信。
4. 更新测试，锁定可爱信不在默认网格中，但在 Dock 中。

## 验收

1. 默认桌面网格不显示可爱信。
2. Dock 显示设置、Safari、音乐、可爱信。
3. `getAppsWithUserInstalled()` 不返回 Dock-only 的可爱信。
4. Springboard 相关测试和类型检查通过。
