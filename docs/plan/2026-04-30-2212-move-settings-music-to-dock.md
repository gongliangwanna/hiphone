# 设置与音乐移入 Dock 计划

## 用户需求

用户要求：将设置、音乐移动到 Dock 栏。

当前状态：设置和音乐都在 Springboard 主屏幕网格中，音乐还额外有 `music-dock` Dock 入口，导致音乐在桌面与 Dock 中重复出现。

## 关键决策

1. “移动”按 iOS 桌面语义处理：设置、音乐从主屏幕网格移除，只显示在 Dock 中。
2. Dock 入口使用真实 app id：
   - 设置使用 `settings`；
   - 音乐使用 `music`。
3. 不继续使用 `music-dock` 作为可见 Dock 入口，避免音乐小组件、聊天页音乐跳转和 Dock 打开后在最近任务中分裂成两个 app id。
4. Safari 仍保留当前 `safari-dock` 入口，本次只处理用户点名的设置和音乐。
5. 更新测试，明确锁定设置/音乐只出现在 Dock，不出现在默认主屏幕网格。

## 验收

1. 默认桌面网格不显示设置、音乐。
2. Dock 显示设置、Safari、音乐。
3. `getAppsWithUserInstalled()` 仍只返回网格 app，用户安装 app 仍能追加到网格。
4. Springboard 相关测试和类型检查通过。
