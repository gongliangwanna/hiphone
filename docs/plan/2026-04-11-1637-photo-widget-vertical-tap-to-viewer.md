# 2026-04-11 照片小组件改垂直滑动 + 点击深链到 PhotoViewer

## 用户需求

> 改成上下滑,然后点击后跳转到相册对应图片

两个变更：
1. **滑动轴**：从横向改为**纵向**（上下滑切换照片）
2. **点击行为**：不是"打开相册首页"，而是"打开相册并直接跳进 PhotoViewer 展示当前小组件显示的那张照片"

## 现状

- 上一版 PhotoWidget（`2026-04-11-1546-photo-widget-interactive.md`）实现了横向滑动 + tap→openApp('photos')
- 横向滑动的主要架构决策（D1 stopPropagation 路由、D2 编辑态感知、D4 物理参数、D5 tap 判定）在纵向版本里基本可复用，只是把 X 换成 Y
- Photos App 架构：`usePhotosStore.openPhoto(id)` 设置 `viewingPhotoId` → `<PhotoViewer />` 在 `AnimatePresence` 里条件渲染
- `PhotosApp.tsx` 的 mount effect 会在 `wasAppKilled('photos')` 时调用 `reset()`，把 `viewingPhotoId` 清空——我们在 openApp 之前必须先 `clearAppKilled('photos')`，否则 reset 会盖掉我们 pre-set 的 viewingPhotoId

## 关键决策

### D1. 滑动轴：纵向 Y，跟前版的横向 X 对称

- `dragY` (motion value) 替换 `dragX`
- strip 从横向 `flex-row` 改成纵向 `flex-col`，宽度 100% / 高度 = N * 100%
- 距离阈值 = `viewportHeight * 0.25`
- 速度阈值 = `|vy| > 0.35 px/ms`
- 超出首/尾用 `rubberBand(offset, viewportHeight)`

### D2. 纵向手势和父级 `usePageSwipe` 的共存

父级 `Springboard` 的 gesture surface 有 `touchAction: 'pan-y'`（浏览器自己接管垂直滚动，把横向给 JS）。我们纵向滑动的话就和浏览器原生滚动冲突——小组件必须把自己那块儿设成 `touchAction: 'none'`，阻止浏览器把它当成 scroll。

保留 pointerdown 的 `stopPropagation` + `setPointerCapture` 策略（跟横向版一样），因为：
- 横向小幅度 jitter 如果让 `usePageSwipe` 抢到了，手感会有冲突
- 代价是"从照片小组件内部不能触发翻页"——iOS 真实行为也是小组件面积内不会触发翻页手势

用户权衡跟上一版完全一样：`interactive = variant !== 'drawer' && !isEditMode && photos.length > 1`。

### D3. 深链到 PhotoViewer 的正确顺序

必须用 **"先清 kill → 先 openPhoto → 再 openApp"** 顺序，原因：

```
// 错误顺序:
openApp('photos', origin);                    // 1. mount Photos App
// Photos mount effect 同步运行:
//    if (wasAppKilled('photos')) reset();    // 2. 可能把 viewingPhotoId 清零
usePhotosStore.getState().openPhoto(id);      // 3. 这时才设置, 但 PhotoViewer 的首帧已经渲染空
```

```
// 正确顺序:
clearAppKilled('photos');                      // 1. 让 mount effect 里的 reset 被跳过
usePhotosStore.getState().openPhoto(id);       // 2. 预设 viewingPhotoId
openApp('photos', origin);                     // 3. mount; useEffect 看见 !wasAppKilled, 不 reset
                                               //    PhotoViewer 读到 viewingPhotoId, 直接渲染
```

清 kill 是幂等操作，对"从未杀过的 Photos"来说也安全（delete 不存在的 key 是 no-op）。

### D4. 当前照片 id

`currentIndex` state 指向 `photos[currentIndex]` 的真实 photo（包含 id）。tap 时从 `photos[currentIndexRef.current].id` 拿到，深链过去。

### D5. 页码指示器

移除上一版的横向底部圆点。iOS 真实照片小组件没有指示器，垂直滑动也不习惯在底部横向排点。两种可选：
- **A**：完全不显示，保持干净
- **B**：右侧一列垂直圆点，跟分页一致

选 A。理由：
- iOS 参考样式就是没有
- 右侧圆点会挡到照片内容的角落，视觉噪声
- 纵向滑动本身的弹簧回弹已经是足够的 affordance

### D6. 文案位置

底部渐变 + caption 保持不变。垂直 strip 的每一帧里各自带自己的 caption。

### D7. touchAction 与事件捕获

- 小组件视口：`touchAction: 'none'`（`interactive === true` 时）
- pointerdown 里 `stopPropagation`（避开父 `usePageSwipe` 的捕获）+ `setPointerCapture`
- 在 `interactive === false` 时不挂任何事件，完全交给父 `WidgetSlot` 处理拖拽

## 交付清单

1. `src/shell/Widgets/PhotoWidget.tsx`
   - 垂直 strip 渲染结构
   - dragY motion value + Y 轴手势
   - 移除底部圆点
   - tap 时走 clearAppKilled → openPhoto → openApp 三步
2. `src/shell/Widgets/__tests__/widgets.test.tsx`
   - 现有横向测试改成纵向
   - 新增断言：tap 之后 `usePhotosStore.getState().viewingPhotoId === photos[0].id`
3. 计划文档（本 md）

## 测试计划

- `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx` 全绿
- `pnpm typecheck` 无错
- 部署后手测：
  - 上下滑小组件 → 照片跟手移动，松开吸附到最近索引
  - 轻点 → 打开 Photos App 并直接进入 PhotoViewer 展示当前那张照片
  - 在 PhotoViewer 里下滑关闭 → 回到 Photos App 主界面
  - 编辑态下 drag 小组件换位不受影响
  - 2x2/4x2/4x4 三档都验
