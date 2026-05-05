# 2026-05-03 17:43 Cloudflare Pages 生产分支部署修正

## 用户需求

用户反馈 `https://mini-iphone.pages.dev/` 上的 App Store 仍不支持 PDF 载体安装，怀疑“最新代码已经支持 PDF，但线上稳定域名没有生效”。

## 现象与证据

1. 当前代码中 App Store 上传入口已允许 `.pdf`：
   - `DropZoneView.tsx` 的 file input `accept` 包含 `.zip,.pdf,application/zip,application/pdf,application/octet-stream`
   - `DropZoneView.test.tsx` 已覆盖 `.pdf` 选择 passthrough
   - `installer.test.ts` 已覆盖 `.pdf` 文件名和 `application/pdf` MIME 但内容为 zip payload 的安装路径
2. 本地最新 `dist/index.html` 加载 `assets/index-BHP_GJ-U.js`。
3. 最新预览部署 `https://8e1d8e1b.mini-iphone.pages.dev` 加载 `assets/index-BHP_GJ-U.js`。
4. 稳定域名 `https://mini-iphone.pages.dev/` 仍加载旧资源 `assets/index-HULDvyxa.js`。
5. `wrangler pages deployment list --project-name mini-iphone` 显示最新部署 `8e1d8e1b` 是 `Preview` 环境，分支为 `feat/m1-architecture`；生产环境分支为 `main`。

## 根因

上一轮从当前本地分支 `feat/m1-architecture` 执行 `wrangler pages deploy`，Cloudflare Pages 将其识别为分支预览部署。它更新了 preview URL 和分支 alias，但没有更新稳定生产域名 `mini-iphone.pages.dev`。

## 关键决策

1. 重新部署同一份最新 `dist/`，显式指定 `--branch main`，让 Cloudflare Pages 创建 `Production` 部署。
2. 部署后验证稳定域名的入口资源是否切换到 `assets/index-BHP_GJ-U.js`。
3. 使用页面资源内容验证 PDF 支持：稳定域名的 JS bundle 中应包含 `.zip,.pdf,application/zip,application/pdf,application/octet-stream`。
4. 更新项目内 Cloudflare Pages 部署 SOP，将命令改为显式 `--branch main`，避免以后在 feature branch 上误发 preview。

## 交付清单

- 生产分支重新部署成功。
- 稳定域名加载最新入口资源。
- 稳定域名 bundle 包含 App Store PDF accept 配置。
- 更新 `CLAUDE.md` 和 `docs/skills/hiphone-cloudflare-pages-deploy/` 部署文档。

## 测试计划

1. `npx -y wrangler pages deploy dist --project-name mini-iphone --branch main --commit-dirty=true` 成功。
2. `wrangler pages deployment list` 显示最新部署为 `Production` / `main`。
3. `curl https://mini-iphone.pages.dev/?ts=<timestamp>` 返回 200，入口 JS 为最新构建 hash。
4. 抓取稳定域名入口 JS，确认包含 PDF 上传 accept 配置。
