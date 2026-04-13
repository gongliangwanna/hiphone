# 可爱信表情包系统 — 微信风格（用户上传）

## 用户需求
- 表情包是用户自己上传的**图片**，不是预制的 emoji 或 SVG
- 参考**微信表情包**系统
- 支持**创建表情包、添加表情**
- 每个表情需要有**描述**，方便 AI 理解用户发了什么

## 关键决策

### 1. 数据模型
```typescript
interface Sticker {
  id: string;
  imageData: string;    // base64 data URL（用户上传后压缩存储）
  description: string;  // 描述文本，给 AI 看
}

interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}
```

### 2. 存储
- 存在 Zustand persist (localStorage) 中
- 上传时压缩图片到 ≤200KB（canvas resize + quality 调整）
- 单个表情包限制 30 张，防止 localStorage 爆满

### 3. 消息模型
```typescript
// 旧: stickerEmoji?: string
// 新: 存图片 data URL + 描述（消息独立于表情包，删包不影响历史消息）
stickerUrl?: string;
stickerDesc?: string;
```

### 4. 用户流程（参考微信）
1. 聊天界面点笑脸 → 打开表情包面板
2. 面板底部 tab 切换表情包 + "+" 管理
3. 管理页面：创建新表情包、查看已有包、删除包
4. 进入某个包 → 看到所有表情 + "添加表情"按钮
5. 添加表情：从相册选图/拍照 → 填写描述 → 保存
6. 发送：点击表情即发送

### 5. 聊天渲染
- 表情消息渲染为 `<img>`，宽度 ~120px
- 无气泡背景（微信风格）

### 6. AI 集成
- `[用户发送了一个表情包：{description}]`

## 改动文件清单

| 文件 | 操作 |
|------|------|
| `src/apps/XingYu/data.ts` | 修改：Sticker/StickerPack 接口、Message 接口 |
| `src/apps/XingYu/stickerStore.ts` | 新建：独立 store 管理表情包（避免主 store 太大） |
| `src/apps/XingYu/components/StickerPicker.tsx` | 重写：图片网格 + 管理 UI |
| `src/apps/XingYu/components/StickerManager.tsx` | 新建：表情包管理页面（创建包、添加表情、删除） |
| `src/apps/XingYu/pages/ChatDetail.tsx` | 修改：渲染 sticker 为 img、发送参数 |
| `src/apps/XingYu/xingYuDataStore.ts` | 修改：sendStickerMessage 参数 |
| `src/platform/ai/promptAssembly.ts` | 修改：用 stickerDesc |
