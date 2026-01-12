# Agent 应用架构设计

## 📐 整体架构

本项目采用模块化的 Agent 应用架构，每个 Agent 独立开发、维护和部署。

```
AI-site/
├── app/
│   └── agents/
│       ├── [agent-name-1]/
│       │   └── page.tsx           # Agent 主页面
│       ├── [agent-name-2]/
│       │   └── page.tsx
│       └── page.tsx                # Agent 列表页
│
├── components/
│   └── agents/
│       ├── [agent-name-1]/         # Agent 专用组件
│       │   ├── Component1.tsx
│       │   ├── Component2.tsx
│       │   └── README.md
│       └── [agent-name-2]/
│           └── ...
│
├── lib/
│   ├── api/
│   │   └── agents/
│   │       ├── [agent-name-1].ts   # API 封装
│   │       └── [agent-name-2].ts
│   ├── types.ts                    # 全局类型定义
│   └── mock-data.ts                # Mock 数据
│
└── docs/
    └── AGENT_ARCHITECTURE.md       # 本文件
```

## 🎯 设计原则

### 1. 独立性 (Isolation)
- 每个 Agent 有独立的文件夹
- 组件不跨 Agent 共享（除非是通用 UI 组件）
- 降低耦合，便于维护

### 2. 可扩展性 (Scalability)
- 添加新 Agent 无需修改现有代码
- 统一的目录结构和命名规范
- 易于团队协作开发

### 3. 类型安全 (Type Safety)
- 严格的 TypeScript 类型定义
- API 接口类型化
- 编译时错误检查

### 4. 后端解耦 (Backend Decoupling)
- 前端可独立开发和测试
- 使用 Mock 数据进行开发
- API 调用统一封装

## 📝 开发流程

### 新增 Agent 应用

#### 1. 创建页面结构
```bash
mkdir -p app/agents/your-agent-name
touch app/agents/your-agent-name/page.tsx
```

#### 2. 创建组件文件夹
```bash
mkdir -p components/agents/your-agent-name
touch components/agents/your-agent-name/README.md
```

#### 3. 添加类型定义
在 `lib/types.ts` 中添加 Agent 专用的类型：

```typescript
// 在 lib/types.ts 末尾添加
export interface YourAgentRequest {
  // 请求参数
}

export interface YourAgentResponse {
  // 响应数据
}
```

#### 4. 创建 API 封装
```bash
touch lib/api/agents/your-agent-name.ts
```

```typescript
import { YourAgentResponse } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function yourAgentApi(
  params: YourAgentRequest
): Promise<YourAgentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/agents/your-agent-name/endpoint`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
```

#### 5. 更新 Mock 数据
在 `lib/mock-data.ts` 中添加 Agent 卡片：

```typescript
export const mockAgents: Agent[] = [
  // 添加到数组开头或适当位置
  {
    id: "your-agent-name",
    name: "您的 Agent 名称",
    category: "分类",
    description: "描述...",
    icon: "IconName",  // Lucide 图标名称
    tags: ["标签1", "标签2"],
    stats: { users: 100, rating: 4.5 },
    featured: false,  // 是否推荐
  },
  // ... 其他 agents
];
```

#### 6. 开发组件
参考 `document-compliance` 的组件结构：
- 拆分功能模块为独立组件
- 使用 shadcn/ui 组件库
- Tailwind CSS 样式
- TypeScript 严格类型

#### 7. 整合主页面
在 `app/agents/your-agent-name/page.tsx` 中：
- 引入所有组件
- 实现状态管理
- 调用 API
- 处理错误

## 🔄 状态管理模式

推荐使用 React Hooks 进行状态管理：

```typescript
const [status, setStatus] = useState<AgentStatus>("idle");
const [data, setData] = useState<ResponseType | null>(null);
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  try {
    setStatus("processing");
    setError(null);
    
    const result = await yourApi(params);
    setData(result);
    setStatus("completed");
  } catch (err) {
    setError(err.message);
    setStatus("error");
  }
};
```

## 🎨 UI 设计规范

### 布局
- 使用响应式布局（`grid`, `flex`）
- 移动端优先（`md:`, `lg:` 断点）
- 左右分栏或上下堆叠

### 颜色
- 主色：`primary`, `primary-light`
- 背景：`dark`, `dark-card`
- 边框：`dark-border`
- 文字：`foreground`, `muted`
- 状态色：
  - 成功：`green-500`
  - 警告：`yellow-500`
  - 错误：`red-500`

### 组件
- 按钮：`rounded-lg`, `px-4 py-2`, `transition-all`
- 卡片：`rounded-xl`, `border`, `bg-dark-card`
- 输入：使用 shadcn/ui 组件

## 🧪 开发建议

### Mock 数据开发
1. 先使用 Mock 数据完成前端开发
2. 验证所有交互流程
3. 确认 UI/UX 符合预期
4. 后端就绪后再接入真实 API

### 错误处理
- 必须有 try-catch 包裹 API 调用
- 显示用户友好的错误信息
- 提供重试机制

### 性能优化
- 大文件上传显示进度
- 长时间操作显示 Loading 状态
- 使用 `useCallback` 和 `useMemo`（必要时）

## 📚 参考实现

### 已实现的 Agent
1. **文稿检查助手** (`document-compliance`) - v2.0
   - ✨ 多文件/截图上传（拖拽 + 粘贴）
   - ✨ 自定义检查项管理（添加、编辑、删除）
   - 状态流转（上传 → 解析 → 校验 → 完成）
   - 结果展示（统计 + 详细列表）
   - 导出功能（AI 提示词 + 检查报告）
   - 完整的错误处理
   - 知识库集成

## 🚀 快速开始

复制 `document-compliance` 作为模板：

```bash
# 复制组件
cp -r components/agents/document-compliance components/agents/your-agent

# 复制页面
cp -r app/agents/document-compliance app/agents/your-agent

# 复制 API
cp lib/api/agents/document-compliance.ts lib/api/agents/your-agent.ts
```

然后根据需求修改代码。

## 📞 技术支持

如有问题，请参考：
1. `document_compliance.md` - 需求文档
2. `components/agents/document-compliance/README.md` - 组件文档
3. Next.js 14 官方文档
4. shadcn/ui 组件库文档
