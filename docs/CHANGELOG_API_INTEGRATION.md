# 文稿检查助手 - API 集成更新日志

## 版本：v2.0 - 真实后端 API 集成

**更新时间**：2026-01-22

### 📋 更新概览

将文稿检查助手从 Mock 数据改造为对接真实后端 API，实现基于用户的规则配置 CRUD 管理。

---

## ✨ 主要变更

### 1. **API 层面改造**

#### 新增文件
- `lib/config.ts` - 统一的 API 配置管理

#### 修改文件
- `lib/api/agents/document-compliance.ts` - 完全重构为真实 API 调用

#### 功能实现
✅ **规则配置 CRUD**
- `GET /api/v1/apps/document-compliance/config/rules` - 获取用户规则列表
- `POST /api/v1/apps/document-compliance/config/rules` - 创建规则
- `PUT /api/v1/apps/document-compliance/config/rules/{rule_id}` - 更新规则
- `DELETE /api/v1/apps/document-compliance/config/rules/{rule_id}` - 删除规则

✅ **文档检查流程**
- `POST /api/v1/common/storage/upload` - 上传文件
- `POST /api/v1/apps/document-compliance/check` - 执行检查
- `POST /api/v1/apps/document-compliance/export-prompt` - 导出 AI 提示词

### 2. **数据模型映射**

实现了前后端数据模型的自动转换：

```typescript
// 前端模型
interface CheckRule {
  id: string;
  name: string;
  fields: CheckField[];
}

// 后端模型
interface BackendRuleConfig {
  rule_id: string;
  rule_name: string;
  parameters: { fields: CheckField[] }; // fields 存储在这里
}

// 自动转换函数
toBackendRule()    // 前端 → 后端
fromBackendRule()  // 后端 → 前端
```

### 3. **认证机制**

#### 当前实现（开发阶段）
- 使用固定 Mock User ID: `user_demo_001`
- 通过 `X-User-Id` 请求头传递
- 可通过环境变量 `NEXT_PUBLIC_MOCK_USER_ID` 配置

#### 统一的请求头管理
```typescript
// lib/config.ts
export function getCommonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-User-Id": getCurrentUserId(),
  };
}
```

### 4. **错误处理增强**

所有 API 调用都包含：
- ✅ HTTP 状态码检查
- ✅ 错误消息提取
- ✅ 用户友好的错误提示
- ✅ 降级到 Mock 数据（仅 fetchUserCheckRules）

### 5. **降级策略**

为了开发便利，`fetchUserCheckRules` 在后端不可用时会自动降级到 localStorage 的 Mock 数据：

```typescript
export async function fetchUserCheckRules(): Promise<CheckRule[]> {
  try {
    // 尝试调用真实 API
    const response = await fetch(API_URL);
    // ...
  } catch (error) {
    // 降级到 Mock 数据
    return getStoredRules();
  }
}
```

---

## 🗂️ 文件变更清单

### 新增文件
```
lib/config.ts                          # API 配置管理
docs/API_INTEGRATION.md                # API 集成文档
docs/CHANGELOG_API_INTEGRATION.md      # 本文件
```

### 修改文件
```
lib/api/agents/document-compliance.ts  # 重构为真实 API
lib/types.ts                           # 移除 DEFAULT_CHECK_RULES
components/agents/document-compliance/CheckRulesManager.tsx  # 移除默认配置相关逻辑
app/agents/document-compliance/page.tsx  # 添加加载状态
```

### 移除内容
```
- DEFAULT_CHECK_RULES 常量
- "修改默认配置" 开关
- isDefaultRule() 判断函数
- 所有与"默认规则"相关的 UI 和逻辑
```

---

## 🔧 配置说明

### 环境变量 (.env.local)

```bash
# 必填：后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000

# 可选：Mock 用户 ID（默认：user_demo_001）
NEXT_PUBLIC_MOCK_USER_ID=user_demo_001
```

### API 端点前缀

所有接口统一使用：
```
{NEXT_PUBLIC_API_URL}/api/v1/apps/document-compliance/...
```

---

## 📚 使用说明

### 开发环境

1. **启动后端服务**
   ```bash
   cd backend
   python main.py  # 确保在 http://localhost:8000 运行
   ```

2. **配置环境变量**
   ```bash
   # 项目根目录创建 .env.local
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   ```

3. **启动前端服务**
   ```bash
   npm run dev
   ```

4. **访问页面**
   ```
   http://localhost:4000/agents/document-compliance
   ```

### 测试流程

1. **查看规则列表**
   - 页面加载时自动从后端获取用户的规则配置
   - 显示加载动画

2. **创建规则**
   - 点击"添加"按钮
   - 填写规则信息和字段
   - 点击"保存"
   - 成功后显示 Toast 提示

3. **编辑规则**
   - 点击规则卡片的编辑图标
   - 修改内容
   - 点击"保存"

4. **删除规则**
   - 点击规则卡片的删除图标
   - 确认删除
   - 成功后显示 Toast 提示

5. **上传文档检查**
   - 上传文档（支持 PDF、图片等）
   - 点击"开始检查"
   - 查看检查结果

---

## 🐛 故障排查

### 问题 1: 请求 404 错误

**原因**：API 路径不正确

**解决**：
- 检查 `.env.local` 中的 `NEXT_PUBLIC_API_URL`
- 确认后端服务正在运行
- 检查后端路由是否包含 `/api/v1` 前缀

### 问题 2: CORS 错误

**原因**：后端未配置 CORS

**解决**：后端添加 CORS 中间件
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

### 问题 3: 认证失败 (401/403)

**原因**：`X-User-Id` 请求头缺失或无效

**解决**：
- 检查 `lib/config.ts` 中的 `getCurrentUserId()`
- 检查浏览器开发者工具的 Network 标签，确认请求头包含 `X-User-Id`

### 问题 4: 数据格式错误

**原因**：前后端数据模型不匹配

**解决**：
- 检查 `toBackendRule()` 和 `fromBackendRule()` 转换函数
- 确认后端 `parameters.fields` 结构正确

---

## 🔄 向后兼容

### Mock 数据降级

为确保在后端不可用时仍可开发，`fetchUserCheckRules` 包含降级逻辑：

```typescript
// 1. 尝试调用真实 API
// 2. 失败时自动降级到 localStorage Mock 数据
// 3. localStorage 为空时使用默认 Mock 数据
```

### LocalStorage 数据结构

```json
{
  "document_compliance_check_rules": [
    {
      "id": "rule-1",
      "name": "会议基本信息",
      "fields": [...]
    }
  ]
}
```

---

## 📝 后续计划

### 短期 (1-2 周)
- [ ] 实现真实的用户认证（JWT/Session）
- [ ] 添加请求重试机制
- [ ] 完善错误提示 UI

### 中期 (1-2 月)
- [ ] 添加请求缓存（React Query / SWR）
- [ ] 实现乐观更新
- [ ] 添加离线支持

### 长期 (3+ 月)
- [ ] API 监控和日志
- [ ] 性能优化
- [ ] 国际化支持

---

## 👥 开发者指南

### 添加新的 API 接口

1. 在 `lib/api/agents/document-compliance.ts` 中添加函数
2. 使用 `API_CONFIG` 和 `getCommonHeaders()`
3. 添加错误处理
4. 更新类型定义（如需要）

示例：
```typescript
export async function getCheckHistory(sessionId: string) {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.VERSION}/apps/document-compliance/history?session_id=${sessionId}`,
      {
        method: "GET",
        headers: getCommonHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Get check history failed:", error);
    throw error;
  }
}
```

---

## 📖 参考文档

- [API 集成文档](./API_INTEGRATION.md)
- [OpenAPI 规范](./openapi.json)
- [项目总结](./PROJECT_SUMMARY.md)

---

## 🙏 致谢

感谢后端团队提供完善的 OpenAPI 文档，使得前后端集成非常顺利！
