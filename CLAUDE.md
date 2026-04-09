

## 设计原则
1. **系统UI高仿iOS** — Shell层必须还原iOS的视觉与交互范式：Dock栏、毛玻璃材质、居中导航标题、左箭头返回、顶部横幅通知、SF风格排版、Dynamic Island、状态栏分层。每个系统组件（桌面、导航栏、通知、Dock）都应以iOS对应元素为参照，不做自创风格。

## 部署流程
每次开发完成后，按照 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md` 中的流程部署到 Cloudflare Pages。核心步骤：`pnpm build` → `npx -y wrangler pages deploy dist --project-name hiphone-wanqilin --commit-dirty=true` → 验证 https://hiphone-wanqilin.pages.dev/

## 规范要求
1. 文档优先,构建自己的文档系统(docs/). 有效使用子目录的`CLAUDE.md`,将需要阅读该目录需要了解的规范,以及反复做错踩坑点记录在对应目录的`CLAUDE.md`中.注意维护文档的目的是避免上下文在开发中丢失,在一次开发中大部分上下文转化为代码,少部分上下文转化为关键注释,还有一部分应该变成文档,否则就会永久丢失.
2. 执行计划前,先写docs/plan/计划文档. 计划文档文件名 为 yyyy-mm-dd-hhmm-计划名.md. 计划中必须包含详细的用户需求,和你的关键决策.
3. 测试优先,项目需要具备完善的单测系统.
4. 大需求出里程碑,里程碑拆解为多个阶段,每个阶段对应一个plan+具体开发
5. 手机会适应不同的屏幕尺寸,覆盖主流手机型号,因此在设计app的时候也要考虑到该问题.
