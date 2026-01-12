import { Agent, KnowledgeBase, FileItem } from "./types";

export const mockAgents: Agent[] = [
  {
    id: "document-compliance",
    name: "文稿检查助手",
    category: "办公效率 · 合规检查",
    description:
      "智能检查会议记录等文稿的合规性和完整性，自动识别缺失字段、数据异常，并生成详细的检查报告。支持本地规则引擎和 AI 深度校验。",
    icon: "FileCheck",
    tags: ["合规", "校验", "文档"],
    stats: { users: 856, rating: 4.7 },
    featured: true,
  },
  {
    id: "contract-review",
    name: "合同风险审查",
    category: "法务 · 风险管理",
    description:
      "快速识别合同隐患条款，为您提供完整的法律风险报告。分析包括但不限于免责条款、违约责任、知识产权保护等。",
    icon: "FileText",
    tags: ["法律", "合同"],
    stats: { users: 1200, rating: 4.8 },
    featured: true,
  },
  {
    id: "knowledge-qa",
    name: "企业知识问答",
    category: "知识管理",
    description: "提供精确的基础知识检索，企业规程快速查询及答复。",
    icon: "Library",
    tags: ["问答", "知识库"],
    stats: { users: 856, rating: 4.6 },
  },
  {
    id: "weekly-report",
    name: "周报生成",
    category: "办公效率",
    description: "根据您提供的工作记录，自动生成专业规范的工作周报，节省您的时间。",
    icon: "BarChart3",
    tags: ["办公", "写作"],
    stats: { users: 982, rating: 4.7 },
  },
  {
    id: "doc-translation",
    name: "文档翻译",
    category: "语言处理",
    description: "精确高效支持多语言的文档翻译服务，适用于商务、技术、学术等领域。",
    icon: "Globe",
    tags: ["翻译", "多语言"],
    stats: { users: 1500, rating: 4.9 },
  },
  {
    id: "code-review",
    name: "代码审查",
    category: "开发工具",
    description:
      "提供详细的代码质量审查，包括性能优化建议、安全漏洞检测和最佳实践推荐。",
    icon: "Code",
    tags: ["开发", "代码"],
    stats: { users: 1800, rating: 4.9 },
  },
  {
    id: "content-writing",
    name: "智能写作",
    category: "内容创作",
    description: "根据您的信息和经验构建，帮助优化您的文章和推文。",
    icon: "MessageSquare",
    tags: ["写作"],
    stats: { users: 642, rating: 4.7 },
  },
  {
    id: "marketing-center",
    name: "营销策略",
    category: "市场营销",
    description: "帮您生成营销材料，规划营销创意内容，快速制定策略。",
    icon: "Target",
    tags: ["营销", "策略"],
    stats: { users: 523, rating: 4.5 },
  },
  {
    id: "data-analysis",
    name: "数据分析",
    category: "数据处理",
    description: "快速整理并深度分析市场趋势、竞品分析或研究话题。",
    icon: "LineChart",
    tags: ["分析"],
    stats: { users: 334, rating: 4.6 },
  },
];

export const mockKnowledgeBases: KnowledgeBase[] = [
  {
    id: "legal-docs",
    name: "公司法务共享库",
    icon: "Library",
    fileCount: 125,
    lastUpdated: "2天前",
  },
  {
    id: "tech-docs",
    name: "技术文档库",
    icon: "Briefcase",
    fileCount: 89,
    lastUpdated: "1小时前",
  },
  {
    id: "product-docs",
    name: "产品需求文档",
    icon: "BarChart3",
    fileCount: 45,
    lastUpdated: "3天前",
  },
  {
    id: "finance-docs",
    name: "财务报表汇总",
    icon: "TrendingUp",
    fileCount: 23,
    lastUpdated: "2周前",
  },
  {
    id: "marketing-docs",
    name: "市场营销资料",
    icon: "Megaphone",
    fileCount: 67,
    lastUpdated: "5天前",
  },
  {
    id: "hr-docs",
    name: "人力资源文档",
    icon: "Users",
    fileCount: 34,
    lastUpdated: "1周前",
  },
];

export const mockFiles: FileItem[] = [
  {
    id: "file-1",
    name: "标准合同范本2023版.pdf",
    icon: "FileText",
    size: "2.3MB",
    lastUpdated: "2天前",
    kbId: "legal-docs",
  },
  {
    id: "file-2",
    name: "法律合规指南.pdf",
    icon: "FileText",
    size: "1.8MB",
    lastUpdated: "3天前",
    kbId: "legal-docs",
  },
  {
    id: "file-3",
    name: "知识产权保护条款.docx",
    icon: "FileText",
    size: "456KB",
    lastUpdated: "1周前",
    kbId: "legal-docs",
  },
  {
    id: "file-4",
    name: "劳动合同模板.pdf",
    icon: "FileText",
    size: "1.2MB",
    lastUpdated: "5天前",
    kbId: "legal-docs",
  },
  {
    id: "file-5",
    name: "商业秘密保护协议.pdf",
    icon: "FileText",
    size: "980KB",
    lastUpdated: "1周前",
    kbId: "legal-docs",
  },
  {
    id: "file-6",
    name: "股权转让协议模板.docx",
    icon: "FileText",
    size: "1.5MB",
    lastUpdated: "2周前",
    kbId: "legal-docs",
  },
];

export const mockDocumentContent = `
# 第一章 总则

本合同范本旨在为企业提供标准化的合同模板，确保合同条款的完整性和合规性。本文档包含了常见商业合同的核心条款和注意事项。

## 1.1 合同目的

明确合同双方的权利义务关系，规范交易行为，预防和减少合同纠纷。本范本适用于一般商业交易场景，具体使用时需根据实际情况进行调整。

## 1.2 适用范围

本范本适用于货物买卖、服务提供、技术转让等多种商业场景。使用者应当根据交易的具体性质选择合适的条款，并在必要时咨询专业法律人士。

# 第二章 合同主体

合同主体是指合同的当事人，包括甲方（供应方/服务方）和乙方（需求方/客户方）。双方应当具备相应的民事权利能力和民事行为能力。

## 2.1 主体资格

甲方应为依法设立并有效存续的企业法人或其他组织，具有履行本合同的能力和资质。乙方同样应具备合法的主体资格，有权签署和履行本合同。

## 2.2 授权代表

签署合同的代表应当具有相应的授权，并能够代表其所在组织行使权利和承担义务。必要时应提供授权委托书等证明文件。
`;
