# AI 工坊操作展示与下载/安装入口修复计划

## 用户需求

用户明确要求：

1. AI 工坊聊天里每一个 agent 操作展示要等宽，避免 `write_file`、`list_files`、`compile_check` 等工具卡片因为内容长度不同而忽长忽短。
2. 右上角需要同时支持下载 app ZIP 包，以及直接安装或更新到桌面。
3. 注意 UI 排布，不能继续把下载图标误用成安装入口。

## 关键决策

1. 工具调用卡片采用固定响应式宽度：手机内不溢出，常规宽度保持一致；长路径/摘要单行截断，展开后再看完整 args/result。
2. 顶部导航栏保留纯图标工具按钮：草稿、下载 ZIP、安装/更新、新建。下载使用 `Download`，安装/更新使用 `Upload`，避免语义混淆。
3. 下载不离开 AI 工坊；安装/更新沿用 `installDraft`，根据 `InstallResult.isUpgrade` 显示“已安装”或“已更新”，成功后回桌面。
4. 为 NavBar 右侧按钮补 `ariaLabel`，方便可访问性和测试定位。

## 影响文件

- `src/apps/AIAppBuilder/AIAppBuilderApp.tsx`
- `src/apps/AIAppBuilder/BuilderChat.tsx`
- `src/apps/AIAppBuilder/__tests__/AIAppBuilderApp.test.tsx`
- `src/system/NavBar/NavBar.tsx`

## 验证计划

1. 增加组件测试确认顶部同时显示下载 ZIP 与安装/更新入口，点击分别调用对应能力。
2. 运行 `npm test -- src/apps/AIAppBuilder/__tests__ src/apps/AIAppBuilder/agent`。
3. 运行 `npm run typecheck`。
