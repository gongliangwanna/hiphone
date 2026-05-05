# 可爱信位置消息计划

## 用户需求

用户在可爱信聊天时点击输入栏右侧加号，会弹出底部附件抽屉；抽屉里已有“照片”。现在需要新增“位置”，用户可以把自己的定位发给 AI。聊天界面要把这条消息渲染成位置卡片；AI 实际读到的仍然只是文字信息，而不是地图或结构化对象。

## 范围

- 在 `src/apps/XingYu` 的聊天附件抽屉中新增“位置”入口。
- 点击“位置”后通过浏览器 `navigator.geolocation.getCurrentPosition` 获取当前经纬度，再复用地图 App 的 Nominatim 能力做反向地理编码，拿到具体地点名/地址后发送位置消息。
- 消息数据新增 `location` 类型，存储 `label`、`address`、`displayName`、`latitude`、`longitude`、可选 `accuracy`/`placeId`。
- 聊天列表预览、收藏、引用、转发、合并转发和 AI memory 写入都要能处理位置消息。
- AI memory 文本采用明确的文字摘要，例如 `[位置] 我的位置\n纬度：31.230400\n经度：121.473700`。
- 复用地图 App 的 CARTO/OSM 地图瓦片和 Nominatim reverse geocoding，不自造假地图；反向地理编码失败时不发送半成品经纬度消息。

## 关键决策

1. 位置消息独立为 `LocationMessage`，不塞进普通 text 消息。这样 UI 可以稳定渲染卡片，转发/收藏也能保留结构化经纬度。
2. Geolocation 或 reverse geocoding 任一步失败时只展示 toast，不写入消息，避免 AI 读到没有地点名的坐标。
3. 位置卡片使用地图 App 的 `TILE_URL` 加载真实 CARTO 地图瓦片，叠加定位 pin；卡片正文优先显示地点名和地址，不把经纬度作为用户可见主内容。
4. AI 只通过 `buildMemoryEntry` / `_appendMessage` 写入文字版位置，优先包含地点名和地址；经纬度仅作为数据字段给地图渲染使用。
5. 测试优先：先新增失败测试覆盖抽屉入口、发送位置消息、卡片渲染、memory 文本化和转发/收藏处理，再实现。

## 开发步骤

1. 更新 `Maps/searchService.ts`：新增 `reverseGeocode`，复用 `NOMINATIM_REVERSE_URL` 和现有地址格式化。
2. 更新 `data.ts`：完善 `LocationPayload`、`formatLocationText`，让 AI 文本优先使用地点名/地址。
3. 更新 `xingYuDataStore.ts`：保留 `sendLocationMessage`，补齐 preview、favorite extraction、forward 和 merge-forward。
4. 更新 UI：`AttachmentDrawer.tsx` 增加位置入口；`ChatDetail.tsx` 接入 geolocation + reverse geocode、toast、真实地图瓦片卡片、点击跳转地图 App。
5. 更新辅助界面：`QuotePreview.tsx`、`ChatSearch.tsx`、`ForwardDetail.tsx`、`Favorites.tsx` 处理位置预览。
6. 运行聚焦测试：`pnpm vitest run src/apps/Maps/searchService.test.ts src/apps/XingYu/__tests__/ChatDetail.test.tsx src/apps/XingYu/__tests__/messageActions.test.ts src/platform/ai/__tests__/buildMemoryEntry.test.ts`。
7. 运行类型检查，确认新增 union 分支没有遗漏。

## 验收标准

- 加号抽屉同时展示“照片”和“位置”。
- 点击“位置”且 geolocation + reverse geocode 都成功后，当前会话新增一条自己的位置消息，并触发既有 AI 回复路径。
- 聊天中位置消息显示为真实地图瓦片卡片，而不是普通文字气泡或假的 CSS 地图。
- 卡片正文展示具体地点名/地址，不把经纬度作为主要展示内容。
- AI memory 中的位置消息内容是纯文本地点摘要。
- 位置消息可收藏、引用、转发；合并转发中显示为 `[位置]`。
