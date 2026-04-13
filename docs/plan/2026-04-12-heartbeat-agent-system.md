# EA 心跳自主行为系统

## 用户需求
AI 角色在可配置的定时器触发下自主执行操作：发消息、发星球动态、点赞评论、更新签名。每次心跳运行一个 ReAct agent 循环，角色自主决定做什么。

## 关键决策

### ReAct 文本协议 vs Native Function Calling
选择文本格式（Thought/Action/ActionInput）而非 native function calling，确保兼容所有 provider/model（OpenRouter、SiliconFlow 等）。

### send_message 绕过 sendMessage()
心跳发消息直接写 store（setState），避免触发 scheduleIdolReply 导致 AI 自我回复循环。设 `proactive: true` 标记 + `unread + 1` 让用户看到红点。

### 串行执行 + 每次心跳只发 1 条消息
防止多角色并发导致 API 竞争和成本失控。消息限流避免骚扰用户。

### KV 缓存友好
System message 放角色设定 + 工具描述（稳定），User message 放时间/天气/状态（变化）。

## 新增文件

| 文件 | 职责 |
|------|------|
| `src/platform/stores/heartbeatStore.ts` | Zustand persist store：全局开关、每角色配置、运行时状态、操作日志 |
| `src/platform/ai/heartbeatTools.ts` | 7 个工具定义 + 执行器（映射 xingYuDataStore mutations） |
| `src/platform/ai/heartbeatPrompt.ts` | 系统提示词组装（角色设定 + 工具 + ReAct 格式） |
| `src/platform/ai/heartbeatAgent.ts` | ReAct 循环引擎 + 30s 间隔调度器 + Visibility API |
| `src/apps/Settings/pages/HeartbeatSettingsPage.tsx` | 设置 UI：全局开关、每角色配置、操作日志 |

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/apps/XingYu/data.ts` | Message 加 `proactive?: boolean` |
| `src/apps/XingYu/components/MomentCard.tsx` | 支持 `char-xxx` 作者/评论者解析 |
| `src/apps/Settings/SettingsApp.tsx` | 注册 heartbeat 页面 |
| `src/apps/Settings/SettingsHome.tsx` | 添加心跳系统入口 |
| `src/App.tsx` | 启动心跳调度器 |

## 验证方式
1. 设置 → 心跳系统 → 启用全局开关 → 启用某角色 → 间隔设为 15 分钟
2. 点击"立即触发"手动测试
3. 观察聊天列表未读红点、星球动态、签名变化
4. 检查操作日志
