# src/apps/ — App Experience 层

## 规范
1. 每个 App 必须组合 `system/` 下的原子组件，不得自创基础组件（如自建 Sheet、自建 List）
2. App 内允许有自己的导航栈，但导航栏必须使用 `system/NavBar`
3. App 通过 `appRuntimeStore` 注册自己的打开/关闭状态
4. V1 只有 Settings 一个 App
