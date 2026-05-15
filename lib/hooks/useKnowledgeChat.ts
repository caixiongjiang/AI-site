"use client";

/**
 * 知识库对话主 Hook：把 REST + WebSocket 的细节收敛在一处。
 *
 * 责任：
 *   1. 按 (knowledge_base_id) 维度 ensureSession / 列出该 KB 的会话
 *   2. 切换 active session 时通过 REST 回放历史消息
 *   3. 发送 query 时建/复用 WebSocket，按 §4.3 事件类型累积流式状态
 *   4. Stop / 错误 / 断线 / 首轮异步起标题等边界处理
 *
 * 不做的事：UI 渲染、Markdown 解析、滚动控制等都交给 KnowledgeChatPanel。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatStreamHandle,
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  openChatStream,
  renameChatSession,
} from "@/lib/api/chat";
import type {
  ChatMessage,
  ChatRequestPayload,
  ChatSessionInfo,
  Citation,
  RetrievalChunkPreview,
  ServerFrame,
  ToolCallRecord,
  UiChatMessage,
  UiToolCall,
  ChatPhase,
} from "@/lib/chat-types";

const PAGE_SIZE = 50;
const TITLE_POLL_DELAYS_MS = [1500, 4000, 9000];

export interface UseKnowledgeChatOptions {
  knowledgeBaseId: string | null;
  /** 用户登录态（未登录时不做任何后端调用） */
  enabled: boolean;
}

export interface SendOptions {
  /** 覆盖 session 默认 agent_mode */
  agentMode?: boolean;
  /** 覆盖 session 默认 enable_thinking */
  enableThinking?: boolean;
  /** 覆盖 session 默认 model_preset */
  modelPreset?: string;
  /** 覆盖 session 默认 max_tool_rounds */
  maxToolRounds?: number;
  /** 覆盖 session 默认 retrieve_top_k */
  retrieveTopK?: number;
  /** 跳过服务端无条件初次召回（仅特殊场景使用） */
  skipRetrieval?: boolean;
}

export interface UseKnowledgeChatResult {
  sessions: ChatSessionInfo[];
  activeSession: ChatSessionInfo | null;
  activeSessionId: string | null;
  messages: UiChatMessage[];
  phase: ChatPhase;
  /** 最近一次错误（致命/非致命都会写） */
  lastError: string | null;
  /** 当前轮是否在流式中（与 phase=running 等价，便于 UI 判断） */
  isStreaming: boolean;
  /** 加载会话/历史消息中 */
  isLoading: boolean;
  selectSession: (sessionId: string) => Promise<void>;
  newSession: () => Promise<void>;
  renameActive: (title: string) => Promise<void>;
  deleteActive: () => Promise<void>;
  send: (query: string, opts?: SendOptions) => Promise<void>;
  stop: () => void;
  /** 主动关连接（一般在卸载时） */
  disconnect: () => void;
  /** 重置错误 chip */
  clearError: () => void;
}

function fromBackendMessage(message: ChatMessage): UiChatMessage {
  return {
    id: message.message_id,
    role: message.role,
    content: message.content ?? "",
    thinking: message.thinking ?? undefined,
    tool_calls: message.tool_calls ?? [],
    citations: message.citations ?? [],
    usage: message.usage ?? undefined,
    finish_reason: message.finish_reason ?? null,
    created_at: message.create_time,
  };
}

function makeLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useKnowledgeChat(
  options: UseKnowledgeChatOptions
): UseKnowledgeChatResult {
  const { knowledgeBaseId, enabled } = options;

  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ---- 持久 refs（不触发 re-render） ----
  const wsRef = useRef<ChatStreamHandle | null>(null);
  /** 当 ready 帧到达后调用 */
  const pendingStartRef = useRef<ChatRequestPayload | null>(null);
  /** 当前轮临时 assistant 消息 id，便于 message.done 时定位 */
  const inflightAssistantIdRef = useRef<string | null>(null);
  /**
   * 最近一次完成 LLM 流的 assistant 消息 id（保持到 turn.done 才清）。
   *
   * 后端事件顺序是：tool_call.started/args_delta → message.done(round N) →
   * tool_call.completed → tool_round.done → 下一轮 content.delta …
   *
   * `message.done` 会清掉 `inflightAssistantIdRef`，但其后到达的
   * `tool_call.completed` 仍然属于刚结束流的那条 assistant 消息——必须靠这个
   * "上一条 assistant 消息 id" 兜底，否则工具结果就被丢了，等到刷新走历史
   * 回放才会出现。
   */
  const lastAssistantIdRef = useRef<string | null>(null);
  /** 当前轮临时 user 消息 id（挂检索状态） */
  const inflightUserIdRef = useRef<string | null>(null);
  /** 当前轮的 tool_call 累积器：index → 累积 */
  const inflightToolCallsRef = useRef<Map<number, UiToolCall>>(new Map());
  /** 当前轮 round 0 / round 1 ... 区分主流程进度 */
  const currentRoundRef = useRef<number>(0);
  /**
   * 方案 B 核心：turn 级 citations 累积器（chunk_id → Citation）。
   *
   * - retrieval.done 帧到达时立即用种子 chunks 填充本 ref，让 LLM 一吐出
   *   [chunk-xxx] 就能从这里查到完整渲染信息（彩色 chip + hover preview）。
   * - 后续 message.done 帧带的本轮完整 citations 会覆盖到 ref（含工具补充）。
   * - ensureInflightAssistant 创建临时 assistant 时把 ref 当前快照作为初始
   *   citations，使流式渲染期间 markdown 拦截器能立即命中。
   * - turn.done / resetInflight 时清空。
   */
  const turnCitationsRef = useRef<Map<string, Citation>>(new Map());
  /** 起标题轮询用 */
  const titleTimersRef = useRef<number[]>([]);
  /** 当前活跃 session id 的 ref 副本，便于 close handler 里读取最新值 */
  const activeSessionIdRef = useRef<string | null>(null);

  // 同步 ref
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // -------------------------------------------------------------------------
  // 内部工具：清理一切轮内累积态
  // -------------------------------------------------------------------------
  const resetInflight = useCallback(() => {
    inflightAssistantIdRef.current = null;
    lastAssistantIdRef.current = null;
    inflightUserIdRef.current = null;
    inflightToolCallsRef.current = new Map();
    currentRoundRef.current = 0;
    turnCitationsRef.current = new Map();
  }, []);

  const clearTitleTimers = useCallback(() => {
    titleTimersRef.current.forEach((id) => window.clearTimeout(id));
    titleTimersRef.current = [];
  }, []);

  // -------------------------------------------------------------------------
  // 历史会话加载（按 KB 过滤）
  // -------------------------------------------------------------------------
  const loadSessionsForKb = useCallback(
    async (kbId: string): Promise<ChatSessionInfo[]> => {
      // 服务端按 knowledge_base_id 直接过滤；同时保留客户端兜底过滤，
      // 兼容旧后端版本（若返回了未过滤的列表，前端再筛一道也不会丢数据）。
      const list = await listChatSessions({
        page: 1,
        page_size: 100,
        knowledge_base_id: kbId,
      });
      const items = list.items ?? [];
      const filtered = items.every((s) => Array.isArray(s.knowledge_base_ids))
        ? items.filter((s) => (s.knowledge_base_ids ?? []).includes(kbId))
        : items;
      setSessions(filtered);
      return filtered;
    },
    []
  );

  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    const data = await listChatMessages(sessionId, {
      page: 1,
      page_size: PAGE_SIZE,
    });
    const ui = (data.items ?? [])
      .filter((m) => m.role !== "tool" && m.role !== "system")
      .map(fromBackendMessage);
    setMessages(ui);
  }, []);

  // -------------------------------------------------------------------------
  // ensureSession：当前 KB 没有可用 session 就建一条
  // -------------------------------------------------------------------------
  const ensureSession = useCallback(
    async (kbId: string): Promise<ChatSessionInfo> => {
      const existing = await loadSessionsForKb(kbId);
      if (existing.length > 0) {
        const target = existing[0];
        setActiveSessionId(target.session_id);
        await loadMessagesForSession(target.session_id);
        return target;
      }
      const created = await createChatSession({
        knowledge_base_ids: [kbId],
        title: "新会话",
      });
      setSessions([created]);
      setActiveSessionId(created.session_id);
      setMessages([]);
      return created;
    },
    [loadMessagesForSession, loadSessionsForKb]
  );

  // -------------------------------------------------------------------------
  // KB 切换 → 重新装载
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !knowledgeBaseId) {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setPhase("idle");
      setLastError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLastError(null);

    void (async () => {
      try {
        await ensureSession(knowledgeBaseId);
        if (!cancelled) {
          setPhase("idle");
        }
      } catch (error) {
        if (!cancelled) {
          setLastError(
            error instanceof Error ? error.message : "加载会话失败"
          );
          setPhase("error");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [knowledgeBaseId, enabled, ensureSession]);

  // -------------------------------------------------------------------------
  // WebSocket 帧分发
  // -------------------------------------------------------------------------
  const handleFrame = useCallback(
    (frame: ServerFrame) => {
      switch (frame.type) {
        case "ready": {
          // 收到 ready 后立即把 pending 的 start 发出
          const pending = pendingStartRef.current;
          pendingStartRef.current = null;
          if (pending && wsRef.current) {
            setPhase("running");
            wsRef.current.start(pending);
          } else {
            setPhase("ready");
          }
          break;
        }

        case "pong": {
          break;
        }

        case "session.ready": {
          // 后端确认 user 消息已落库；这里只是状态提示
          break;
        }

        case "retrieval.started": {
          const userId = inflightUserIdRef.current;
          if (!userId) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userId
                ? { ...m, retrieval: { state: "started" } }
                : m
            )
          );
          break;
        }

        case "retrieval.done": {
          const userId = inflightUserIdRef.current;
          const { hit_count, time_ms, chunks } = frame.data;
          const previewChunks = chunks as RetrievalChunkPreview[];

          // 方案 B：把种子 chunks 提前进入 turn 级 citations 缓存。
          // ensureInflightAssistant 创建临时 assistant 时会把这些种子作为初始
          // citations 挂上，使 content.delta 流到 [chunk-xxx] 时能立即彩色渲染。
          for (const c of previewChunks) {
            if (!c.chunk_id) continue;
            const cite: Citation = {
              chunk_id: c.chunk_id,
              document_id: c.document_id ?? null,
              knowledge_base_id: c.knowledge_base_id ?? null,
              score: c.score ?? 0,
              chunk_type: c.chunk_type ?? null,
              page_index: c.page_index ?? null,
              section_title: c.section_title ?? null,
              file_id: c.file_id ?? null,
              file_name: c.file_name ?? null,
              preview: c.preview ?? null,
              // Phase B：alias 提前下发，使流式期间 [cN] chip 能即时彩色渲染。
              alias: c.alias ?? null,
            };
            turnCitationsRef.current.set(c.chunk_id, cite);
          }

          if (userId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userId
                  ? {
                      ...m,
                      retrieval: {
                        state: "done",
                        hit_count,
                        time_ms,
                        chunks: previewChunks,
                      },
                    }
                  : m
              )
            );
          }
          break;
        }

        case "thinking.delta": {
          const id = inflightAssistantIdRef.current;
          if (!id) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, thinking: (m.thinking ?? "") + frame.data.text }
                : m
            )
          );
          break;
        }

        case "content.delta": {
          const id = inflightAssistantIdRef.current;
          if (!id) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, content: m.content + frame.data.text } : m
            )
          );
          break;
        }

        case "tool_call.started": {
          // 累积到 ref（用于按 index 找回 args 增量）
          const buf = new Map(inflightToolCallsRef.current);
          buf.set(frame.data.index, {
            index: frame.data.index,
            id: frame.data.id,
            name: frame.data.name,
            argsText: "",
            completed: false,
          });
          inflightToolCallsRef.current = buf;

          // 同时立刻往当前 assistant 消息上 push 一条"进行中"占位卡片，
          // 让前端立刻显示蓝色框（之前只在 completed 才 push，
          // 导致整个工具运行期间都看不到任何痕迹）。
          const targetId =
            inflightAssistantIdRef.current ?? lastAssistantIdRef.current;
          if (!targetId) break;
          const placeholder: ToolCallRecord = {
            id: frame.data.id,
            name: frame.data.name,
            arguments: {},
            result_brief: null,
            items_added: 0,
            inflight: true,
            argsText: "",
            index: frame.data.index,
          };
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== targetId) return m;
              const dup = m.tool_calls.some(
                (t) => t.id === placeholder.id || t.index === placeholder.index
              );
              return dup
                ? m
                : { ...m, tool_calls: [...m.tool_calls, placeholder] };
            })
          );
          break;
        }

        case "tool_call.args_delta": {
          // 维护 ref 累积
          const buf = new Map(inflightToolCallsRef.current);
          const existing = buf.get(frame.data.index) ?? {
            index: frame.data.index,
            argsText: "",
            completed: false,
          };
          const merged = {
            ...existing,
            argsText: existing.argsText + frame.data.text,
          };
          buf.set(frame.data.index, merged);
          inflightToolCallsRef.current = buf;

          // 同步把累积的 argsText（以及尝试性 JSON.parse 后的 arguments）
          // 反映到消息上的占位卡片，UI 即时刷新
          const targetId =
            inflightAssistantIdRef.current ?? lastAssistantIdRef.current;
          if (!targetId) break;
          let parsedArgs: Record<string, unknown> | null = null;
          try {
            parsedArgs = JSON.parse(merged.argsText);
          } catch {
            parsedArgs = null;
          }
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== targetId) return m;
              return {
                ...m,
                tool_calls: m.tool_calls.map((t) =>
                  t.index === frame.data.index
                    ? {
                        ...t,
                        argsText: merged.argsText,
                        arguments:
                          parsedArgs && typeof parsedArgs === "object"
                            ? parsedArgs
                            : t.arguments,
                      }
                    : t
                ),
              };
            })
          );
          break;
        }

        case "tool_call.completed": {
          // 维护 ref（保持原有兼容）
          const buf = new Map(inflightToolCallsRef.current);
          let matchedIndex: number | null = null;
          for (const [idx, tc] of buf.entries()) {
            if (tc.id === frame.data.id) {
              matchedIndex = idx;
              break;
            }
          }
          if (matchedIndex === null) {
            for (const [idx, tc] of buf.entries()) {
              if (!tc.completed) {
                matchedIndex = idx;
                break;
              }
            }
          }
          if (matchedIndex !== null) {
            const existing = buf.get(matchedIndex)!;
            buf.set(matchedIndex, {
              ...existing,
              id: frame.data.id,
              name: frame.data.name,
              args: frame.data.args,
              result_brief: frame.data.result_brief ?? null,
              items_added: frame.data.items_added,
              completed: true,
            });
            inflightToolCallsRef.current = buf;
          }

          // 关键：completed 通常发生在 message.done 之后，inflightAssistantIdRef
          // 已被清空——这里改用 lastAssistantIdRef 兜底；先按 id 匹配占位卡片，
          // 没找到再按未 inflight 的最早一条匹配，再没找到才 push 新条目。
          const targetId =
            inflightAssistantIdRef.current ?? lastAssistantIdRef.current;
          if (!targetId) break;
          const completedRecord: ToolCallRecord = {
            id: frame.data.id,
            name: frame.data.name,
            arguments: frame.data.args,
            result_brief: frame.data.result_brief ?? null,
            items_added: frame.data.items_added,
            inflight: false,
          };
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== targetId) return m;
              let matched = false;
              const updated = m.tool_calls.map((t) => {
                if (matched) return t;
                if (
                  t.id === completedRecord.id ||
                  (t.inflight &&
                    matchedIndex !== null &&
                    t.index === matchedIndex)
                ) {
                  matched = true;
                  return {
                    ...t,
                    ...completedRecord,
                    argsText: undefined,
                  };
                }
                return t;
              });
              return {
                ...m,
                tool_calls: matched ? updated : [...updated, completedRecord],
              };
            })
          );
          break;
        }

        case "tool_round.done": {
          // 一轮工具批次结束；本轮的 tool_calls 已经累积到 assistant 上了
          currentRoundRef.current = frame.data.round + 1;
          // 清空 tool_call 累积器，准备下一轮
          inflightToolCallsRef.current = new Map();
          break;
        }

        case "message.done": {
          const id = inflightAssistantIdRef.current;
          if (!id) break;
          // 把临时 id 替换为后端 message_id，并固化 inflight 标志
          const backendId = frame.data.message_id;

          // 方案 B：把本轮权威 citations 合并进 turn 级缓存，同时刷新到当前
          // assistant 消息上。后端第 0 轮的 citations 已含完整种子；后续轮次只带
          // "本轮新增"，所以这里用 merge 语义（按 chunk_id 覆盖），不是替换。
          const roundCitations = (frame.data.citations ?? []) as Citation[];
          for (const c of roundCitations) {
            if (c?.chunk_id) {
              turnCitationsRef.current.set(c.chunk_id, c);
            }
          }
          const mergedCitations: Citation[] = Array.from(
            turnCitationsRef.current.values()
          );

          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    id: backendId,
                    inflight: false,
                    citations:
                      mergedCitations.length > 0 ? mergedCitations : m.citations,
                    finish_reason: frame.data.finish_reason ?? null,
                    usage: frame.data.usage ?? m.usage ?? null,
                  }
                : m
            )
          );
          // 把 inflight 切到 last：随后到达的 tool_call.completed 还要往这条
          // 消息上挂结果（事件顺序见 lastAssistantIdRef 注释）。
          // 注意：这里必须存 backendId 而不是 id —— 上面的 setMessages 已经把
          // 该消息的 id 从 local 临时 id 换成 backendId 了，后续 tool_call.completed
          // 用 lastAssistantIdRef 兜底匹配时 m.id 是 backendId。存 local id 会
          // 永远匹配不到，导致工具结果被静默丢弃、卡片卡在"调用中…"。
          lastAssistantIdRef.current = backendId;
          inflightAssistantIdRef.current = null;
          break;
        }

        case "turn.done": {
          // 整轮收尾：同时把 message 自身和所有 tool_call 占位卡片的 inflight 清零，
          // 防止极端情况下（tool_call.completed 漏帧 / id 漂移）UI 永远卡在
          // "调用中…"。tool_call 缺失的结果会在下一次会话回放走 REST 历史时补齐
          // （后端 _persist_assistant 已合并了 result_brief / items_added）。
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              inflight: false,
              tool_calls: m.tool_calls.map((t) =>
                t.inflight
                  ? { ...t, inflight: false, argsText: undefined }
                  : t
              ),
            }))
          );
          resetInflight();
          setPhase("ready");

          // 首轮异步起标题：轮询拉 session
          const sid = activeSessionIdRef.current;
          if (sid) {
            // 仅当当前 session 仍然没有"用户自定义标题"时才轮询
            // 这里不做太严格的判断，统一三次轻量轮询，若 title 变化就同步到 sessions
            clearTitleTimers();
            TITLE_POLL_DELAYS_MS.forEach((delay) => {
              const id = window.setTimeout(async () => {
                try {
                  const fresh = await getChatSession(sid);
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.session_id === fresh.session_id ? fresh : s
                    )
                  );
                } catch {
                  // ignore
                }
              }, delay);
              titleTimersRef.current.push(id);
            });
          }
          break;
        }

        case "error": {
          const phaseStr = String(frame.data.phase ?? "");
          const errMsg = String(frame.data.error ?? "未知错误");
          const cancelled = frame.data.cancelled === true;

          if (cancelled || phaseStr === "stop") {
            // 用户主动中断：在最近一条 assistant/或 inflight 上挂 cancelled 标记
            const id = inflightAssistantIdRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id || (m.inflight && !id)
                  ? { ...m, inflight: false, cancelled: true }
                  : m
              )
            );
            resetInflight();
            setPhase("stopped");
            setLastError(null);
            return;
          }

          if (phaseStr === "retrieve") {
            // 检索失败：标记 user 消息的 retrieval 状态，不打断主流程
            const userId = inflightUserIdRef.current;
            if (userId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === userId
                    ? {
                        ...m,
                        retrieval: { state: "failed", error: errMsg },
                      }
                    : m
                )
              );
            }
            return;
          }

          // 其他错误（llm_stream / start / load_session …）视为致命
          setMessages((prev) =>
            prev.map((m) =>
              m.inflight ? { ...m, inflight: false, cancelled: true } : m
            )
          );
          resetInflight();
          setLastError(`${phaseStr ? `[${phaseStr}] ` : ""}${errMsg}`);
          setPhase("error");
          break;
        }

        default: {
          // 未知 frame type：忽略
          break;
        }
      }
    },
    [clearTitleTimers, resetInflight]
  );

  // 在新 round 收到 content/thinking 增量但没有 inflight assistant 时，自动新建一条临时 assistant
  // 由于 handleFrame 里我们用 setMessages(prev => prev.map(...))，无法直接 push，
  // 这里在 content.delta / thinking.delta case 里需要兜底。我们在上面的实现做了 if(!id) break，
  // 这里补一个：如果是 round>0 的新临时 assistant，turn 流程中我们在 message.done 后等到下一帧再补建。
  // 实现策略：在 content.delta 和 thinking.delta 的处理里增加"无 inflight 则新建"的兜底。
  // 为避免 closure 复杂度，我们重写 handleFrame 的两个 case。
  // —— 这部分逻辑下移到 ensureInflightAssistant() 工具方法。

  // 重写：把 content.delta / thinking.delta 改为先 ensureInflightAssistant
  // 通过 monkey-patch 不利于维护，下面是替代实现：抽工具函数。
  const ensureInflightAssistant = useCallback(() => {
    if (inflightAssistantIdRef.current) return;
    const tempId = makeLocalId("local_asst");
    inflightAssistantIdRef.current = tempId;
    // 方案 B：用 turn 级 citations 缓存的快照作为初始 citations。
    // 在 content.delta 流出 [chunk-xxx] 时，MarkdownRenderer 即可立刻命中
    // 完整渲染信息（而不是先显示降级短 hash，message.done 后才"亮起来"）。
    const initialCitations: Citation[] = Array.from(
      turnCitationsRef.current.values()
    );
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "assistant",
        content: "",
        tool_calls: [],
        citations: initialCitations,
        inflight: true,
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  // 包装 handleFrame：在 content/thinking delta 之前确保有 inflight assistant
  const dispatchFrame = useCallback(
    (frame: ServerFrame) => {
      if (frame.type === "content.delta" || frame.type === "thinking.delta") {
        ensureInflightAssistant();
      }
      handleFrame(frame);
    },
    [ensureInflightAssistant, handleFrame]
  );

  // -------------------------------------------------------------------------
  // 连接 / 复用 WebSocket
  // -------------------------------------------------------------------------
  const ensureWs = useCallback((): ChatStreamHandle => {
    const existing = wsRef.current;
    if (existing && existing.readyState() === WebSocket.OPEN) {
      return existing;
    }
    if (existing) {
      existing.close();
    }

    setPhase("connecting");
    const handle = openChatStream({
      onFrame: dispatchFrame,
      onOpen: () => {
        // ready 帧才是真正可发 start 的信号；这里只切 connecting → connecting
      },
      onClose: () => {
        wsRef.current = null;
        // 进行中的轮没收到 turn.done → 标记为中断
        setMessages((prev) =>
          prev.map((m) =>
            m.inflight ? { ...m, inflight: false, cancelled: true } : m
          )
        );
        resetInflight();
        setPhase((prev) =>
          prev === "running" || prev === "connecting" || prev === "ready"
            ? "disconnected"
            : prev
        );
      },
      onError: (err) => {
        setLastError(err.message);
      },
    });
    wsRef.current = handle;
    return handle;
  }, [dispatchFrame, resetInflight]);

  // -------------------------------------------------------------------------
  // 行为：选会话 / 新建 / 重命名 / 删除
  // -------------------------------------------------------------------------
  const selectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      setMessages([]);
      setIsLoading(true);
      setLastError(null);
      try {
        await loadMessagesForSession(sessionId);
        setPhase("idle");
      } catch (error) {
        setLastError(
          error instanceof Error ? error.message : "加载历史消息失败"
        );
        setPhase("error");
      } finally {
        setIsLoading(false);
      }
    },
    [activeSessionId, loadMessagesForSession]
  );

  const newSession = useCallback(async () => {
    if (!knowledgeBaseId) return;
    try {
      setIsLoading(true);
      const created = await createChatSession({
        knowledge_base_ids: [knowledgeBaseId],
        title: "新会话",
      });
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.session_id);
      setMessages([]);
      setLastError(null);
      setPhase("idle");
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "创建会话失败");
      setPhase("error");
    } finally {
      setIsLoading(false);
    }
  }, [knowledgeBaseId]);

  const renameActive = useCallback(
    async (title: string) => {
      if (!activeSessionId) return;
      const updated = await renameChatSession(activeSessionId, { title });
      setSessions((prev) =>
        prev.map((s) => (s.session_id === activeSessionId ? updated : s))
      );
    },
    [activeSessionId]
  );

  const deleteActive = useCallback(async () => {
    if (!activeSessionId || !knowledgeBaseId) return;
    await deleteChatSession(activeSessionId);
    const remaining = sessions.filter((s) => s.session_id !== activeSessionId);
    setSessions(remaining);
    if (remaining.length > 0) {
      const next = remaining[0];
      setActiveSessionId(next.session_id);
      await loadMessagesForSession(next.session_id);
    } else {
      // 当前 KB 没有会话了，自动建一条
      const created = await createChatSession({
        knowledge_base_ids: [knowledgeBaseId],
        title: "新会话",
      });
      setSessions([created]);
      setActiveSessionId(created.session_id);
      setMessages([]);
    }
  }, [activeSessionId, knowledgeBaseId, loadMessagesForSession, sessions]);

  // -------------------------------------------------------------------------
  // 行为：发送 / 中断
  // -------------------------------------------------------------------------
  const send = useCallback(
    async (query: string, opts: SendOptions = {}) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      if (!activeSessionId) return;
      if (phase === "running" || phase === "connecting") return;

      // push 用户消息（临时 id）
      const tempUserId = makeLocalId("local_user");
      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: "user",
          content: trimmed,
          tool_calls: [],
          citations: [],
          created_at: new Date().toISOString(),
        },
      ]);
      inflightUserIdRef.current = tempUserId;
      inflightAssistantIdRef.current = null;
      inflightToolCallsRef.current = new Map();
      currentRoundRef.current = 0;
      setLastError(null);

      // 注意：后端 ChatRequestPayload 用 Pydantic 校验；其中 skip_retrieval 是
      // 严格 bool（不接受 null），其余字段虽是 Optional 但也建议 omit 而不是
      // 显式传 null —— "缺省" 才是协议里 "沿用 session 默认" 的正确表达。
      const payload: ChatRequestPayload = {
        session_id: activeSessionId,
        query: trimmed,
      };
      if (opts.agentMode !== undefined) payload.agent_mode = opts.agentMode;
      if (opts.enableThinking !== undefined) {
        payload.enable_thinking = opts.enableThinking;
      }
      if (opts.modelPreset !== undefined) {
        payload.model_preset = opts.modelPreset;
      }
      if (opts.maxToolRounds !== undefined) {
        payload.max_tool_rounds = opts.maxToolRounds;
      }
      if (opts.retrieveTopK !== undefined) {
        payload.retrieve_top_k = opts.retrieveTopK;
      }
      if (opts.skipRetrieval !== undefined) {
        payload.skip_retrieval = opts.skipRetrieval;
      }

      const handle = ensureWs();
      if (handle.readyState() === WebSocket.OPEN) {
        // 已经 OPEN 但 ready 帧理论上应已经收到（连接复用时）；直接 start
        setPhase("running");
        handle.start(payload);
      } else {
        // 等 ready 帧
        pendingStartRef.current = payload;
      }
    },
    [activeSessionId, ensureWs, phase]
  );

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.stop();
  }, []);

  const disconnect = useCallback(() => {
    clearTitleTimers();
    wsRef.current?.close();
    wsRef.current = null;
    pendingStartRef.current = null;
    resetInflight();
  }, [clearTitleTimers, resetInflight]);

  const clearError = useCallback(() => {
    setLastError(null);
    if (phase === "error") setPhase("idle");
  }, [phase]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // KB 切换 → 重连前先关掉旧连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      pendingStartRef.current = null;
    };
  }, [knowledgeBaseId]);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.session_id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    messages,
    phase,
    lastError,
    isStreaming: phase === "running" || phase === "connecting",
    isLoading,
    selectSession,
    newSession,
    renameActive,
    deleteActive,
    send,
    stop,
    disconnect,
    clearError,
  };
}
