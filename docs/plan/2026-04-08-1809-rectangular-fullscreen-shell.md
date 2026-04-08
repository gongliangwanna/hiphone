# 计划：统一为长方形全屏壳层

## 用户需求

用户进一步明确：所有版本都不需要保留手机圆角或模拟器外壳，统一使用长方形全屏展示即可。桌面端也不再需要居中的手机框。

## 关键决策

1. `Device` 不再区分 `simulator` / `fullscreen` 两种视觉形态，统一铺满窗口。
2. `ViewportProfile` 继续保留 `shellMode` 字段以减少重构范围，但值恒为 `fullscreen`。
3. `sizeTier` 保留，仅负责控制 Springboard 的 icon、gap、padding 档位，不再参与壳层模式切换。
4. Safe-area 变量继续由 `Device` 根节点统一输出，所有 shell 组件继续从 CSS 变量读取。

## 交付清单

- `Device` 根节点统一为矩形全屏
- `viewportProfile` 逻辑简化为只做尺寸档位判定
- 相关测试从“模拟器 vs 全屏”改为“统一全屏 + 不同尺寸档位”
- 保留先前的移动端 safe-area / size-tier 适配实现

## 测试计划

1. 纯函数测试覆盖桌面与手机视口下统一返回 `fullscreen`
2. `Device` 组件测试验证根节点始终为矩形全屏
3. `pnpm test`
4. `pnpm build`
