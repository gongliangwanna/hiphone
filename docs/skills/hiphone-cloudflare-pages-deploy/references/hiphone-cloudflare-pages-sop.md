# hiPhone -> Cloudflare Pages SOP

## 适用范围

这份 SOP 只用于当前 hiPhone 项目发布到 Cloudflare Pages。

固定信息：
- 项目目录：`/Users/wanqilin/WorkSpace/ai/hiPhone`
- Pages 项目名：`mini-iphone`
- 生产分支：`main`
- 稳定访问地址：`https://mini-iphone.pages.dev/`
- 构建产物目录：`dist/`

## 这份 SOP 来自哪里

基于 2026-04-09 当天多次真实重部署操作整理。

这些实操里已经反复验证过：
1. `wrangler whoami` 能正常返回账号信息时，Pages 部署可用
2. `pnpm build` 成功后，直接发布 `dist/` 即可
3. 部署稳定域名时必须显式传 `--branch main`，否则在 feature branch 本地执行会创建 Preview 部署，不会更新 `https://mini-iphone.pages.dev/`
4. 验证阶段最好带时间戳参数，避免把缓存结果误判成最新版本

## 标准流程

### 第 1 步，进入项目目录

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
```

### 第 2 步，检查 Cloudflare 登录

```bash
npx -y wrangler whoami
```

预期：
- 能看到 Cloudflare 账号邮箱
- 能看到 account id
- 有 `pages (write)` 权限

当前已验证过的账号信息：
- email: `ssochicn@gmail.com`
- account id: `e80ec66618d4592554e1797ddf41fe6a`

注意：
- 输出里如果提示缺少 `ai-search:write`、`email_routing:write` 之类 scope，不影响 hiPhone 的 Pages 部署
- 只要 `pages (write)` 在，且命令整体成功，就可以继续

### 第 3 步，重新构建

```bash
pnpm build
```

预期：
- 运行 `tsc -b && vite build`
- 最终生成 `dist/index.html` 和 `dist/assets/*`

已多次出现但可接受的现象：
- Vite 提示某些 chunk 超过 500 kB
- 这是性能优化项，不是当前部署阻断项

硬规则：
- 如果 build 失败，不要继续把旧的 `dist/` 发上去，除非人明确要求

### 第 4 步，部署到 Cloudflare Pages

```bash
npx -y wrangler pages deploy dist --project-name mini-iphone --branch main --commit-dirty=true
```

说明：
- `dist` 是当前项目正确的静态发布目录
- `--branch main` 是为了让 Cloudflare Pages 创建 Production 部署并更新稳定域名
- `--commit-dirty=true` 是为了允许在本地有未提交改动时照常部署

预期输出：
- `Uploaded X files`
- `Deployment complete!`
- 一个部署链接，例如 `https://xxxxxxxx.mini-iphone.pages.dev`

注意：
- 如果部署列表里最新记录不是 `Production / main`，稳定域名不会更新
- 部署链接只用于本次发布记录
- 给用户或给外部使用时，优先发稳定域名，不要发一次性预览链接

### 第 5 步，验证稳定域名

优先验证：

```text
https://mini-iphone.pages.dev/
```

为了绕开缓存，建议带时间戳参数：

```text
https://mini-iphone.pages.dev/?ts=<当前时间戳>
```

建议检查项：
1. HTTP 状态码是 200
2. 页面标题仍然是 `hiPhone`
3. 稳定域名的 HTML 入口资源 hash 与本地 `dist/index.html` 一致
4. 如果有人反馈黑屏，再做一次视觉检查，而不只看 HTML 返回

### 第 6 步，黑屏排查补充

如果用户说“打开是黑屏”，不要只靠 `web_fetch` 判断。

建议再补两类检查：

#### 6.1 页面结构检查

看这些信号：
- `document.title` 是否为 `hiPhone`
- `#root` 是否存在
- `#root` 是否有内容

#### 6.2 视觉烟测

如果可用，直接用浏览器或截图服务看首屏。

在这次实操里，曾通过网页截图确认线上不是纯黑页，而是锁屏界面，能看到：
- 时间
- 运营商
- 底部手电筒和相机按钮

这说明：
- 某些“黑屏”反馈可能是用户端缓存、设备兼容或运行时覆盖层问题
- 不能只凭一句“黑了”就认定部署失败

## 对外回报模板

### 内部/终端式回报

```text
已重新构建并部署 hiPhone 到 Cloudflare Pages。
项目名：mini-iphone
稳定地址：https://mini-iphone.pages.dev/
```

### 微信回报

先发一条短说明，例如：

```text
部署好了，我刚验过链接能打开。
```

再单独发一条纯链接：

```text
https://mini-iphone.pages.dev/
```

原因：
- 微信里单独一条链接更容易直接点开
- 不要把链接埋进大段说明里

## 常见坑

### 1. 忘了先跑 `wrangler whoami`

后果：
- 到部署时才发现登录失效
- 排障节奏被打断

### 2. 验证时直接请求裸域名，拿到缓存结果

后果：
- 误以为新版本没生效

解决：
- 验证时优先加 `?ts=<timestamp>`

### 3. 把 preview URL 当最终地址发出去

后果：
- 人拿到的是一次性预览地址，不是长期稳定链接

解决：
- 对外统一发 `https://mini-iphone.pages.dev/`

### 4. 从 feature branch 部署后以为稳定域名更新了

后果：
- Cloudflare Pages 创建的是 Preview 部署，例如 `https://8e1d8e1b.mini-iphone.pages.dev`
- 分支 alias 也可能更新，但 `https://mini-iphone.pages.dev/` 仍指向旧 Production

解决：
- 稳定域名部署命令必须包含 `--branch main`
- 部署后用 `wrangler pages deployment list --project-name mini-iphone` 确认最新记录是 `Production / main`
- 再抓稳定域名 HTML，确认入口 JS/CSS hash 与本地 `dist/index.html` 一致

### 5. 用户说黑屏，就立刻认定部署坏了

后果：
- 结论过快
- 容易把缓存问题、端侧兼容问题、运行时遮罩问题混成“部署失败”

解决：
- 先做稳定域名验证
- 再做视觉烟测

## 最终检查清单

每次部署结束前，至少确认这 5 项：

- `wrangler whoami` 成功
- `pnpm build` 成功
- `wrangler pages deploy dist --project-name mini-iphone --branch main --commit-dirty=true` 成功
- `wrangler pages deployment list --project-name mini-iphone` 最新记录是 `Production / main`
- 稳定域名可访问
- 对外发送的是稳定域名，而不是 preview URL
