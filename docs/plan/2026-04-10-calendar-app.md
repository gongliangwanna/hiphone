# 2026-04-10 日历 App

## 用户需求
制作与 iOS 保持一致的日历 App，包含月视图、事件 CRUD、数据持久化。

## 里程碑
- **M1（本次）**: 月视图 + 事件 CRUD + localStorage 持久化 + 导航动画
- **M2（后续）**: 周视图/日视图、搜索、重复事件、提醒

## 关键决策
1. **数据存储**: Zustand + persist middleware → localStorage，与 Notes app 保持一致
2. **月网格**: 固定 42 格（6行x7列），周日起始，复用 date-fns 计算
3. **导航模式**: 三页栈式导航（month → event-detail → event-form），AnimatePresence 滑动动画
4. **事件时间**: Unix ms 时间戳，全天事件归一化到日边界
5. **不持久化 UI 状态**: selectedDate/currentMonth 每次打开默认今天
6. **颜色方案**: 复用 CSS 变量（systemBlue 等 7 色）

## 文件清单
- 新建: `src/apps/Calendar/` 下 7 个文件 + 3 个测试文件
- 修改: `src/apps/AppScene.tsx`, `src/apps/CLAUDE.md`
