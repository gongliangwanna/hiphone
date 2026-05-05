# 2026-05-03 17:37 Cloudflare Pages 部署

## 用户需求

用户要求“将最新代码 部署cloudflare”。本次目标是在不修改业务代码的前提下，把当前工作区的最新 hiPhone 前端构建产物发布到 Cloudflare Pages。

## 关键决策

1. 按仓库 `CLAUDE.md` 和 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md` 执行，不临时改造部署流程。
2. Cloudflare Pages 项目固定使用 `mini-iphone`，稳定访问地址为 `https://mini-iphone.pages.dev/`。
3. 当前工作区存在未跟踪产物，部署命令使用 `--commit-dirty=true`，只允许 Wrangler 接受脏工作区，不清理或回退任何用户文件。
4. 先构建再部署。如果 `pnpm build` 失败，停止部署，避免把旧 `dist/` 发布到线上。
5. 部署后优先验证稳定域名，并使用时间戳查询参数绕过缓存。

## 交付清单

- 检查 Cloudflare Wrangler 登录状态。
- 执行 `pnpm build` 生成最新 `dist/`。
- 执行 `npx -y wrangler pages deploy dist --project-name mini-iphone --commit-dirty=true`。
- 验证 `https://mini-iphone.pages.dev/` 可访问并返回 hiPhone 页面。

## 测试计划

1. `npx -y wrangler whoami` 成功。
2. `pnpm build` 成功。
3. Cloudflare Pages 部署命令成功并返回部署 URL。
4. 对 `https://mini-iphone.pages.dev/?ts=<timestamp>` 做 HTTP/title 验证。
