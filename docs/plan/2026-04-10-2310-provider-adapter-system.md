# Provider Adapter 架构 — OpenRouter & SiliconFlow

**日期**: 2026-04-10
**需求**: 去掉所有硬编码供应商，逐个适配真实 API。第一批：OpenRouter + 硅基流动。支持拉取模型列表、模型搜索、保存配置。

## 用户需求

1. 去掉 aiConfigStore 中 13 个硬编码供应商
2. 先支持 OpenRouter 和 硅基流动（SiliconFlow）
3. 支持从 API 拉取实时模型列表
4. 支持模型搜索/筛选
5. 保存用户选择的供应商、API Key、模型等配置

## 关键决策

### 1. Provider Adapter 抽象

每个供应商实现统一接口，核心能力：fetchModels。后续扩展 chat completions。

```typescript
interface ProviderAdapter {
  id: string;
  label: string;
  defaultEndpoint: string;
  fetchModels(apiKey: string, endpoint: string): Promise<ModelInfo[]>;
}

interface ModelInfo {
  id: string;        // 传给 API 的模型 ID
  name: string;      // 展示名称
  contextLength?: number;
  pricing?: { prompt: string; completion: string };
  ownedBy?: string;
}
```

### 2. 两家 API 差异

| | OpenRouter | SiliconFlow |
|---|---|---|
| Models 端点 | `GET /api/v1/models` | `GET /v1/models?sub_type=chat` |
| 需要鉴权 | **不需要**（公开） | **需要** Bearer token |
| 响应丰富度 | 丰富（name, pricing, context_length） | 极简（id, owned_by） |
| CORS | 完全开放 | 完全开放 |
| 特殊 Header | HTTP-Referer, X-Title（可选） | 无 |

### 3. Store 设计

aiConfigStore 精简为：
- `provider`: 'openrouter' | 'siliconflow'（后续逐步加）
- `apiKey`, `apiEndpoint`, `model` — 连接配置
- `fetchedModels: ModelInfo[]` — 从 API 拉取的模型列表
- `modelListLoading`, `modelListError` — 拉取状态
- 生成参数、记忆策略等保持不变

### 4. UI 设计

AIServicePage 重写：
- 供应商选择（2 项卡片式）
- API Key 输入 + 端点输入
- "拉取模型" 按钮 → 展示模型列表
- 搜索栏过滤模型
- 选中模型用 ✓ 标记

## 文件变更

| 文件 | 操作 |
|---|---|
| `src/platform/ai/providers.ts` | 新建 — adapter 接口 + OpenRouter/SiliconFlow 实现 |
| `src/platform/stores/aiConfigStore.ts` | 重写 — 去掉 13 provider，加动态模型 |
| `src/apps/Settings/pages/AIServicePage.tsx` | 重写 — 新 UI |

## 里程碑

本次：OpenRouter + SiliconFlow（模型拉取 + 搜索 + 配置保存）
后续：逐步加 DeepSeek、Qwen、Moonshot 等（每次一个 adapter）
