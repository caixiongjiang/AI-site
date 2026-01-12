# 项目名称：文稿检查助手 (Document Compliance Agent)

## 1. 项目概述与架构约束

### 1.1 核心目标
构建一个文稿合规性检查系统，支持截图/文件上传。系统优先使用**本地规则引擎**进行基础数据校对（防泄露），并提供**提示词导出**功能以支持可选的外部大模型深度校验。

### 1.2 技术架构
*   **前端 (Frontend)**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (负责交互、上传、红框标记展示)。
*   **Agent 后端 (Agent Backend)**: Python/FastAPI (核心业务层，负责编排 MinerU、运行本地规则、生成 Prompt)。
*   **知识后端 (Knowledge Backend)**: 负责向量存储与检索 (RAG)。
*   **外部服务**: MinerU (仅用于 OCR 与版面分析)。

### 1.3 关键原则
1.  **数据安全原则**: 默认情况下，用户上传的文件内容**严禁**发送给外部公有 LLM API。
2.  **调用原则**: 前端**禁止**直接调用 MinerU，必须经过 Agent 后端中转。
3.  **解耦原则**: “基础格式校验（硬逻辑）”与“语义内容校验（软逻辑）”完全分离。

---

## 2. 数据流与接口定义 (System Specs)

请按以下规范定义接口和数据模型。

### 2.1 核心数据流
1.  **输入**: 用户上传文件 + 参数 `save_to_kb` (bool) + 参数 `mode` (auto_check / export_prompt).
2.  **解析**: Agent 后端 -> 调用 MinerU -> 获取 Markdown/JSON.
3.  **清洗 (ETL)**: Agent 后端 (Regex/本地逻辑) -> 将 Markdown 转为标准 JSON.
4.  **校验**: Agent 后端 (Pydantic) -> 对比 JSON 与 规则 -> 输出 Report.
5.  **存储 (可选)**: Agent 后端 (Async) -> 推送给 Knowledge Backend.

### 2.2 核心数据结构 (Pydantic Models)

```python
# domain/models.py

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Any

class MeetingRecord(BaseModel):
    """从MinerU结果中提取的标准结构"""
    meeting_time_start: Optional[str] = Field(None, description="HH:MM")
    meeting_time_end: Optional[str] = Field(None, description="HH:MM")
    attendees_expected: Optional[int] = Field(None, description="应到人数")
    attendees_actual: Optional[int] = Field(None, description="实到人数")
    absent_reason: Optional[str] = Field(None, description="缺席原因及人员")
    host: Optional[str] = None
    recorder: Optional[str] = None
    content_body: Optional[str] = Field(None, description="会议纪要正文")

class ValidationResult(BaseModel):
    field: str
    is_valid: bool
    error_msg: Optional[str]
    original_value: Any
```

---

## 3. 分阶段开发计划 (Step-by-Step Implementation)

请指示 AI 按照以下顺序生成代码。

### 阶段一：感知层适配 (MinerU Integration)
**目标**: 实现文件上传并获取清洗后的文本。

*   **Prompt 指令**:
    > "在 `services/mineru_client.py` 中创建一个异步客户端。实现 `parse_document(file)` 方法。
    > 1. 使用 `httpx` 调用 MinerU API。
    > 2. 处理文件上传的 multipart/form-data。
    > 3. 实现轮询机制等待解析完成。
    > 4. 返回解析后的 markdown 文本。注意不要在前端实现此逻辑，必须在 FastAPI 后端。"

### 阶段二：本地 ETL 与结构化 (Local ETL Engine)
**目标**: 将非结构化的 Markdown 转换为 `MeetingRecord` 对象，不依赖外部 LLM。

*   **Prompt 指令**:
    > "编写 `services/extractor.py`。
    > 任务是将 MinerU 返回的 Markdown 文本解析为 `MeetingRecord` Pydantic 对象。
    > 策略：
    > 1. 使用 Python 正则表达式 (Regex) 匹配常见的表头（如 '时间'、'主持人'、'应到'）。
    > 2. 处理全角/半角符号和多余空格。
    > 3. 如果提取失败，对应字段设为 None。
    > 4. 编写单元测试，输入一段模拟 Markdown，断言提取出的 JSON 字段正确。"

### 阶段三：硬逻辑校验引擎 (Rule Engine)
**目标**: 实现数值和完整性校验。

*   **Prompt 指令**:
    > "编写 `services/validator.py`。
    > 1. 创建 `validate_record(record: MeetingRecord) -> List[ValidationResult]` 函数。
    > 2. 实现规则：
    >    - **完整性**: 检查 `host`, `recorder`, `place` 是否为空。
    >    - **逻辑1**: 计算 `meeting_time_end` - `meeting_time_start`。如果 > 4小时，标记 Warning。
    >    - **逻辑2**: 如果 `attendees_actual` < `attendees_expected` 且 `absent_reason` 为空，标记 Error。
    >    - **逻辑3**: `attendees_actual` 必须 >= 3。"

### 阶段四：提示词工程服务 (Prompt Service)
**目标**: 实现“一键导出”功能。

*   **Prompt 指令**:
    > "集成 `Jinja2` 模板引擎。在 `templates/prompts` 下创建 `compliance_check.j2`。
    > 编写服务 `services/prompt_builder.py`，接收 `MeetingRecord` 数据和规则列表。
    > 生成一段 Prompt，包含：'你是一个合规助手，请检查以下内容...'。
    > API 接口应当返回构建好的 Prompt 字符串，供前端复制。"

### 阶段五：知识库异步存储 (Async Knowledge Storage)
**目标**: 实现 RAG 数据的可选入库。

*   **Prompt 指令**:
    > "在 FastAPI 的 Controller 中，使用 `BackgroundTasks`。
    > 如果请求参数 `save_to_kb=True`，则在返回校验结果给前端后，异步调用知识系统后端的 API (`POST /ingest`)。
    > 确保主线程不阻塞，立即响应用户。"

### 阶段六：前端交互实现 (UI Implementation)
**目标**: 差异化展示与导出。

*   **Prompt 指令**:
    > "在 Next.js 项目中开发文稿检查 Agent 页面和组件。
    > 
    > **技术栈要求**：
    > - 使用 Next.js 14 App Router，在 `app/agents/document-compliance/page.tsx` 创建页面
    > - 使用 TypeScript 严格类型，定义 `ValidationResult` 和 `MeetingRecord` 接口
    > - 使用 Tailwind CSS 进行样式编写（禁止创建单独的 CSS 文件）
    > - 使用 shadcn/ui 组件库（Button, Card, Switch, Badge, ScrollArea 等）
    > - 图标使用 Lucide React
    > - 状态管理使用 React Hooks (`useState`, `useEffect`)
    > 
    > **功能实现**：
    > 1. **文件上传组件** (`components/agents/DocumentUploader.tsx`):
    >    - 使用 `"use client"` 标记为客户端组件
    >    - 支持拖拽上传和点击选择文件
    >    - 状态管理：`idle` | `uploading` | `parsing` | `validating` | `completed` | `error`
    >    - 使用 `fetch` 调用后端 API (`POST /api/agents/document-compliance/check`)
    > 
    > 2. **结果展示组件** (`components/agents/ValidationResults.tsx`):
    >    - 左侧：使用 `<Image>` 组件展示原始文档图片，如果后端返回坐标则使用 SVG overlay 画红框标记
    >    - 右侧：使用 `ScrollArea` 展示 `ValidationResult[]` 列表
    >    - 错误项使用红色 Badge，警告项使用黄色 Badge，正常项使用绿色 Badge
    > 
    > 3. **功能按钮**:
    >    - 使用 shadcn/ui `Switch` 组件实现 '存入知识库' 开关（绑定到请求参数 `save_to_kb`）
    >    - 使用 `Button` 组件实现 '导出 AI 提示词' 功能，点击后调用 `navigator.clipboard.writeText()` 复制 Prompt
    >    - 添加 Toast 提示用户复制成功
    > 
    > 4. **类型定义** (在组件顶部或 `lib/types.ts` 中):
    >    ```typescript
    >    interface ValidationResult {
    >      field: string;
    >      is_valid: boolean;
    >      error_msg: string | null;
    >      original_value: any;
    >    }
    >    
    >    interface MeetingRecord {
    >      meeting_time_start?: string;
    >      meeting_time_end?: string;
    >      attendees_expected?: number;
    >      attendees_actual?: number;
    >      absent_reason?: string;
    >      host?: string;
    >      recorder?: string;
    >      content_body?: string;
    >    }
    >    ```
    > 
    > 5. **响应式设计**:
    >    - 使用 Tailwind 的 `md:` 和 `lg:` 前缀确保移动端友好
    >    - 小屏幕下左右布局改为上下堆叠
    > 
    > 6. **错误处理**:
    >    - 添加 try-catch 处理 API 调用错误
    >    - 显示友好的错误提示信息"

---

## 4. 给 AI 助手的总提示词 (Master Prompt)

**你可以直接复制下面这段话发给 AI Agent 来启动项目：**

> "我正在开发一个基于 Python FastAPI 的文稿合规检查后端。架构是 Agent Backend 调用 MinerU 服务进行解析，然后在本地进行规则校验。
>
> 请注意以下核心约束：
> 1. **隐私优先**：不要调用 OpenAI 或任何外部 LLM API 进行数据处理，提取和校验逻辑必须用 Python 代码（正则/Pydantic）在本地实现。
> 2. **数据流**：前端上传 -> Agent Backend -> MinerU -> Agent Backend (清洗+校验) -> 返回前端。
> 3. **知识库**：知识库存储是异步的可选项。
>
> 请首先帮我生成 `app/models/schemas.py` 定义 Pydantic 数据结构，以及 `app/services/extractor.py` 的正则提取逻辑框架。"

---

这份计划将复杂的业务逻辑拆解为 AI 容易理解和执行的代码任务，最大程度避免了幻觉和架构偏差。您可以按此顺序开始开发。