# 删除推荐偶像 + 角色星球功能

## 日期: 2026-04-12

## 用户需求
1. 删除可爱信（XingYu）通讯录中的"推荐偶像"板块
2. 所有角色（character）都支持"星球"功能：点击头像可以查看角色的星球（个人主页）

## 关键决策

### 1. 删除推荐偶像
- 从 `ContactsTab.tsx` 中移除"推荐偶像"整个 section
- 移除 `IdolRow` 组件
- 清理未使用的 imports（`Star`, `IDOLS`, `Idol`, `ensureIdolConversation`）

### 2. 角色星球实现方式
- 复用现有 `IdolProfile` 页面，扩展其支持 character 数据
- `openIdol(id)` 导航方法同时接受 idol ID 和 character ID
- 在 `IdolProfile` 中，当 `getIdol()` 找不到时，尝试从 `characterStore` 中查找 character
- character 星球展示：头像、名称、description、personality，以及"发消息"按钮

### 3. 通讯录头像交互
- `CharacterRow` 拆分为两个交互区域：
  - 点击头像 → 打开角色星球（profile）
  - 点击行的其余部分 → 打开聊天
- 头像点击使用 `stopPropagation` 防止触发行点击

## 涉及文件
- `src/apps/XingYu/tabs/ContactsTab.tsx` — 删除推荐偶像，头像加 profile 导航
- `src/apps/XingYu/pages/IdolProfile.tsx` — 扩展支持 character 数据
