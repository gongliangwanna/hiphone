# src/apps/AIAppBuilder/ 规范

## 不变量

1. AI 工坊调用模型时只读取全局 `useAIConfigStore`。不要再增加独立的工坊 API Key、端点、模型或 maxTokens 覆盖配置。
2. 设置页中 AI 工坊不应有专用 API/模型入口；用户统一在「AI 设置」中维护供应商、API Key、端点和模型。

## 踩坑

1. 旧版曾有 `aiAppBuilderConfigStore.modelOverride` 和「工坊代码模型」设置页，会造成两套 API 配置并存。后续如果需要“代码模型更强”的能力，应先重新设计全局模型分工，而不是恢复工坊私有配置。
