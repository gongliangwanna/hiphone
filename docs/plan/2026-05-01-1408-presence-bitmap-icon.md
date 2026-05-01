# 在场 App 位图图标接入计划

## 用户需求

用户认可 imagegen 生成的在场 App 图标，要求“设置上去”，并且明确不要继续使用 SVG 绘制图标。

## 关键决策

1. 将生成图复制到项目资源目录：`public/resource/icons/popular-cn/presence.png`。
2. 保留旧 `presence.svg` 文件但不再引用，避免破坏历史资源；在场 App 实际入口改用 PNG。
3. 修改 `src/platform/appCatalog.ts` 中在场 App 的 `icon` 路径，从 `presence.svg` 改为 `presence.png`。
4. 增加测试，锁定在场图标使用 PNG，防止后续回退成 SVG。

## 验证

1. `pnpm vitest run src/platform/__tests__/appMetadataResolver.test.ts`
2. `pnpm exec tsc --noEmit --pretty false`
3. `pnpm build`
4. 浏览器截图确认桌面在场图标显示为新位图。
