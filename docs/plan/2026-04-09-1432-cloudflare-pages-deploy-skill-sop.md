# 2026-04-09 14:32 Cloudflare Pages 部署 skill + SOP

## 用户需求
1. 在 `hiPhone` 项目的 `docs/skills/` 目录下创建一个 Cloudflare 部署 skill。
2. 把这几次对 hiPhone 的 Cloudflare Pages 部署操作整理成一份可复用 SOP。
3. 让后续自己或其他代理在看到“部署 / 重新部署 / 发到 Cloudflare”这类需求时，可以直接按文档执行。

## 关键决策
1. skill 名称采用 `hiphone-cloudflare-pages-deploy`，直接体现“项目 + Cloudflare Pages + 部署”三层语义。
2. skill 本体只保留触发条件、执行顺序和关键规则，具体 SOP 下沉到 `references/`，避免 `SKILL.md` 过长。
3. SOP 以这几次真实操作为基准，固定当前项目的部署命令、项目名、稳定域名和校验方法。
4. 文档里明确区分“预检 / 构建 / 部署 / 验证 / 对外回报”五段，减少重复出错。

## 交付清单
1. `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md`
2. `docs/skills/hiphone-cloudflare-pages-deploy/references/hiphone-cloudflare-pages-sop.md`
3. 如有必要，补充目录说明或相关引用

## 测试计划
1. 检查 skill 目录结构是否符合 AgentSkills 规范。
2. 检查 `SKILL.md` frontmatter 是否完整，仅含 `name` 和 `description`。
3. 通读 SOP，确认命令、项目名、目录、线上地址与当前项目一致。
4. 最后用 `find`/`read` 快速核对文件已落盘。
