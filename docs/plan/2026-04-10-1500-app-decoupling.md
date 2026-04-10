# App 解耦重构计划

## 用户需求

当前每新增一个 App 需要同时修改 3 个文件（`apps.data.ts`、`AppScene.tsx`、App 目录本身），且各 App 入口存在重复的生命周期样板代码。目标是让 App 之间更解耦，添加新 App 时只需在 App 自身目录下操作，无需修改任何中心文件。

## 现状分析

### 当前耦合点

1. **`src/apps/AppScene.tsx`** — 硬编码 if/else 路由，每个 App 一条 import + 一个分支
2. **`src/shell/Springboard/apps.data.ts`** — 硬编码 AppInfo 数组，元数据与实现分离
3. **Dock 别名 ID** — `safari-dock`、`music-dock` 等假 ID 散落在 AppScene 和 apps.data 中
4. **`wasAppKilled` 样板** — 每个 App 重复 6 行相同的 useEffect 代码
5. **全量同步 import** — 所有 App 组件在首屏同步加载，无按需加载

### 当前新增 App 的步骤

1. 创建 `src/apps/NewApp/NewAppApp.tsx`
2. 在 `src/apps/AppScene.tsx` 添加 import + if 分支
3. 在 `src/shell/Springboard/apps.data.ts` 的数组中添加元数据
4. 在 `src/apps/CLAUDE.md` 的表格中添加记录
5. 如果是 Dock App，还要在 dockApps 中添加 `-dock` 后缀的别名

## 关键决策

### 决策 1: 使用 App Manifest 模式

每个 App 在自己的目录下声明一个 `manifest.ts`，包含元数据 + 组件引用。理由：
- **就近原则**：App 的所有信息在同一个目录内
- **编译期一致性**：元数据和实现由同一个文件管理，不会不一致
- **可选参与**：未实现的 App（如 Messages）不需要 manifest，继续用 DemoApp 兜底

### 决策 2: 使用 Vite `import.meta.glob` 自动发现

不用手动 import 或集中注册表。理由：
- **零手动维护**：新增 App 只需放对文件名（`manifest.ts`），构建工具自动收集
- **Vite 原生支持**：无需额外依赖
- **eager 模式**：manifest 体积极小（元数据 + lazy 引用），eager 加载不影响性能

### 决策 3: 组件使用 React.lazy 按需加载

manifest 中的 component 字段使用 `React.lazy()`。理由：
- **首屏优化**：只加载当前打开的 App 代码
- **与 Suspense 配合**：AppScene 外层包一个 Suspense，提供加载态

### 决策 4: Dock 不再使用别名 ID

Dock 改为引用真实 App ID，在 Springboard 配置层声明 Dock 槽位。理由：
- **消除 ID 重复**：`safari` 和 `safari-dock` 是同一个 App，不应有两个 ID
- **简化路由**：AppScene 不再需要 `appId === 'safari' || appId === 'safari-dock'`

### 决策 5: 提供 `useAppLifecycle` hook

封装 `wasAppKilled` + `clearAppKilled` 逻辑。理由：
- **消除 6 行样板**：变成 1 行调用
- **防遗漏**：新 App 作者不需要知道 killed 机制的细节

## 实施方案

### 阶段 1: 建立 Registry 基础设施

**涉及文件（新增）：**
- `src/apps/registry.ts` — AppManifest 接口 + registry 构建逻辑
- `src/platform/hooks/useAppLifecycle.ts` — 生命周期 hook

**`AppManifest` 接口定义：**

```typescript
// src/apps/registry.ts
import type { LazyExoticComponent, ComponentType } from 'react';

export interface AppManifest {
  /** 唯一标识，与 Springboard 中的 id 一致 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标路径 */
  icon: string;
  /** React.lazy 包装的组件 */
  component: LazyExoticComponent<ComponentType>;
  /** Springboard 页码，默认 0 */
  page?: number;
  /** 分类 */
  category?: 'system' | 'cn-popular';
}

// Vite auto-discovery
const manifestModules = import.meta.glob<{ manifest: AppManifest }>(
  './*/manifest.ts',
  { eager: true }
);

const registry = new Map<string, AppManifest>();
for (const mod of Object.values(manifestModules)) {
  registry.set(mod.manifest.id, mod.manifest);
}

export function getAppManifest(id: string): AppManifest | undefined {
  return registry.get(id);
}

export function getAllManifests(): AppManifest[] {
  return [...registry.values()];
}
```

**`useAppLifecycle` hook：**

```typescript
// src/platform/hooks/useAppLifecycle.ts
import { useEffect } from 'react';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';

export function useAppLifecycle(appId: string, reset: () => void) {
  useEffect(() => {
    if (wasAppKilled(appId)) {
      reset();
      clearAppKilled(appId);
    }
  }, [appId, reset]);
}
```

**验证标准：**
- registry.ts 编译通过
- useAppLifecycle hook 单测通过

---

### 阶段 2: 为现有 9 个 App 创建 manifest

**涉及文件（新增）：**
- `src/apps/Settings/manifest.ts`
- `src/apps/Weather/manifest.ts`
- `src/apps/Notes/manifest.ts`
- `src/apps/Calendar/manifest.ts`
- `src/apps/Maps/manifest.ts`
- `src/apps/Music/manifest.ts`
- `src/apps/Camera/manifest.ts`
- `src/apps/Safari/manifest.ts`
- `src/apps/Photos/manifest.ts`

**manifest 模板：**

```typescript
// src/apps/Maps/manifest.ts
import { lazy } from 'react';
import type { AppManifest } from '../registry';

export const manifest: AppManifest = {
  id: 'maps',
  name: '地图',
  icon: '/resource/icons/ios-system/maps.jpg',
  component: lazy(() => import('./MapsApp').then(m => ({ default: m.MapsApp }))),
  page: 0,
  category: 'system',
};
```

**同时改造每个 App 的入口组件：**
- 将 `wasAppKilled` 样板替换为 `useAppLifecycle(appId, reset)`

**验证标准：**
- 9 个 manifest 全部被 registry 自动发现（写单测验证 registry.size >= 9）
- 所有 App 功能不变

---

### 阶段 3: AppScene 改用 Registry 路由

**涉及文件（修改）：**
- `src/apps/AppScene.tsx` — 从 if/else 改为 registry 查找

**改造后代码：**

```typescript
// src/apps/AppScene.tsx
import { Suspense } from 'react';
import { getAppManifest } from './registry';
import { DemoApp } from './DemoApp';

interface AppSceneProps {
  appId: string;
}

export function AppScene({ appId }: AppSceneProps) {
  const manifest = getAppManifest(appId);

  if (!manifest) {
    return <DemoApp appId={appId} />;
  }

  const Component = manifest.component;
  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  );
}
```

**验证标准：**
- 删除 AppScene 中所有硬编码 import 和 if 分支
- 所有已实现 App 正常打开和渲染
- 未实现 App 仍显示 DemoApp

---

### 阶段 4: 消除 Dock 别名 ID

**涉及文件（修改）：**
- `src/shell/Springboard/apps.data.ts` — dockApps 使用真实 ID
- `src/platform/stores/appRuntimeStore.ts` — 如有别名处理逻辑需清理
- 相关测试文件

**改造点：**
- `safari-dock` → `safari`，`music-dock` → `music`，`messages-dock` → `messages`
- dockApps 加 `isDock: true` 保留，但 id 不再带 `-dock` 后缀
- 检查 appRuntimeStore 中是否有别名相关逻辑并清理

**验证标准：**
- Dock 点击打开的 App 与 Springboard 图标点击的是同一个实例
- AppSwitcher 中不会出现同 App 的重复卡片
- 全部现有测试通过

---

### 阶段 5: Springboard 数据源接入 Registry

**涉及文件（修改）：**
- `src/shell/Springboard/apps.data.ts` — 已实现 App 从 registry 读取，未实现 App 保留静态声明

**策略：**
- `apps.data.ts` 中保留未实现 App 的纯元数据（它们没有 manifest）
- 已实现 App 的元数据从 registry 获取，确保单一数据源
- 导出的 `apps` 数组 = registry manifests + 静态未实现 apps，按 page 排序
- `getAppInfoById` 优先查 registry，fallback 到静态数据

**验证标准：**
- Springboard 显示所有 App（已实现 + 未实现）
- 修改 manifest 中的 name 能直接反映到 Springboard 上
- 全部测试通过

---

### 阶段 6: 更新文档

**涉及文件（修改）：**
- `src/apps/CLAUDE.md` — 更新规范，说明 manifest 模式
- 删除手动维护的 App 表格，说明 manifest 即文档

## 新增 App 的新流程（改造后）

```
1. 创建 src/apps/NewApp/NewAppApp.tsx （App 组件）
2. 创建 src/apps/NewApp/manifest.ts   （声明元数据 + lazy 组件）
3. 完成。
```

无需修改任何其他文件。Registry 自动发现，AppScene 自动路由，Springboard 自动展示。

## 风险与注意事项

1. **Suspense fallback 体验**：lazy 加载会有短暂空白，需要测试加载速度是否可接受。如果不可接受，可用轻量骨架屏替代 `fallback={null}`。
2. **测试环境兼容**：`import.meta.glob` 是 Vite 特性，vitest 原生支持，但需确认测试中 glob 路径解析正常。
3. **Dock 别名消除的影响面**：需全局搜索 `safari-dock`、`music-dock`、`messages-dock` 确保无遗漏引用。
4. **已有 localStorage 持久化 key**：App store 的 persist key（如 `hiPhone-notes`）不受影响，无需迁移。
