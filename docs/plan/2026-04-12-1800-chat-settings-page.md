# 可爱信 聊天设置页面

## 需求
在聊天详情页右上角添加三个点按钮（MoreHorizontal），点击后进入聊天设置界面。支持：
1. 修改聊天背景图片（per-conversation）
2. 修改联系人备注名
3. 创建群聊

## 关键决策
1. Per-conversation 设置存储在 Conversation 接口上（`backgroundUrl`、`remarkName`、`groupName`、`groupMemberIds`），利用 Zustand persist 自动持久���
2. 导航采用 `closeChatSettings() → page: 'chat-detail'` 模式，从聊天设置返回��天详情而非根页���
3. 从 Settings.tsx 提取 PickerSheet 为共享组件 `components/PickerSheet.tsx`，避免重复代码
4. 群聊数据存储在 Conversation 对象上，不修改静态 IDOLS 数组

## 修改文件
- `data.ts` — Conversation 接口添加 4 个可选字段
- `xingYuDataStore.ts` — 新增 `updateConversationSettings`、`createGroupConversation` actions
- `xingYuNavStore.ts` — 新增 `openChatSettings`、`closeChatSettings`
- `components/PickerSheet.tsx` — 从 Settings.tsx 提取的共享组件（新文件）
- `pages/ChatSettings.tsx` — 聊天设置页面（新文件）
- `pages/Settings.tsx` — 改用共享 PickerSheet
- `XingYuApp.tsx` — 注册 chat-settings 路由
- `pages/ChatDetail.tsx` — 三个点按钮 + 聊天背景 + 备注名显示 + 群聊 peer 解析
- `tabs/ChatListTab.tsx` — 备注名显示 + 群聊 peer 解析
