# OpenRouter 厂商路由计划

## 用户需求

- 在现有模型配置里，OpenRouter 除了选择模型，还要支持选择 OpenRouter 内部厂商。
- 典型用例是选择 Cerebras。
- 厂商选择是 OpenRouter 的可选项：不选择时保持 OpenRouter 默认路由行为。
- 当选择 Cerebras 时必须严格限定只允许 Cerebras，失败就报错，不能 fallback 到其它厂商。

## 关键决策

1. 只在 OpenRouter provider 下显示和保存厂商路由字段，其它 provider 不暴露该选项。
2. 持久化字段命名为 `openRouterProviderSlug`，保存 OpenRouter provider slug，例如 `cerebras`。
3. API 请求层在 `providerId === 'openrouter'` 且 slug 非空时写入请求体：

   ```json
   {
     "provider": {
       "only": ["cerebras"],
       "allow_fallbacks": false
     }
   }
   ```

4. 选择模型、测试连接、常规聊天、心跳、压缩等所有走 `streamChat` / `chatComplete` 的 OpenRouter 请求都应继承同一配置。
5. 不做 OpenRouter provider 列表动态拉取。本次先内置 `Cerebras` 和“默认路由”，避免引入额外加载状态；后续可以独立扩展成 `/providers` 动态列表。
6. 切换到非 OpenRouter provider 时不清空字段，方便用户切回 OpenRouter 后保留选择；请求层会忽略该字段。

## 修改范围

- `src/platform/stores/aiConfigStore.ts`
  - `ApiPreset` 增加 `openRouterProviderSlug`。
  - 顶层 mirror 增加同名字段和 `setOpenRouterProviderSlug` action。
  - create/copy/switch/delete/migrate/persist/fetchModels 写穿 active preset。

- `src/platform/ai/providers.ts`
  - `streamChat` 支持可选 `openRouterProviderSlug`。
  - OpenRouter 请求体按严格限定写入 `provider.only` 和 `allow_fallbacks: false`。

- `src/platform/ai/chatComplete.ts`
  - 非流式请求支持同一字段，避免压缩和心跳故事等直接调用缺失配置。

- `src/apps/Settings/pages/ModelSelectPage.tsx`
  - OpenRouter 时在“连接”和“模型列表”之间显示“厂商”选择。
  - 提供“默认路由”和“Cerebras”两个选项。

- `src/apps/Settings/pages/AIServicePage.tsx`
  - 保持旧页面与模型选择页一致，避免仍能进入的服务页缺少配置。

## TDD 步骤

1. Store 红灯
   - 在 `src/platform/stores/__tests__/aiConfigStore.test.ts` 添加测试：
     - `ApiPreset` 包含 `openRouterProviderSlug`。
     - `setOpenRouterProviderSlug('cerebras')` 写入顶层和 active preset，不影响其它 preset。
     - `setActivePreset` 会恢复对应 preset 的 OpenRouter 厂商。
     - `migrateToV2` 给旧数据补空字符串。
   - 运行 `pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts`，确认新增测试失败。

2. Store 绿灯
   - 实现 `aiConfigStore.ts` 的字段、action、迁移和持久化。
   - 重跑同一测试，确认通过。

3. Provider 请求红灯
   - 在 `src/platform/ai/__tests__/providers.test.ts` 添加测试：
     - `streamChat` 对 OpenRouter + `openRouterProviderSlug: 'cerebras'` 写入 `provider.only = ['cerebras']` 和 `allow_fallbacks = false`。
     - 非 OpenRouter 即使传入 slug 也不写 `provider`。
   - 在 `src/platform/ai/__tests__/chatComplete.test.ts` 添加同等非流式测试。
   - 运行两个测试文件，确认新增测试失败。

4. Provider 请求绿灯
   - 修改 `providers.ts` 和 `chatComplete.ts`。
   - 更新所有调用点传入 `openRouterProviderSlug`，至少覆盖 `aiChatEngine.ts`、`heartbeatAgent.ts`、`heartbeatVirtualWorldStory.ts`、`characterMemoryCompression.ts`、`compressionPassA/B/C.ts`、`characterDescriptionGenerator.ts`、Settings 测试连接。
   - 重跑两个请求层测试。

5. UI 红灯
   - 在 `src/apps/Settings/pages/__tests__/AIServicePage.test.tsx` 添加测试：
     - OpenRouter 页面展示“厂商”和“Cerebras”。
     - 点击 Cerebras 后 store 字段变为 `cerebras`。
     - 切换到 SiliconFlow 后厂商区域不显示。
   - 如已有 ModelSelect 测试不足，新建 `ModelSelectPage.test.tsx` 做同样覆盖。
   - 运行 Settings 页面测试，确认失败。

6. UI 绿灯
   - 实现两个 Settings 页面中的厂商选择控件。
   - 重跑 Settings 页面测试。

7. 最终验证
   - 运行：
     - `pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts src/platform/ai/__tests__/providers.test.ts src/platform/ai/__tests__/chatComplete.test.ts src/apps/Settings/pages/__tests__/AIServicePage.test.tsx`
     - `pnpm typecheck`
   - 如类型检查受工作区既有未提交改动影响，记录具体失败来源，不回滚无关文件。

## 不做

- 不新增 OpenRouter `/providers` 动态拉取 UI。
- 不支持多厂商排序。
- 不支持“优先 Cerebras 但允许 fallback”的模式，因为用户明确要求只允许 Cerebras。
- 不调整 SiliconFlow / custom 的连接语义。
