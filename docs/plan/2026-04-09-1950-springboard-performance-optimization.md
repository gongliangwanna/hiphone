# Springboard 性能优化

## 用户需求
用户发现隐藏桌面(Springboard)后 hiPhone 卡顿明显减轻，需要分析根因并优化。

## 根因分析
1. 58 个 AppIcon 组件无 React.memo，任何父组件 re-render 级联到全部图标
2. 每个 AppIcon 各自订阅 2 个 Zustand store，但无 memo 时 selector 优化无效
3. Springboard 始终挂载，锁屏/切换器下 GPU 仍需对 58 图标 + blur 滤镜做合成
4. ControlCenter 违规直写 backdropFilter，未走 Material 组件

## 关键决策

### Phase 1: 组件树 Memoization
- AppIcon/IconGrid/Dock/PageIndicator 全部加 `React.memo`
- AppIcon 的 store 订阅提升到 Springboard 集中管理，通过 props 下发
- 收益：58 次 re-render -> ~8 次 shallow compare bail out

### Phase 2: visibility 管理
- 锁屏/app前台/切换器模式下设置 `visibility: hidden` 跳过 GPU 合成
- 锁屏拖拽手势中动态恢复 `visibility: visible`
- 收益：不可见时零 GPU 合成开销

### Phase 3: ControlCenter backdropFilter 合规
- 将直写 `backdropFilter: blur(20px)` 替换为 `<Material variant="thin">`
- 复用 `thin` variant（blur: 20px, saturate: 180%）
