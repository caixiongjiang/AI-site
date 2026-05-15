/**
 * 知识库对话（Chat）模块的前端类型定义。
 *
 * 与后端文档对齐：
 *   - REST：api/schemas/chat/session.py
 *   - WS：src/chat/protocol.py（子协议 aks-chat-v1）
 *   - 设计文档：docs/特殊功能设计/知识库对话设计.md §4 / §5 / §6.2
 */

// ---------------------------------------------------------------------------
// 通用业务对象
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface Citation {
  chunk_id: string;
  document_id?: string | null;
  knowledge_base_id?: string | null;
  score: number;
  /**
   * Phase A 内联引用扩展字段：
   * - chunk_type: text / table / image（equation 已被切成 text + LaTeX 语法）
   * - page_index: 从 0 开始，UI 展示 +1
   * - section_title: 章节标题（来自 MongoDB section_data.text）
   * - file_id / file_name: 用于跳转 /knowledge/file/<file_id>
   * - preview: 片段正文摘要（截 200 字符）
   *
   * 所有字段都是 Optional：老会话历史里没有这些字段，CitationChip 会按短 hash
   * 降级渲染。
   */
  chunk_type?: string | null;
  page_index?: number | null;
  section_title?: string | null;
  file_id?: string | null;
  file_name?: string | null;
  preview?: string | null;
  /**
   * Phase B：session 级 chunk alias（`c1` / `c2` / `c10` ...）。
   * LLM 输出里的 `[cN]` 通过该字段反查 citation 元数据。
   * 老会话没有 alias 字段（值为 null/undefined），MarkdownAnswer 会回退到
   * 老的真实 chunk_id 匹配路径。
   */
  alias?: string | null;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result_brief?: string | null;
  items_added: number;
  /**
   * 仅前端使用的可选字段（后端持久化的 ToolCallItem 不返回）。
   * 用于在 WS 流式过程中即时展示"正在调用"的卡片：
   *   - tool_call.started: push 一条 {id, name, inflight:true, argsText:"", index}
   *   - tool_call.args_delta: 按 index 拼接 argsText，并尝试 JSON.parse 实时回填 arguments
   *   - tool_call.completed: 按 id 找到该记录，填入最终 arguments / result_brief / items_added，
   *     清掉 inflight 与 argsText
   */
  inflight?: boolean;
  argsText?: string;
  index?: number;
}

export interface TokenUsageRecord {
  prompt_tokens: number;
  completion_tokens: number;
  thinking_tokens?: number | null;
  total_tokens: number;
}

export interface ChatMessage {
  message_id: string;
  session_id: string;
  user_id?: string;
  role: ChatRole;
  content: string;
  thinking?: string | null;
  tool_calls: ToolCallRecord[];
  citations: Citation[];
  usage?: TokenUsageRecord | null;
  finish_reason?: string | null;
  tool_call_id?: string | null;
  metadata?: Record<string, unknown>;
  create_time?: string;
  update_time?: string;
}

export interface ChatSessionInfo {
  session_id: string;
  user_id: string;
  title: string;
  knowledge_base_ids: string[];
  model_preset: string;
  agent_mode: boolean;
  enable_thinking: boolean;
  max_tool_rounds: number;
  system_prompt?: string | null;
  message_count: number;
  last_message_at?: string | null;
  create_time?: string;
  update_time?: string;
}

// ---------------------------------------------------------------------------
// REST 请求/响应
// ---------------------------------------------------------------------------

export interface ChatSessionCreateRequest {
  title?: string;
  knowledge_base_ids: string[];
  model_preset?: string;
  agent_mode?: boolean;
  enable_thinking?: boolean;
  max_tool_rounds?: number;
  system_prompt?: string | null;
}

export interface ChatSessionRenameRequest {
  title: string;
}

export interface ChatSessionListResponse {
  items: ChatSessionInfo[];
  total: number;
  page: number;
  page_size: number;
}

export interface ChatMessageListResponse {
  items: ChatMessage[];
  total: number;
  page: number;
  page_size: number;
}

// ---------------------------------------------------------------------------
// WebSocket 帧定义（§4.2 / §4.3）
// ---------------------------------------------------------------------------

export interface ChatRequestPayload {
  session_id: string;
  query: string;
  agent_mode?: boolean | null;
  enable_thinking?: boolean | null;
  model_preset?: string | null;
  max_tool_rounds?: number | null;
  retrieve_top_k?: number | null;
  custom_system_prompt?: string | null;
  skip_retrieval?: boolean | null;
}

// 客户端 → 服务端
export type ClientFrame =
  | { type: "start"; data: ChatRequestPayload }
  | { type: "stop" }
  | { type: "ping" };

// retrieval.done 中的 chunks 预览
// Phase A 方案 B：种子 chunks 在 retrieval.done 帧里就带上 enrich 后的渲染字段，
// 前端可以直接预填到当前 user 消息或下一条 inflight assistant 的 citations 上，
// 这样 LLM 一吐出 [chunk-xxx] 就能直接渲染彩色 chip。
export interface RetrievalChunkPreview {
  chunk_id: string;
  document_id?: string | null;
  knowledge_base_id?: string | null;
  score: number;
  preview?: string | null;
  chunk_type?: string | null;
  page_index?: number | null;
  section_title?: string | null;
  file_id?: string | null;
  file_name?: string | null;
  /** Phase B：session 级短 alias（cN）。retrieval.done 帧提前下发供 alias chip 渲染。 */
  alias?: string | null;
}

// 服务端 → 客户端
export type ServerFrame =
  | {
      type: "ready";
      data: { subprotocol: string; user_id: string };
    }
  | { type: "pong"; data: Record<string, never> }
  | {
      type: "session.ready";
      data: {
        session_id: string;
        user_message_id: string;
        agent_mode: boolean;
        model_preset: string;
      };
    }
  | {
      type: "retrieval.started";
      data: { query: string; top_k: number };
    }
  | {
      type: "retrieval.done";
      data: {
        hit_count: number;
        time_ms: number;
        chunks: RetrievalChunkPreview[];
      };
    }
  | { type: "thinking.delta"; data: { text: string } }
  | { type: "content.delta"; data: { text: string } }
  | {
      type: "tool_call.started";
      data: { index: number; id: string; name: string };
    }
  | {
      type: "tool_call.args_delta";
      data: { index: number; text: string };
    }
  | {
      type: "tool_call.completed";
      data: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        result_brief?: string | null;
        items_added: number;
        time_ms?: number;
      };
    }
  | {
      type: "tool_round.done";
      data: {
        round: number;
        tool_calls: ToolCallRecord[];
      };
    }
  | {
      type: "message.done";
      data: {
        message_id: string;
        role: ChatRole;
        round: number | "final";
        finish_reason?: string | null;
        tool_calls_count: number;
        citations_count: number;
        /**
         * Phase A：本轮 assistant 的完整 citations（已含 enrich 字段）。
         * 直接挂到对应 UiChatMessage.citations，前端 CitationChip 即可渲染。
         */
        citations?: Citation[];
        usage?: TokenUsageRecord | null;
      };
    }
  | {
      type: "turn.done";
      data: {
        rounds: number;
        tool_calls_count: number;
        time_ms: number;
        user_message_id: string;
        assistant_message_ids: string[];
        citations_count?: number;
      };
    }
  | {
      type: "error";
      data: {
        phase: string;
        error: string;
        cancelled?: boolean;
        [key: string]: unknown;
      };
    };

export type ServerFrameType = ServerFrame["type"];

// ---------------------------------------------------------------------------
// 前端 UI 专用累积态
// ---------------------------------------------------------------------------

/** Chat 面板里渲染的一条消息（含进行中累积态） */
export interface UiChatMessage {
  /** 用 `chatmsg_*` 或本地 `local_*` 前缀；流式中先用临时 id，message.done 后换为后端 id */
  id: string;
  role: ChatRole;
  content: string;
  thinking?: string;
  tool_calls: ToolCallRecord[];
  citations: Citation[];
  usage?: TokenUsageRecord | null;
  finish_reason?: string | null;
  /** 是否是当前轮还在流式累积中的临时消息 */
  inflight?: boolean;
  /** 是否被用户 stop 中断（不写入后端但前端展示 chip） */
  cancelled?: boolean;
  /** 关联的检索状态（仅 user 消息触发的那一轮挂在 user 上） */
  retrieval?: {
    state: "started" | "done" | "failed";
    hit_count?: number;
    time_ms?: number;
    chunks?: RetrievalChunkPreview[];
    error?: string;
  };
  /** 仅本地展示用的时间戳 */
  created_at?: string;
}

/** tool_call 流式累积条目 */
export interface UiToolCall {
  index: number;
  id?: string;
  name?: string;
  argsText: string;
  args?: Record<string, unknown>;
  result_brief?: string | null;
  items_added?: number;
  completed: boolean;
}

export type ChatPhase =
  | "idle"
  | "connecting"
  | "ready"
  | "running"
  | "stopped"
  | "error"
  | "disconnected";
