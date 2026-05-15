"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  CircleStop,
  Cpu,
  Database,
  Folder,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import { useKnowledgeChat } from "@/lib/hooks/useKnowledgeChat";
import { MarkdownAnswer } from "@/components/knowledge/MarkdownAnswer";
import { stripHtmlToPlain } from "@/components/knowledge/citationPreviewUtils";
import type {
  ChatPhase,
  ChatSessionInfo,
  Citation,
  ToolCallRecord,
  UiChatMessage,
} from "@/lib/chat-types";
import { cn, formatDate } from "@/lib/utils";

interface KnowledgeChatPanelProps {
  knowledgeBaseId: string | null;
  knowledgeBaseName?: string;
  selectedFolderName?: string | null;
  /** 仍然兼容外层禁用 */
  disabled?: boolean;
  disabledReason?: string;
  /** 用户登录态（未登录时不发任何后端请求） */
  enabled?: boolean;
  /**
   * 紧凑模式：用于父容器宽度受限的场景（如文件详情侧栏）。
   * 此模式下会隐藏左侧会话栏，改为顶栏 popover；toolbar 仅保留必要 chip。
   */
  compact?: boolean;
  className?: string;
}

const STARTER_PROMPTS = [
  "总结当前知识库里最值得先看的内容",
  "梳理这个知识库适合怎么提问",
  "从当前资料里提炼重点和潜在风险",
];

const MODEL_PRESETS: Array<{ value: string; label: string; hint: string }> = [
  { value: "fast", label: "Fast", hint: "默认 / 性价比" },
  { value: "smart", label: "Smart", hint: "强推理" },
  { value: "chat_reasoning", label: "Reasoning", hint: "思考链特化" },
];

const SESSION_DEFAULT_VISIBLE = 5;

interface ChatSettings {
  agentMode: boolean;
  enableThinking: boolean;
  modelPreset: string;
  maxToolRounds: number;
}

// ============================================================
// 通用展示子组件（与上一版语义一致）
// ============================================================

function PhasePill({ phase }: { phase: ChatPhase }) {
  const map: Record<
    ChatPhase,
    { label: string; tone: "muted" | "running" | "error" | "ok" }
  > = {
    idle: { label: "空闲", tone: "muted" },
    connecting: { label: "连接中…", tone: "running" },
    ready: { label: "就绪", tone: "ok" },
    running: { label: "回答中…", tone: "running" },
    stopped: { label: "已停止", tone: "muted" },
    error: { label: "异常", tone: "error" },
    disconnected: { label: "已断开", tone: "error" },
  };
  const { label, tone } = map[phase];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        tone === "muted" && "bg-gray-100 text-muted",
        tone === "ok" && "bg-emerald-50 text-emerald-700",
        tone === "running" && "bg-primary/10 text-primary",
        tone === "error" && "bg-red-50 text-red-600"
      )}
    >
      {tone === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </span>
  );
}

function ThinkingBlock({
  thinking,
  inflight,
}: {
  thinking: string;
  inflight: boolean;
}) {
  const [open, setOpen] = useState(inflight);

  useEffect(() => {
    if (inflight) setOpen(true);
  }, [inflight]);

  if (!thinking) return null;

  return (
    <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-amber-800"
      >
        <span className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5" />
          {inflight ? "正在思考…" : "思考过程"}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {open ? (
        <div className="border-t border-amber-200/70 px-3 py-2 text-xs leading-6 text-amber-900 whitespace-pre-wrap">
          {thinking}
        </div>
      ) : null}
    </div>
  );
}

function ToolCallTimeline({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  if (!toolCalls || toolCalls.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {toolCalls.map((tc) => (
        <ToolCallRow key={tc.id} tc={tc} />
      ))}
    </div>
  );
}

function ToolCallRow({ tc }: { tc: ToolCallRecord }) {
  const [open, setOpen] = useState(false);
  const inflight = Boolean(tc.inflight);
  const hasArgs =
    tc.arguments && Object.keys(tc.arguments).length > 0;

  const argsPreview = useMemo(() => {
    if (hasArgs) {
      try {
        return JSON.stringify(tc.arguments, null, 2);
      } catch {
        return String(tc.arguments);
      }
    }
    if (tc.argsText) return tc.argsText;
    return "（暂无参数）";
  }, [tc.arguments, tc.argsText, hasArgs]);

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs transition-colors",
        inflight
          ? "border-blue-300 bg-blue-50/70 ring-1 ring-blue-200/70"
          : "border-blue-200 bg-blue-50/40"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-blue-900"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {inflight ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
          ) : (
            <Wrench className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate font-medium">
            {tc.name || "tool_call"}
          </span>
          <span className="shrink-0 text-blue-700/80">
            {inflight
              ? "· 调用中…"
              : `· 新增 ${tc.items_added} 段`}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <div>
            <div className="mb-1 text-[11px] text-blue-800/70">参数</div>
            <pre className="whitespace-pre-wrap break-all rounded-lg bg-white/70 p-2 text-[11px] leading-5 text-blue-900">
              {argsPreview}
            </pre>
          </div>
          {inflight ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1.5 text-[11px] text-blue-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在调用工具，结果稍后返回…
            </div>
          ) : tc.result_brief ? (
            <div>
              <div className="mb-1 text-[11px] text-blue-800/70">
                结果摘要
              </div>
              <div className="rounded-lg bg-white/70 p-2 text-[11px] leading-5 text-blue-900 whitespace-pre-wrap break-all">
                {tc.result_brief}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-blue-700/70">
              （工具未返回摘要）
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function docGroupKey(c: { file_id?: string | null; file_name?: string | null; document_id?: string | null; chunk_id: string }): string {
  return c.file_id ?? c.file_name ?? c.document_id ?? c.chunk_id;
}

/** 底部引用区：按文档聚合，文件名 + 该文档首次命中片段纯文本前 20 字（替代 chunk id 网格） */
function ReferencedDocumentsBlock({
  citations,
  onOpenAllSources,
}: {
  citations: UiChatMessage["citations"];
  onOpenAllSources?: (citations: Citation[]) => void;
}) {
  if (!citations || citations.length === 0) return null;

  const order: string[] = [];
  const rows = new Map<
    string,
    { title: string; snippet: string; fileId: string | null | undefined }
  >();

  for (const c of citations) {
    const key = docGroupKey(c);
    if (rows.has(key)) continue;
    order.push(key);
    const title = (c.file_name as string | undefined) || c.file_id || "未知文档";
    const plain = stripHtmlToPlain((c.preview ?? "").trim());
    const snippet =
      plain.length > 0
        ? `${plain.slice(0, 20)}${plain.length > 20 ? "…" : ""}`
        : "";
    rows.set(key, { title, snippet, fileId: c.file_id });
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-gray-500">
          参考文档 · {order.length}
        </div>
        {onOpenAllSources ? (
          <button
            type="button"
            onClick={() => onOpenAllSources(citations)}
            className="shrink-0 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            全部来源 {citations.length}
          </button>
        ) : null}
      </div>
      <ol className="list-none space-y-2 p-0 m-0">
        {order.map((key) => {
          const r = rows.get(key)!;
          const openFile = () => {
            if (!r.fileId) return;
            window.open(
              `/knowledge/file/${encodeURIComponent(r.fileId)}`,
              "_blank",
              "noopener,noreferrer"
            );
          };
          return (
            <li
              key={key}
              className={cn(
                "rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm",
                r.fileId && "cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02]"
              )}
              onClick={r.fileId ? openFile : undefined}
              onKeyDown={
                r.fileId
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFile();
                      }
                    }
                  : undefined
              }
              role={r.fileId ? "link" : undefined}
              tabIndex={r.fileId ? 0 : undefined}
            >
              <div className="text-[13px] font-medium leading-snug text-foreground">
                {r.title}
              </div>
              {r.snippet ? (
                <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {r.snippet}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-muted-foreground/80">
                  （无预览文本）
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RetrievalChip({ retrieval }: { retrieval: UiChatMessage["retrieval"] }) {
  if (!retrieval) return null;
  const base =
    "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]";
  if (retrieval.state === "started") {
    return (
      <span className={cn(base, "bg-primary/10 text-primary")}>
        <Loader2 className="h-3 w-3 animate-spin" />
        正在检索知识库…
      </span>
    );
  }
  if (retrieval.state === "failed") {
    return (
      <span className={cn(base, "bg-red-50 text-red-600")}>
        <AlertTriangle className="h-3 w-3" />
        检索失败：{retrieval.error ?? "已按空命中继续"}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-emerald-50 text-emerald-700")}>
      <Database className="h-3 w-3" />
      命中 {retrieval.hit_count ?? 0} 段 · {retrieval.time_ms ?? 0}ms
    </span>
  );
}

function ReferencesSidePanel({
  citations,
  onClose,
}: {
  citations: Citation[];
  onClose: () => void;
}) {
  return (
    <aside
      className="flex min-h-0 w-[min(380px,42vw)] max-w-[100vw] shrink-0 flex-col border-l border-gray-200 bg-white"
      aria-label="参考来源"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          参考来源 · {citations.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
          aria-label="关闭参考来源"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {citations.map((c, i) => {
          const pageText =
            typeof c.page_index === "number" ? `p.${c.page_index + 1}` : null;
          const title =
            (c.section_title && c.section_title.trim()) ||
            c.file_name ||
            "引用片段";
          const rawPlain = stripHtmlToPlain((c.preview ?? "").trim());
          const snippet =
            rawPlain.length > 120
              ? `${rawPlain.slice(0, 120)}…`
              : rawPlain;

          const openFile = () => {
            if (!c.file_id) return;
            window.open(
              `/knowledge/file/${encodeURIComponent(c.file_id)}`,
              "_blank",
              "noopener,noreferrer"
            );
          };

          return (
            <div
              key={`${c.chunk_id}-${i}`}
              className="border-b border-gray-100 px-4 py-3 last:border-b-0"
            >
              <div className="flex gap-2">
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-snug text-foreground">
                    {title}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {(c.file_name || "未知文件") +
                      (pageText ? ` · ${pageText}` : "")}
                  </div>
                  {snippet ? (
                    <div className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {snippet}
                    </div>
                  ) : null}
                  {c.file_id ? (
                    <button
                      type="button"
                      onClick={openFile}
                      className="mt-2 text-[11px] text-primary hover:underline"
                    >
                      打开原文档
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function MessageBubble({
  message,
  onOpenSourcesPanel,
}: {
  message: UiChatMessage;
  onOpenSourcesPanel?: (citations: Citation[]) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-3 animate-fadeIn">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm",
          isUser ? "bg-gray-100 text-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? "你" : <Sparkles className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        {!isUser ? (
          <ThinkingBlock
            thinking={message.thinking ?? ""}
            inflight={Boolean(message.inflight)}
          />
        ) : null}

        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-7",
            isUser ? "bg-primary/5 text-foreground" : "bg-gray-50 text-foreground"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : message.content ? (
            <div className="markdown-body prose prose-sm max-w-none text-foreground prose-pre:bg-gray-900 prose-pre:text-gray-100">
              <MarkdownAnswer
                content={message.content}
                citations={message.citations}
              />
            </div>
          ) : message.inflight ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在生成回复…
            </div>
          ) : (
            <div className="text-xs text-muted">（无内容）</div>
          )}
        </div>

        {!isUser ? <ToolCallTimeline toolCalls={message.tool_calls} /> : null}
        {!isUser ? (
          <ReferencedDocumentsBlock
            citations={message.citations}
            onOpenAllSources={onOpenSourcesPanel}
          />
        ) : null}

        {isUser ? <RetrievalChip retrieval={message.retrieval} /> : null}

        {message.cancelled ? (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-muted">
            <CircleStop className="h-3 w-3" />
            已停止生成
          </div>
        ) : null}

        {!isUser && message.usage ? (
          <div className="mt-1.5 text-[10px] text-muted/70">
            tokens · prompt {message.usage.prompt_tokens} · completion{" "}
            {message.usage.completion_tokens}
            {typeof message.usage.thinking_tokens === "number"
              ? ` · thinking ${message.usage.thinking_tokens}`
              : ""}{" "}
            · total {message.usage.total_tokens}
          </div>
        ) : null}

        {message.created_at ? (
          <div className="mt-1 text-[10px] text-muted">
            {formatDate(message.created_at)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// 会话列表（左侧栏 / 紧凑模式 popover）
// ============================================================

interface SessionListProps {
  sessions: ChatSessionInfo[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onRename: (session: ChatSessionInfo) => void;
  onDelete: (session: ChatSessionInfo) => void;
}

function SessionRow({
  session,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  session: ChatSessionInfo;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
        active ? "bg-primary/8" : "hover:bg-gray-100"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col text-left"
      >
        <span
          className={cn(
            "truncate text-[12.5px] leading-5",
            active ? "text-primary" : "text-foreground"
          )}
          title={session.title || "新会话"}
        >
          {session.title || "新会话"}
        </span>
        <span className="mt-0.5 truncate text-[10.5px] leading-4 text-muted">
          {session.message_count} 条
          {session.last_message_at
            ? ` · ${formatDate(session.last_message_at)}`
            : " · 新建"}
        </span>
      </button>

      {/* hover 时直接出现编辑 / 删除两个图标，不再走 popup 菜单 */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-gray-200 hover:text-foreground"
          title="重命名"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
          title="删除"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onRename,
  onDelete,
}: SessionListProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? sessions
    : sessions.slice(0, SESSION_DEFAULT_VISIBLE);
  const hidden = sessions.length - visible.length;

  if (sessions.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted">
        暂无历史会话
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {visible.map((s) => (
        <SessionRow
          key={s.session_id}
          session={s}
          active={s.session_id === activeSessionId}
          onSelect={() => onSelect(s.session_id)}
          onRename={() => onRename(s)}
          onDelete={() => onDelete(s)}
        />
      ))}
      {sessions.length > SESSION_DEFAULT_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-primary hover:bg-primary/5"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              展开全部（还有 {hidden}）
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

function SessionPopover(props: SessionListProps & { onNew: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1 rounded-full border border-gray-200 px-2 text-[11px] text-foreground hover:border-primary"
      >
        <MessageSquare className="h-3 w-3" />
        历史
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <span className="text-xs font-medium text-foreground">会话</span>
              <button
                type="button"
                onClick={() => {
                  props.onNew();
                  setOpen(false);
                }}
                className="flex h-6 items-center gap-1 rounded-full border border-gray-200 px-2 text-[11px] text-foreground hover:border-primary"
              >
                <Plus className="h-3 w-3" />
                新建
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto py-2">
              <SessionList
                sessions={props.sessions}
                activeSessionId={props.activeSessionId}
                onSelect={(id) => {
                  props.onSelect(id);
                  setOpen(false);
                }}
                onRename={props.onRename}
                onDelete={props.onDelete}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ============================================================
// 顶部会话栏（侧边栏头部）
// ============================================================

function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: SessionListProps & { onNew: () => void }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-100 bg-gray-50/40 lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium text-foreground">历史会话</span>
        <button
          type="button"
          onClick={onNew}
          className="flex h-7 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 text-[11px] text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <MessageSquarePlus className="h-3 w-3" />
          新建
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </aside>
  );
}

// ============================================================
// 对话框工具条：Chat/Agent 切换 + 思考 + 模型 + (Agent 时) 工具轮
// ============================================================

function ModeToggle({
  agentMode,
  onChange,
  disabled,
}: {
  agentMode: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 text-[11px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          "flex h-6 items-center gap-1 rounded-full px-2.5 transition-colors",
          !agentMode
            ? "bg-primary/10 text-primary"
            : "text-muted hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60"
        )}
        title="Chat：仅检索后直接回答，不调用工具"
      >
        <MessageSquare className="h-3 w-3" />
        Chat
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          "flex h-6 items-center gap-1 rounded-full px-2.5 transition-colors",
          agentMode
            ? "bg-primary/10 text-primary"
            : "text-muted hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60"
        )}
        title="Agent：模型可主动调用检索 / 工具补全上下文"
      >
        <Wand2 className="h-3 w-3" />
        Agent
      </button>
    </div>
  );
}

function ThinkingChip({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={cn(
        "flex h-6 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors",
        enabled
          ? "border-amber-300 bg-amber-50 text-amber-700"
          : "border-gray-200 bg-white text-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-60"
      )}
      title={enabled ? "思考链已开启（Reasoning 模型可见思考过程）" : "开启思考链"}
    >
      <Brain className="h-3 w-3" />
      思考
    </button>
  );
}

function ModelChip({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current =
    MODEL_PRESETS.find((p) => p.value === value) ?? MODEL_PRESETS[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex h-6 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 text-[11px] text-foreground transition-colors hover:border-primary",
          disabled && "cursor-not-allowed opacity-60"
        )}
        title={`模型：${current.label} · ${current.hint}`}
      >
        <Cpu className="h-3 w-3" />
        {current.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {MODEL_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onChange(p.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50",
                  p.value === value && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "text-xs",
                    p.value === value ? "text-primary" : "text-foreground"
                  )}
                >
                  {p.label}
                </span>
                <span className="mt-0.5 text-[10px] text-muted">{p.hint}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ToolRoundsChip({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex h-6 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 text-[11px] text-foreground hover:border-primary",
          disabled && "cursor-not-allowed opacity-60"
        )}
        title="Agent 模式下允许的工具调用回合上限"
      >
        <Wrench className="h-3 w-3" />
        工具轮 {value}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-1 w-48 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
              <span>最大工具回合</span>
              <span className="text-foreground">{value}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChatToolbar({
  settings,
  onChange,
  isStreaming,
  compact,
}: {
  settings: ChatSettings;
  onChange: (next: ChatSettings) => void;
  isStreaming: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ModeToggle
        agentMode={settings.agentMode}
        disabled={isStreaming}
        onChange={(v) => onChange({ ...settings, agentMode: v })}
      />
      <ThinkingChip
        enabled={settings.enableThinking}
        disabled={isStreaming}
        onChange={(v) => onChange({ ...settings, enableThinking: v })}
      />
      <ModelChip
        value={settings.modelPreset}
        disabled={isStreaming}
        onChange={(v) => onChange({ ...settings, modelPreset: v })}
      />
      {settings.agentMode && !compact ? (
        <ToolRoundsChip
          value={settings.maxToolRounds}
          disabled={isStreaming}
          onChange={(v) => onChange({ ...settings, maxToolRounds: v })}
        />
      ) : null}
    </div>
  );
}

// ============================================================
// 主面板
// ============================================================

export const KnowledgeChatPanel = ({
  knowledgeBaseId,
  knowledgeBaseName,
  selectedFolderName,
  disabled = false,
  disabledReason,
  enabled = true,
  compact = false,
  className,
}: KnowledgeChatPanelProps) => {
  const chat = useKnowledgeChat({
    knowledgeBaseId,
    enabled: enabled && Boolean(knowledgeBaseId),
  });

  const {
    sessions,
    activeSession,
    activeSessionId,
    messages,
    phase,
    lastError,
    isStreaming,
    isLoading,
    selectSession,
    newSession,
    renameActive,
    deleteActive,
    send,
    stop,
    clearError,
  } = chat;

  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<ChatSettings>({
    agentMode: true,
    enableThinking: false,
    modelPreset: "fast",
    maxToolRounds: 5,
  });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sourcesSideCitations, setSourcesSideCitations] = useState<
    Citation[] | null
  >(null);

  // 切换 session 时同步 settings 到 session 默认值
  useEffect(() => {
    if (!activeSession) return;
    setSettings({
      agentMode: activeSession.agent_mode,
      enableThinking: activeSession.enable_thinking,
      modelPreset: activeSession.model_preset || "fast",
      maxToolRounds: activeSession.max_tool_rounds || 5,
    });
  }, [activeSession?.session_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动滚动到底
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isStreaming]);

  const effectiveDisabled = disabled || !knowledgeBaseId || !enabled;

  const handleSend = async (preset?: string) => {
    if (effectiveDisabled || isStreaming) return;
    const content = (preset ?? input).trim();
    if (!content) return;
    setInput("");
    await send(content, {
      agentMode: settings.agentMode,
      enableThinking: settings.enableThinking,
      modelPreset: settings.modelPreset,
      maxToolRounds: settings.maxToolRounds,
    });
  };

  const handleRename = async () => {
    if (!renameValue.trim()) {
      setRenaming(false);
      return;
    }
    try {
      await renameActive(renameValue.trim());
    } catch (err) {
      console.error(err);
    } finally {
      setRenaming(false);
      setRenameValue("");
    }
  };

  const handleSessionRename = (s: ChatSessionInfo) => {
    if (s.session_id !== activeSessionId) {
      void selectSession(s.session_id).then(() => {
        setRenaming(true);
        setRenameValue(s.title || "");
      });
    } else {
      setRenaming(true);
      setRenameValue(s.title || "");
    }
  };

  const handleSessionDelete = async (s: ChatSessionInfo) => {
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(`确定删除会话「${s.title || "新会话"}」？`)
        : true;
    if (!confirmed) return;
    if (s.session_id !== activeSessionId) {
      await selectSession(s.session_id);
    }
    try {
      await deleteActive();
    } catch (err) {
      console.error(err);
    }
  };

  const placeholder = effectiveDisabled
    ? "当前上下文不可问答"
    : `直接向「${activeSession?.title || knowledgeBaseName || "知识库"}」提问...`;

  return (
    <section
      className={cn(
        "flex h-full min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm",
        className
      )}
    >
      {/* 左侧会话栏（紧凑模式或 lg 以下隐藏，由 SessionSidebar 内部 lg:flex 控制） */}
      {!compact ? (
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={(id) => void selectSession(id)}
          onNew={() => void newSession()}
          onRename={handleSessionRename}
          onDelete={(s) => void handleSessionDelete(s)}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        {/* 主体（顶栏 + 通知 + 消息流 + 输入区） */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 顶部 */}
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {renaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename();
                      if (e.key === "Escape") {
                        setRenaming(false);
                        setRenameValue("");
                      }
                    }}
                    className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-0.5 text-sm outline-none focus:border-primary"
                  />
                ) : (
                  <span className="truncate" title={activeSession?.title}>
                    {activeSession?.title || "知识库问答"}
                  </span>
                )}
                <PhasePill phase={phase} />
              </div>
              <p className="mt-1 truncate text-[11px] leading-5 text-muted">
                {knowledgeBaseName
                  ? `围绕「${knowledgeBaseName}」展开问答`
                  : "选择一个知识库以开始问答"}
                {activeSession ? ` · ${activeSession.message_count} 条消息` : ""}
              </p>
            </div>

            {/* 紧凑模式：顶栏放新建 + 历史 popover */}
            {compact ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void newSession()}
                  className="flex h-7 items-center gap-1 rounded-full border border-gray-200 px-2 text-[11px] text-foreground hover:border-primary"
                  title="新建会话"
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  新建
                </button>
                <SessionPopover
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelect={(id) => void selectSession(id)}
                  onNew={() => void newSession()}
                  onRename={handleSessionRename}
                  onDelete={(s) => void handleSessionDelete(s)}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* folder 提示 */}
        {selectedFolderName ? (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <Folder className="mt-0.5 h-3.5 w-3.5" />
            <span>
              文件夹「{selectedFolderName}
              」级问答待后端支持，当前对话仍以整个知识库范围进行；入口已预留。
            </span>
          </div>
        ) : null}

        {phase === "disconnected" ? (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span className="flex-1">
              连接已断开。直接发送下一条消息即可自动重连。
            </span>
          </div>
        ) : null}

        {lastError ? (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span className="flex-1">{lastError}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              关闭
            </button>
          </div>
        ) : null}

        {/* 消息列表（唯一的滚动容器） */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 space-y-4 overflow-y-auto px-5 py-4"
        >
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-xs text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载历史消息…
            </div>
          ) : null}

          {messages.length === 0 && !isLoading && !effectiveDisabled ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-muted">
              还没有对话。可以试试下面 starter prompts，或直接输入你的问题。
              <div className="mt-3 flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void handleSend(p)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onOpenSourcesPanel={
                m.role === "assistant" && m.citations?.length
                  ? setSourcesSideCitations
                  : undefined
              }
            />
          ))}
        </div>

        {/* 输入区：参数扁平化 toolbar + textarea + 发送/停止 */}
        <div className="border-t border-gray-100 p-4">
          {disabledReason ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              {disabledReason}
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2.5 transition-colors focus-within:border-primary">
            <ChatToolbar
              settings={settings}
              onChange={setSettings}
              isStreaming={isStreaming}
              compact={compact}
            />
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={input}
                disabled={effectiveDisabled || isStreaming}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={compact ? 2 : 3}
                placeholder={placeholder}
                className={cn(
                  "flex-1 resize-none bg-transparent px-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted",
                  compact ? "min-h-[48px]" : "min-h-[64px]"
                )}
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition-colors hover:bg-red-400"
                  title="停止生成"
                >
                  <CircleStop className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={effectiveDisabled || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-muted"
                  title="发送（Enter）"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 px-1 text-[10px] text-muted">
              Enter 发送 · Shift + Enter 换行
            </div>
          </div>
        </div>
        </div>
        {sourcesSideCitations && sourcesSideCitations.length > 0 ? (
          <ReferencesSidePanel
            citations={sourcesSideCitations}
            onClose={() => setSourcesSideCitations(null)}
          />
        ) : null}
      </div>
    </section>
  );
};
