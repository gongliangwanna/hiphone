# 状态栏透明浮层 — Edge-to-Edge 系统能力

**日期**: 2026-04-11 02:25
**状态**: 已完成

## 用户需求

状态栏在 app 打开后会遮挡 app 正常内容展示。需要做到：
- 时间、电量等状态信息正常展示且能看清
- 状态栏空白区域不遮挡 app 内容
- 大部分 app 不适合全屏，提供 opt-in 能力，按需开启

## 关键决策

**方案：AppScreen 新增 `edgeToEdge` prop**

- 默认 `false`：保持现有行为（paddingTop 安全区），所有现有 app 零改动
- 设为 `true`：去掉 paddingTop，app 内容全屏渲染到状态栏后面
- 开启后，app 自行通过 `var(--app-safe-top)` CSS 变量处理安全区

## 使用方式

```tsx
// 默认模式 — 内容在状态栏下方（大多数 app）
<AppScreen backgroundColor="#fff">
  <NavBar title="设置" />
  ...
</AppScreen>

// Edge-to-Edge 模式 — 内容延伸到状态栏后面（地图、相机等）
<AppScreen edgeToEdge backgroundColor="transparent">
  <div style={{ paddingTop: 'var(--app-safe-top)' }}>
    {/* 需要避让状态栏的内容 */}
  </div>
</AppScreen>
```

## 改动文件

| 文件 | 改动 |
|------|------|
| `system/AppScreen/AppScreen.tsx` | 新增 `edgeToEdge` prop |
| `system/AppScreen/__tests__/AppScreen.test.tsx` | 新增测试用例 |
