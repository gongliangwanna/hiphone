# 可爱信 — 消息长按操作功能设计

## 需求概述

在可爱信聊天页面（ChatDetail）支持对消息长按，弹出操作菜单。支持复制、收藏、引用、转发、多选、删除六个操作。多选模式下支持逐条转发、合并转发、批量收藏、批量删除。引用消息对 AI 可见，UI 上呈现微信风格的可视化设计。转发以卡片形式发送，点击可查看详情。

## 消息数据模型重构

将现有 Message 接口从扁平可选字段模式重构为 Discriminated Union 模式。

### MessageBase（公共基础字段）

```typescript
interface MessageBase {
  id: string;
  convId: string;
  senderId: string;
  timestamp: number;
  streaming?: boolean;
  proactive?: boolean;
  quoteRef?: QuoteRef; // 任何消息类型都可以携带引用
}

interface QuoteRef {
  msgId: string;
  senderId: string;
  preview: string;        // 被引用消息的文本摘要
  type: 'text' | 'image' | 'sticker' | 'note' | 'song';
}
```

### 各消息类型

```typescript
interface TextMessage extends MessageBase {
  type: 'text';
  text: string;
  noteRef?: { noteId: string; title: string; body: string };
  songRef?: { songId: string; title: string; artist: string; artworkUrl: string };
}

interface ImageMessage extends MessageBase {
  type: 'image';
  imageUrl: string;
}

interface StickerMessage extends MessageBase {
  type: 'sticker';
  stickerUrl: string;
  stickerDesc?: string;
}

interface ForwardCardMessage extends MessageBase {
  type: 'forward_card';
  forwardCard: {
    title: string;            // "我和 xxx 的聊天记录"
    messages: ForwardedMsg[]; // 完整消息列表
    preview: string[];        // 前 3-4 条摘要文本
  };
}

interface HeartbeatLogMessage extends MessageBase {
  type: 'heartbeat_log';
  text: string;
}

type Message = TextMessage | ImageMessage | StickerMessage
  | ForwardCardMessage | HeartbeatLogMessage;
```

### ForwardedMsg（转发卡片内的消息结构）

```typescript
interface ForwardedMsg {
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'sticker';
  text?: string;
  imageUrl?: string;
  stickerUrl?: string;
  timestamp: number;
}
```

## 长按菜单（MessageActionBar）

### 触发方式
- 使用现有 `useLongPress` hook（600ms 阈值）
- 绑定在消息气泡区域

### UI 设计
- 深色横排工具条（背景 `#3A3A3C`，圆角 12px）
- 出现在气泡上方（空间不足时显示在下方）
- 六个图标+文字：复制 | 收藏 | 引用 | 转发 | 多选 | 删除
- 无背景遮罩，无底部三角箭头
- 图标使用 lucide-react
- 点击菜单外任意区域关闭

### 动画
- 弹出：opacity 0→1 + scale 0.9→1，100ms ease-out
- 消失：opacity 1→0，80ms

### 消息类型与操作矩阵

| 操作 | text | image | sticker | noteRef/songRef | forward_card |
|------|------|-------|---------|-----------------|--------------|
| 复制 | Yes  | No    | No      | Yes(复制文本)    | No           |
| 收藏 | Yes  | Yes   | Yes     | Yes             | Yes          |
| 引用 | Yes  | Yes   | Yes     | Yes             | No           |
| 转发 | Yes  | Yes   | Yes     | Yes             | Yes          |
| 多选 | Yes  | Yes   | Yes     | Yes             | Yes          |
| 删除 | Yes  | Yes   | Yes     | Yes             | Yes          |

heartbeat_log 类型消息不显示长按菜单。

### 各操作即时行为

- **复制**：写入剪贴板 → Toast "已复制" → 关闭菜单
- **收藏**：存入收藏数据 → Toast "已收藏" → 关闭菜单
- **引用**：关闭菜单 → 输入框上方出现引用预览条
- **转发**：关闭菜单 → push 进联系人选择页
- **多选**：关闭菜单 → 进入多选模式，当前消息自动选中
- **删除**：确认弹窗 → 删除消息 → 关闭菜单

## 引用（Quote）

### 输入区引用预览条
- 位置：输入框上方，紧贴输入框
- 样式：白色圆角卡片，左侧回复图标（蓝色），中间显示 "发送者名: 消息摘要"，右侧 X 关闭按钮
- 引用图片/贴纸时，preview 文本为 "[图片]" / "[贴纸]"
- 点击 X 取消引用

### 发送后气泡内引用块
- 位置：气泡内正文上方
- 样式：半透明圆角小块（自己的气泡用 `rgba(255,255,255,0.18)`，对方的气泡用 `rgba(0,0,0,0.06)`）
- 显示发送者名 + 消息摘要，单行截断
- 点击引用块：滚动定位到原消息，高亮闪烁（使用现有 highlight 动画）

### AI 可见格式
用户引用一条消息并输入回复时，发送给 AI 的文本格式为：
- 引用文本消息：`[引用: 今天天气真好] 是啊`
- 引用图片消息：`[引用: [图片]] 是啊`
- 引用贴纸消息：`[引用: [贴纸: {stickerDesc}]] 是啊`
- 引用笔记/音乐：`[引用: [笔记: {title}]] 是啊` / `[引用: [音乐: {title}]] 是啊`

## 多选模式

### 进入方式
长按菜单点击"多选"，当前长按的消息自动选中。

### UI 变化
- 每条消息（heartbeat_log 除外）左侧出现圆形复选框（iOS 原生风格：未选为灰色空心圆，选中为蓝色实心 + 白色对勾 SVG）
- 输入区隐藏，底部替换为操作工具栏
- 顶部导航栏标题变为"已选择 N 条"，左上角变为"取消"按钮
- 点击消息行或复选框切换选中状态

### 底部工具栏
四个按钮横排：逐条转发 | 合并转发 | 收藏 | 删除

- 图标使用 lucide-react，蓝色（删除为红色 `#FF3B30`）
- 未选择任何消息时按钮置灰不可用

### 操作行为
- **逐条转发**：push 进联系人选择页 → 选择后每条消息按原格式单独发送 → 退出多选
- **合并转发**：push 进联系人选择页 → 选择后打包为 forward_card 消息发送 → 退出多选
- **收藏**：批量收藏选中消息 → Toast "已收藏 N 条" → 退出多选
- **删除**：确认弹窗 → 删除选中消息 → 退出多选

## 转发

### 单条转发
从长按菜单点击"转发" → push 进全屏联系人选择页 → 选择目标后，以原消息格式直接发送给目标角色。

### 联系人选择页
- 全屏页面，push 进导航栈
- 展示最近聊天列表 + 联系人列表
- 支持搜索
- 选择后确认转发

### 合并转发卡片
- 消息类型：`forward_card`
- 卡片样式：白色圆角卡片（18px），标题 "我和 xxx 的聊天记录"，下方预览前 3 条消息摘要（灰色小字），底部分割线 + "聊天记录" 标签
- 点击卡片 → push 进全屏查看页，展示所有转发的消息（只读列表）

## 收藏数据存储

### 数据模型

```typescript
interface Favorite {
  id: string;
  messageId: string;
  convId: string;
  senderId: string;
  senderName: string;
  type: Message['type'];
  content: {
    text?: string;
    imageUrl?: string;
    stickerUrl?: string;
    noteRef?: { noteId: string; title: string; body: string };
    songRef?: { songId: string; title: string; artist: string; artworkUrl: string };
    forwardCard?: ForwardCardMessage['forwardCard'];
  };
  timestamp: number;      // 原消息时间
  favoritedAt: number;    // 收藏时间
}
```

### 存储位置
在 `xingYuDataStore` 中新增 `favorites: Favorite[]` 字段，跟随现有 Zustand persist 机制持久化。

### 方法
- `addFavorite(msg: Message)` — 收藏单条
- `addFavorites(msgs: Message[])` — 批量收藏
- `removeFavorite(id: string)` — 取消收藏

收藏查看入口已在"我的"页面中存在，本次不需要额外开发查看页面。

## 新增组件清单

| 组件 | 位置 | 职责 |
|------|------|------|
| `MessageActionBar` | `components/MessageActionBar.tsx` | 长按弹出的工具条 |
| `QuotePreview` | `components/QuotePreview.tsx` | 输入框上方的引用预览条 |
| `QuoteBlock` | `components/QuoteBlock.tsx` | 气泡内的引用块 |
| `MultiSelectToolbar` | `components/MultiSelectToolbar.tsx` | 多选模式底部工具栏 |
| `ForwardCardBubble` | `components/ForwardCardBubble.tsx` | 转发卡片气泡渲染 |
| `ForwardDetailPage` | `pages/ForwardDetail.tsx` | 转发卡片点击后的全屏查看页 |
| `ContactSelectPage` | `pages/ContactSelect.tsx` | 转发目标选择页（全屏） |

## 状态管理

### ChatDetail 组件本地状态
```typescript
// 长按菜单
const [actionMenuMsg, setActionMenuMsg] = useState<Message | null>(null);
const [menuPosition, setMenuPosition] = useState<'above' | 'below'>('above');

// 引用
const [quoteMsg, setQuoteMsg] = useState<Message | null>(null);

// 多选模式
const [multiSelectMode, setMultiSelectMode] = useState(false);
const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
```

### xingYuDataStore 新增
```typescript
// 收藏
favorites: Favorite[];
addFavorite(msg: Message): void;
addFavorites(msgs: Message[]): void;
removeFavorite(id: string): void;

// 消息删除（已有 deleteConversation，新增单条/批量删除）
deleteMessages(msgIds: string[]): void;

// 转发
forwardMessage(msg: Message, targetConvId: string): void;
forwardMessages(msgs: Message[], targetConvId: string): void;  // 逐条
forwardAsCard(msgs: Message[], targetConvId: string, title: string): void;  // 合并
```

### xingYuNavStore 新增页面
```typescript
// page 新增值：'forward-detail' | 'contact-select'
// 新增状态
forwardCardMessages: ForwardedMsg[] | null;  // 转发详情页数据
pendingForward: { msgs: Message[]; mode: 'single' | 'batch' | 'merge' } | null;  // 待转发数据
```

## Mockup 参考
设计 mockup 保存在 `.superpowers/brainstorm/40019-1776353282/content/all-mockups-v2.html`，可在本地浏览器打开查看。
