# API 集成文档

## 概述

本文档说明前端如何集成后端 API，特别是文稿检查助手的规则配置管理。

## 环境配置

### 1. 环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# 后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000

# Mock 用户 ID（开发测试用）
NEXT_PUBLIC_MOCK_USER_ID=user_demo_001
```

### 2. API 配置

所有 API 配置集中在 `lib/config.ts` 中管理：

```typescript
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  VERSION: "/api/v1",
  TIMEOUT: 30000,
};
```

## 文稿检查助手 API

### API 端点

所有接口基于：`{API_BASE_URL}/api/v1/apps/document-compliance/config/rules`

### 数据模型映射

#### 前端模型 (CheckRule)

```typescript
interface CheckRule {
  id: string;
  name: string;
  description?: string;
  fields: CheckField[];
}

interface CheckField {
  id: string;
  name: string;
  key: string;
  type: "numeric" | "text" | "time" | "semantic";
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    semanticRequirement?: string;
  };
}
```

#### 后端模型 (RuleConfigModel)

```typescript
interface BackendRuleConfig {
  rule_id: string;
  rule_name: string;
  user_id: string;
  category: "completeness" | "logic" | "format" | "content";
  description?: string | null;
  enabled: boolean;
  severity: "error" | "warning" | "info";
  parameters: Record<string, any>; // 包含前端的 fields
  validator_function: string;
  error_message_template: string;
  display_order: number;
  group_name?: string | null;
}
```

#### 数据转换

前端的 `fields` 存储在后端的 `parameters.fields` 中：

```typescript
// 前端 → 后端
function toBackendRule(rule: CheckRule) {
  return {
    rule_name: rule.name,
    parameters: {
      fields: rule.fields // 将 fields 放入 parameters
    },
    // ... 其他字段
  };
}

// 后端 → 前端
function fromBackendRule(backendRule: BackendRuleConfig): CheckRule {
  return {
    id: backendRule.rule_id,
    name: backendRule.rule_name,
    fields: backendRule.parameters?.fields || [],
    // ... 其他字段
  };
}
```

### CRUD 操作

#### 1. 获取用户规则列表

```typescript
GET /api/v1/apps/document-compliance/config/rules
Headers: 
  - X-User-Id: user_001
  - Content-Type: application/json

Response:
{
  "total_count": 3,
  "rules": [...],
  "enabled_count": 3,
  "disabled_count": 0
}
```

#### 2. 创建规则

```typescript
POST /api/v1/apps/document-compliance/config/rules
Headers: 
  - X-User-Id: user_001
  - Content-Type: application/json

Body:
{
  "rule_name": "会议基本信息",
  "category": "completeness",
  "description": "检查会议的基本信息字段",
  "enabled": true,
  "severity": "error",
  "parameters": {
    "fields": [
      {
        "id": "field-1",
        "name": "会议主持人",
        "key": "host",
        "type": "text",
        "required": true
      }
    ]
  },
  "validator_function": "validate_custom_fields",
  "error_message_template": "{field} 不符合要求",
  "group_name": "会议基本信息"
}

Response: (创建的规则对象，包含生成的 rule_id)
```

#### 3. 更新规则

```typescript
PUT /api/v1/apps/document-compliance/config/rules/{rule_id}
Headers: 
  - X-User-Id: user_001
  - Content-Type: application/json

Body: (同创建规则，但不包含 rule_id)

Response: (更新后的规则对象)
```

#### 4. 删除规则

```typescript
DELETE /api/v1/apps/document-compliance/config/rules/{rule_id}
Headers: 
  - X-User-Id: user_001

Response: 200 OK
```

## 文档检查流程

### 1. 上传文件

```typescript
POST /api/v1/common/storage/upload
Content-Type: multipart/form-data

FormData:
  - file: (文件对象)
  - category: "session"
  - agent_type: "document_compliance"
  - session_id: "sess_123"
  - user_id: "user_001"

Response:
{
  "file_id": "file_abc123",
  "original_filename": "meeting.pdf",
  // ... 其他字段
}
```

### 2. 执行检查

```typescript
POST /api/v1/apps/document-compliance/check
Headers: 
  - X-User-Id: user_001
  - Content-Type: application/json

Body:
{
  "file_id": "file_abc123",
  "save_to_kb": false,
  "session_id": "sess_123"
}

Response:
{
  "check_id": "check_abc",
  "file_id": "file_abc123",
  "status": "completed",
  "meeting_record": {...},
  "validation_results": [...],
  "error_count": 2,
  "warning_count": 1,
  "is_compliant": false
}
```

### 3. 导出 AI 提示词

```typescript
POST /api/v1/apps/document-compliance/export-prompt
Headers: 
  - X-User-Id: user_001
  - Content-Type: application/json

Body:
{
  "check_id": "check_abc",
  "template_name": "default",
  "include_raw_data": false
}

Response:
{
  "check_id": "check_abc",
  "prompt": "你是一个文稿合规检查助手...",
  "token_count": 1500
}
```

## 认证说明

### 当前实现（开发阶段）

- 使用固定的 Mock User ID: `user_demo_001`
- 通过 `X-User-Id` 请求头传递

### 未来集成（生产环境）

需要实现真实的认证系统，在 `lib/config.ts` 中修改：

```typescript
export function getCurrentUserId(): string {
  // 方案 1: 从认证上下文获取
  const { user } = useAuth();
  return user?.id || AUTH_CONFIG.MOCK_USER_ID;
  
  // 方案 2: 从 Cookie/LocalStorage 获取
  const userId = localStorage.getItem('user_id');
  return userId || AUTH_CONFIG.MOCK_USER_ID;
  
  // 方案 3: 从 JWT Token 解析
  const token = getAuthToken();
  const decoded = jwt.decode(token);
  return decoded?.sub || AUTH_CONFIG.MOCK_USER_ID;
}
```

## 错误处理

所有 API 调用都包含错误处理：

```typescript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "操作失败",
    }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
} catch (error) {
  console.error("Operation failed:", error);
  throw new Error(error instanceof Error ? error.message : "操作失败");
}
```

## 开发测试

### 1. 启动后端服务

```bash
cd backend
python main.py  # 或使用你的启动命令
```

### 2. 启动前端服务

```bash
npm run dev
```

### 3. 访问页面

打开浏览器访问：`http://localhost:4000/agents/document-compliance`

### 4. 测试功能

1. **加载规则**：页面自动从后端加载用户的规则配置
2. **创建规则**：点击"添加"按钮创建新规则
3. **编辑规则**：点击编辑图标修改规则
4. **删除规则**：点击删除图标删除规则（需确认）
5. **上传文档**：上传文档并执行检查

## 故障排查

### 问题 1: CORS 错误

确保后端配置了正确的 CORS：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 问题 2: 认证失败

检查请求头是否包含 `X-User-Id`：

```typescript
// 在浏览器开发者工具的 Network 标签中查看请求头
Headers: {
  "X-User-Id": "user_demo_001",
  "Content-Type": "application/json"
}
```

### 问题 3: 数据格式不匹配

检查前后端的数据模型映射是否正确，特别是 `fields` 字段的转换。

## 后续改进

1. [ ] 实现真实的用户认证系统
2. [ ] 添加请求重试机制
3. [ ] 添加请求缓存
4. [ ] 实现离线支持
5. [ ] 添加 API 监控和日志
