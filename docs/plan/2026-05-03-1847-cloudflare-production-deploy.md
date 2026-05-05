# 2026-05-03 18:47 Cloudflare Pages 生产部署

## 用户需求

用户说明“又改了一些代码 部署 cloudfare”，要求将当前工作区的最新 hiPhone 代码部署到 Cloudflare Pages。

## 关键决策

1. 按已修正的 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md` 执行生产部署流程。
2. 部署目标为 Cloudflare Pages 项目 `mini-iphone`，稳定访问地址为 `https://mini-iphone.pages.dev/`。
3. 显式使用 `--branch main`，确保 Cloudflare Pages 创建 `Production / main` 部署，而不是当前本地 feature branch 的 Preview 部署。
4. 当前工作区包含用户新增改动和既有未跟踪产物；本次只构建和部署现状，不清理、不回退任何文件。
5. 如果 `pnpm build` 失败，停止部署，避免发布旧 `dist/`。

## 交付清单

- 检查 Wrangler 登录状态和 Pages 权限。
- 执行 `pnpm build` 生成最新 `dist/`。
- 执行 `npx -y wrangler pages deploy dist --project-name mini-iphone --branch main --commit-dirty=true`。
- 验证稳定域名可访问，并确认稳定域名 HTML 入口资源与本地最新 `dist/index.html` 一致。

## 测试计划

1. `npx -y wrangler whoami` 成功。
2. `pnpm build` 成功。
3. Cloudflare Pages 部署命令成功，且部署列表最新记录为 `Production / main`。
4. `https://mini-iphone.pages.dev/?ts=<timestamp>` 返回 200，页面标题为 `hiPhone`。
5. 稳定域名入口 JS/CSS hash 与本地 `dist/index.html` 一致。
