# 在场 App UI 打磨计划

## 用户需求

> "在场app 我觉得整体UI做的很粗糙 没有那种和AI谈恋爱的精致感 需要你优化下"

随后用户决定：**保留现有风格（iOS 系统风、systemBlue 主色、灰白底、布局结构、动效曲线）**，只对粗糙处做打磨。

## 关键决策

1. **不改风格** — 不引入新主色、不换字体、不改布局骨架
2. **优先修违反 `AGENTS.md` 现有规范的实现 bug**（用户气泡、NavBar 文字按钮）
3. **同风格内做减法** — 移除装饰性元素、收敛圆角/阴影、降级 section 标题
4. **不动**：所有动效曲线/spring 参数、AppScreen 背景色、整体导航栈、tests

## 范围（共 7 项）

### 必修（违反规范）

1. **用户回合不再用气泡** — `AGENTS.md` 第 6 条："场景页不使用聊天气泡"。
   - `FragmentStream.tsx`：去掉淡蓝色 bubble 容器，改为带左侧 2px systemBlue 描边的段落；移除冗余"你："前缀
   - 保留 `presence-user-turn` testid

2. **NavBar"离开"用 icon** — 当前 `<span>离开</span>` 与同级"记录"按钮（`BookOpen` icon）风格不一致。
   - `PresenceApp.tsx`：改为 lucide `LogOut` icon，size=20

### 视觉打磨（同风格做减法）

3. **Hero 卡精简**
   - `PresenceApp.tsx` 主屏 hero：去掉"即将进入 ✨"装饰行（含 `Sparkles` 图标）
   - `SceneHero.tsx`：去掉右上"在场"角标（这个 app 本身就是在场，冗余）
   - 同步移除 `Sparkles` import

5. **圆角收敛到 4 档** — 当前混用 14/18/20/22/24/28
   - 标准化为：按钮 14、小卡 18、内容卡 22、Hero 28
   - 改动：`SceneHero` 内层 24→22；`FragmentStream` assistant 24→22；`CharacterPicker` 选项 20→18

6. **section 标题降级**
   - "选择角色"/"选择场景" 从 `text-[13px] font-semibold label` 改为 `text-[11px] font-semibold tracking-[0.06em] tertiaryLabel`
   - 从"内容标题"变"分组标记"，更克制

7. **场景输入精简**
   - `ScenePicker.tsx`：去掉 textarea 下方 "可自定义 / X 字" 工具栏整条
   - 去掉标题旁的 "可自定义" 标签（textarea 自身已经表达）
   - 占位符："例如：雨夜的便利店门口，她撑着伞站在灯下等你。" → "雨夜的便利店门口，她撑着伞等你"

10. **未结束场景恢复卡精简**
    - 阴影 `0 18px 42px rgba(0,122,255,0.11)` → `0 10px 28px rgba(0,122,255,0.08)`
    - "丢弃"按钮去掉灰底 `rgba(118,118,128,0.12)`，改纯文字次级动作（保留点击区域）

## 不做

- 项目 4（全局阴影降一档）— 范围太广收敛不出明显收益
- 项目 8（角色选中态收敛）— 当前选中态视觉差异已经够明显，硬减反而损失反馈
- 项目 9（预设场景蓝光阴影）— 与项目 4 相关，跳

## 文件清单

- `src/apps/Presence/PresenceApp.tsx` — 项目 2、3（主屏 hero）、10
- `src/apps/Presence/components/SceneHero.tsx` — 项目 3（badge）、5
- `src/apps/Presence/components/FragmentStream.tsx` — 项目 1、5
- `src/apps/Presence/components/CharacterPicker.tsx` — 项目 5、6
- `src/apps/Presence/components/ScenePicker.tsx` — 项目 5、6、7

## 验证

1. `pnpm tsc --noEmit` 通过
2. `pnpm test src/apps/Presence` 通过（PresenceApp.test / LeaveSummarySheet.test / presenceMemory.test）
3. `pnpm build` 通过
4. 手动 grep `Sparkles`、"即将进入"、"可自定义"、"你："等被删除的字符串确认无残留
