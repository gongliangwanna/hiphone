# 角色星球签名系统

## 日期: 2026-04-12

## 用户需求
1. 星球 Profile 卡只展示名字，去掉标签（personality tag badge）
2. 个性签名不是角色设定（description），默认为"还没有个性签名"
3. 提示词中新增 `{"type":"signature","text":"签名内容"}` 工具，AI 可修改自己的个性签名
4. 个性签名有历史记录功能，可查看历史签名（提示 AI 不要改太频繁）
5. 用户（玩家）同样有签名历史功能

## 关键决策

### 数据存储
- 角色签名存在 `xingYuDataStore` 中：`characterSignatures: Record<characterId, { current: string; history: SignatureRecord[] }>`
- 用户签名历史也存在 `xingYuDataStore` 中：`userSignatureHistory: SignatureRecord[]`
- `SignatureRecord = { text: string; timestamp: number }`
- 持久化版本 bump 到 2，migrate 时初始化新字段

### AI 工具
- replyParser.ts 新增 `ReplySignatureItem: { type: 'signature'; text: string }`
- promptAssembly.ts 的回复格式指令中加入签名工具说明 + "不要频繁更换"的限制
- xingYuDataStore.ts 的 AI 回复处理中，识别 signature 类型并调用 `updateCharacterSignature`
- signature 更新不产生聊天气泡，是静默操作

### UI 改动
- IdolProfile.tsx：移除 title tag badge，显示签名，加签名历史展开区域
- ProfileTab.tsx（用户我的页面）：也展示签名历史

## 涉及文件
- `src/platform/ai/replyParser.ts` — 新增 signature 类型解析
- `src/platform/ai/promptAssembly.ts` — 提示词加签名工具
- `src/apps/XingYu/xingYuDataStore.ts` — 签名数据存储 + AI 回复处理
- `src/apps/XingYu/pages/IdolProfile.tsx` — Profile UI 改版
- `src/apps/XingYu/tabs/ProfileTab.tsx` — 用户签名历史
