# 微信 App 开发计划

## 日期
2026-04-10

## 用户需求
1:1 复刻 iOS 微信，作为 hiPhone 项目的第三方 App 实现。

## 功能范围

### 底部 Tab 导航（4个标签）
- **微信** (Chats): 聊天列表，搜索栏，消息预览，未读角标，置顶聊天
- **通讯录** (Contacts): 功能入口（新的朋友/群聊/标签/公众号）+ 按拼音首字母分组的联系人列表
- **发现** (Discover): iOS 分组列表风格，朋友圈/视频号/扫一扫/搜一搜等入口
- **我** (Me): 个人资料卡片 + 分组设置列表（服务/收藏/朋友圈/设置等）

### 子页面
- **聊天详情** (ChatDetail): 消息气泡视图 + 底部输入框 + 返回导航

## 关键决策

### 1. 导航模型
采用 Tab + Stack 混合导航：
- 根层级显示 TabBar，切换 Tab 无动画（iOS 原生行为）
- 进入子页面（如聊天详情）时隐藏 TabBar，全屏显示，使用 push/pop slide 动画
- Store 维护: `activeTab` + `page`(null=根) + `activeChatId`

### 2. TabBar 实现
在 App 内部实现 TabBar 组件（非 system 级），因为：
- 这是 WeChat 特有的样式（WeChat 绿 #07C160）
- 目前项目中无其他 Tab App 需要复用
- 后续如需提取为 system 组件可轻松重构

### 3. 数据方案
使用静态 Mock 数据，不涉及网络请求：
- 聊天列表: 12+ 条模拟对话
- 联系人: 30+ 个按拼音分组的联系人
- 聊天消息: 每个对话 5-10 条模拟消息

### 4. 视觉规范
- Tab 激活色: #07C160 (WeChat 品牌绿)
- Tab 未激活色: #999999
- 发送气泡: #95EC69 (WeChat 绿色气泡)
- 接收气泡: white
- 聊天背景: var(--color-secondarySystemBackground)
- 头像: 基于名字 hash 生成彩色占位圆形 + 首字
- 所有 Tab 图标: SF Symbol 描边风格

### 5. 文件结构
```
src/apps/WeChat/
├── WeChatApp.tsx          # 主组件，Tab + Stack 导航
├── wechatStore.ts         # Zustand 导航 store
├── data.ts                # Mock 数据
├── TabBar.tsx             # 底部标签栏
├── tabs/
│   ├── ChatsTab.tsx       # 聊天列表
│   ├── ContactsTab.tsx    # 通讯录
│   ├── DiscoverTab.tsx    # 发现
│   └── MeTab.tsx          # 我
└── pages/
    └── ChatDetail.tsx     # 聊天详情
```
