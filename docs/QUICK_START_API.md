# 快速开始 - 后端 API 集成

## 🚀 5 分钟快速启动

### 步骤 1: 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# 后端 API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000

# Mock 用户 ID（可选，默认：user_demo_001）
NEXT_PUBLIC_MOCK_USER_ID=user_demo_001
```

### 步骤 2: 确保后端服务运行

```bash
# 确保后端在 http://localhost:8000 运行
# 并且包含以下端点：
# - GET  /api/v1/apps/document-compliance/config/rules
# - POST /api/v1/apps/document-compliance/config/rules
# - PUT  /api/v1/apps/document-compliance/config/rules/{rule_id}
# - DELETE /api/v1/apps/document-compliance/config/rules/{rule_id}
```

### 步骤 3: 启动前端

```bash
npm run dev
```

### 步骤 4: 访问页面

打开浏览器访问：
```
http://localhost:4000/agents/document-compliance
```

---

## ✅ 功能验证

### 1. 加载规则列表
- ✅ 页面自动从后端获取用户的规则配置
- ✅ 显示加载动画
- ✅ 显示规则数量

### 2. 创建规则
1. 点击"添加"按钮
2. 填写规则名称（如："会议基本信息"）
3. 点击"添加字段"
4. 填写字段信息
5. 点击"保存"
6. ✅ 显示成功提示

### 3. 编辑规则
1. 点击规则卡片的编辑图标（铅笔）
2. 修改内容
3. 点击"保存"
4. ✅ 显示成功提示

### 4. 删除规则
1. 点击规则卡片的删除图标（垃圾桶）
2. 确认删除
3. ✅ 显示成功提示

### 5. 复制规则
1. 点击规则卡片的复制图标
2. 修改副本内容
3. 点击"保存"
4. ✅ 创建新规则

---

## 🔍 调试技巧

### 查看网络请求

打开浏览器开发者工具（F12）→ Network 标签：

```
# 获取规则列表
GET /api/v1/apps/document-compliance/config/rules?enabled_only=false
Headers:
  X-User-Id: user_demo_001
  Content-Type: application/json

# 创建规则
POST /api/v1/apps/document-compliance/config/rules
Headers:
  X-User-Id: user_demo_001
  Content-Type: application/json
Body:
  {
    "rule_name": "会议基本信息",
    "category": "completeness",
    ...
  }
```

### 检查请求头

确认每个请求都包含：
- ✅ `X-User-Id: user_demo_001`
- ✅ `Content-Type: application/json`

### 查看响应数据

```json
// 成功响应示例
{
  "rule_id": "rule_abc123",
  "rule_name": "会议基本信息",
  "user_id": "user_demo_001",
  "parameters": {
    "fields": [...]
  }
}
```

---

## ❌ 常见问题

### Q1: 页面一直显示"加载检查规则配置..."

**可能原因：**
1. 后端服务未启动
2. API 地址配置错误
3. CORS 未配置

**解决方法：**
```bash
# 1. 检查后端是否运行
curl http://localhost:8000/health

# 2. 检查环境变量
cat .env.local

# 3. 查看浏览器控制台错误信息
```

### Q2: 创建规则后没有反应

**可能原因：**
1. 请求失败但未显示错误
2. 数据格式不匹配

**解决方法：**
```bash
# 查看浏览器控制台 (Console 标签)
# 查看网络请求 (Network 标签)
# 检查响应状态码和错误信息
```

### Q3: 显示 CORS 错误

**错误信息：**
```
Access to fetch at 'http://localhost:8000/...' from origin 'http://localhost:4000' 
has been blocked by CORS policy
```

**解决方法：**

后端添加 CORS 配置：
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

### Q4: 请求返回 401/403 错误

**可能原因：**
- 后端认证检查失败
- `X-User-Id` 缺失或无效

**解决方法：**
```typescript
// 检查 lib/config.ts
export function getCurrentUserId(): string {
  return "user_demo_001"; // 确保返回有效的用户 ID
}
```

---

## 📊 数据流程图

```
┌─────────────┐
│  前端页面    │
└──────┬──────┘
       │ 1. 加载页面
       ↓
┌──────────────────────┐
│ fetchUserCheckRules() │
└──────┬───────────────┘
       │ 2. GET /api/v1/.../rules
       ↓
┌─────────────┐
│  后端 API    │──→ 返回规则列表
└──────┬──────┘
       │ 3. 转换数据
       ↓
┌─────────────┐
│ fromBackendRule() │──→ 转换为前端格式
└──────┬──────┘
       │ 4. 更新 UI
       ↓
┌─────────────┐
│ 显示规则列表 │
└─────────────┘
```

---

## 🎯 下一步

1. **测试完整流程**
   - 创建 → 编辑 → 删除规则
   - 上传文档 → 执行检查

2. **查看文档**
   - [API 集成文档](./API_INTEGRATION.md)
   - [更新日志](./CHANGELOG_API_INTEGRATION.md)

3. **集成认证系统**
   - 修改 `lib/config.ts` 中的 `getCurrentUserId()`
   - 从实际认证系统获取用户 ID

4. **优化用户体验**
   - 添加请求缓存
   - 实现乐观更新
   - 改进错误提示

---

## 💬 需要帮助？

如遇到问题：
1. 查看浏览器控制台错误信息
2. 查看 Network 标签的请求详情
3. 检查后端日志
4. 参考 [API 集成文档](./API_INTEGRATION.md)

祝开发顺利！🎉
