# M1-S4b：App 退出与切换系统

## 用户需求

用户明确指出当前系统缺少两个核心能力：
1. App 退出
2. App 切换

要求不是给单个 App 临时补按钮，而是做成一个系统级能力，并且体验需要尽量贴近 iOS：
- 退出行为应由系统底部区域统一承接，而不是让业务 App 自己决定
- 切换行为应体现 iOS 的多任务系统感，而不是简单列表
- Springboard、运行中的 App、App Switcher 之间必须共享一套生命周期状态

## 关键决策

1. 以 `appRuntimeStore` 为核心，升级为“前台 app + 最近任务列表 + 切换器选中项”的运行时模型，而不是继续只存 `activeAppId`
2. 退出与切换归属 Shell System：
   - `HomeIndicator` 负责底部系统手势入口
   - `AppHost` 负责前台 app 宿主与转场
   - 新增 `AppSwitcher` 负责最近任务卡片视图
3. 手势语义贴近 iOS，但先做可稳定落地的 V1：
   - 底部短上滑：回到桌面
   - 底部长上滑：打开 App Switcher
   - Switcher 中点卡片：切换到该 app
   - Switcher 中将卡片向上拖出：彻底退出该 app
4. 先只支持一个真实 App（Settings），但运行时结构按多 App 设计，避免后续返工
5. 继续遵守既有规范：
   - 系统安全区仍由 Shell 提供
   - spring 参数统一来自 `platform/design-tokens/motion`
   - 手势中的瞬态位移不写入高频 React state

## 交付清单

1. 扩展 `appRuntimeStore`
   - 维护当前前台 app
   - 维护最近 app 栈
   - 提供 `goHome`、`openSwitcher`、`activateApp`、`removeApp` 等系统动作
2. 新增 `AppSwitcher`
   - iOS 风格卡片层叠视图
   - 当前 app 卡片高亮居中
   - 点击卡片切前台
   - 向上移除卡片以退出 app
3. 升级 `HomeIndicator`
   - 桌面态与 app 态外观区分
   - app 前台时接管底部系统手势
   - 支持短上滑回桌面、长上滑进切换器
4. 调整 `Device`
   - 集成 switcher overlay
   - 处理 overlay / 锁屏 / app 前台之间的互斥关系
5. 更新文档与测试
   - 运行时 store 单测
   - `HomeIndicator` / `AppSwitcher` / `Device` 集成测试
   - 记录相关目录 AGENTS 踩坑

## 实现步骤

### Step 1：运行时模型升级

- 扩展 `src/platform/stores/appRuntimeStore.ts`
- 引入最近任务列表和切换器选中态
- 让 `openApp` 在重复打开同一 app 时更新激活顺序，而不是制造重复记录
- 保持关闭动画所需的 icon origin 信息

### Step 2：App Switcher 组件

- 新建 `src/shell/AppSwitcher/AppSwitcher.tsx`
- 使用系统材质、卡片缩放、层叠偏移和顶部退出手势
- 视觉参考 iOS 最近任务而非普通对话框

### Step 3：Home Indicator 系统手势

- 将 `src/shell/HomeIndicator/HomeIndicator.tsx` 从纯展示升级为系统交互组件
- 仅在前台 app 或切换器场景下启用底部手势捕获
- 用阈值区分回桌面与打开切换器

### Step 4：Device / AppHost 集成

- 在 `Device` 中接入 switcher overlay 渲染和互斥逻辑
- 在 `AppHost` 中适配新的运行时状态读取方式

### Step 5：测试与文档

- 更新 / 新增单测
- 运行 `pnpm test` 与 `pnpm build`
- 根据本次改动补充对应目录规范

## 测试计划

1. store 测试：
   - 打开 app 后进入前台并写入最近任务
   - 回桌面不会丢失最近任务
   - 激活已有任务会更新最近顺序
   - 从切换器移除任务后前台和最近任务保持一致
2. 组件测试：
   - `HomeIndicator` 在 app 前台时可触发回桌面与切换器
   - `AppSwitcher` 显示最近任务卡片，点击可切换，移除可退出
   - `Device` 在锁屏时不允许切换器打开
3. 集成验证：
   - `pnpm test`
   - `pnpm build`

## 验收标准

1. 打开 Settings 后，底部系统区域可执行回桌面
2. 从前台 app 可进入 App Switcher
3. 在 App Switcher 中可切回最近 app
4. 在 App Switcher 中上推卡片可退出 app
5. 锁屏和其他 overlay 不会与 switcher 冲突
6. 视觉和交互仍保持 iOS 系统层风格
