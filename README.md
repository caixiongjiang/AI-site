# JarsonCai's Assistant

一个基于 Next.js 14 的现代化 AI 助手应用，提供智能对话、知识库问答和智能体应用等功能。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript (严格模式)
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **状态管理**: React Hooks

## 功能特性

### 🏠 首页
- 居中式大标题输入框
- 智能模式选择器（普通对话/Agent选择）
- 快捷功能卡片
- 作者简介抽屉

### 🤖 Agent 应用中心
- 智能体卡片网格展示
- 实时搜索过滤
- 分类标签展示
- 使用统计和评分

### 💬 Agent 使用页面
- 三栏式布局设计
- 实时对话功能
- 知识库/文件挂载
- 智能回复与引用

### 📚 知识库问答
- 知识库列表管理
- 文件网格/详情视图
- 文档内容渲染
- AI 助手问答侧边栏

## 开始使用

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 开发模式

\`\`\`bash
npm run dev
\`\`\`

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

\`\`\`bash
npm run build
npm start
\`\`\`

## 项目结构

\`\`\`
├── app/                      # Next.js App Router 页面
│   ├── page.tsx             # 首页
│   ├── agents/              # Agent 相关页面
│   ├── knowledge/           # 知识库页面
│   └── layout.tsx           # 根布局
├── components/              # React 组件
│   ├── layout/             # 布局组件（侧边栏等）
│   ├── home/               # 首页组件
│   ├── agents/             # Agent 组件
│   └── knowledge/          # 知识库组件
├── lib/                     # 工具函数和类型
│   ├── utils.ts            # 工具函数
│   ├── types.ts            # TypeScript 类型
│   └── mock-data.ts        # Mock 数据
└── public/                  # 静态资源
\`\`\`

## 设计系统

### 颜色主题
- 背景色: `#1A1A1A`
- 卡片背景: `#252526`
- 主题色: `#00B36B` → `#00D980`
- 边框色: `#333`

### 字体
- 系统字体: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC'`

### 图标风格
- 使用 Lucide React
- 简洁、线性风格

## 后续计划

- [ ] 接入真实后端 API
- [ ] 实现用户认证功能
- [ ] 流式对话响应
- [ ] Markdown 内容渲染优化
- [ ] 文件上传功能
- [ ] 知识库管理功能

## 作者

蔡雄江 - 全栈开发工程师 · AI产品设计师

## 许可证

MIT License
