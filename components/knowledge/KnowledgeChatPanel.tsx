"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignJustify,
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  CircleStop,
  Copy,
  Cpu,
  Database,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Plus,
  Send,
  Share2,
  Sparkles,
  Table as TableIcon,
  ThumbsDown,
  ThumbsUp,
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
  RetrievalChunkPreview,
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

const CHUNK_TYPE_ICON: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  table: TableIcon,
  image: ImageIcon,
  text: AlignJustify,
};

/** 底部引用区：仅显示"全部来源"按钮，点击打开右侧面板按文档分组查看 */
function ReferencedDocumentsBlock({
  citations,
  onOpenAllSources,
}: {
  citations: UiChatMessage["citations"];
  onOpenAllSources?: (citations: Citation[]) => void;
}) {
  if (!citations || citations.length === 0) return null;

  const docCount = new Set(citations.map(docGroupKey)).size;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {onOpenAllSources ? (
        <button
          type="button"
          onClick={() => onOpenAllSources(citations)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Database className="h-3 w-3" />
          全部来源 · {docCount} 篇文档 · {citations.length} 段引用
        </button>
      ) : null}
    </div>
  );
}

/** 将 retrieval chunks 转为 Citation 格式（字段几乎一致，补 score 默认值） */
function retrievalChunksToCitations(
  chunks: RetrievalChunkPreview[] | undefined
): Citation[] {
  if (!chunks || chunks.length === 0) return [];
  return chunks.map((c) => ({
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
    alias: c.alias ?? null,
  }));
}

function RetrievalChip({
  retrieval,
  onViewChunks,
}: {
  retrieval: UiChatMessage["retrieval"];
  onViewChunks?: (citations: Citation[]) => void;
}) {
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

  const hasChunks =
    retrieval.chunks && retrieval.chunks.length > 0 && onViewChunks;

  return (
    <button
      type="button"
      disabled={!hasChunks}
      onClick={() => {
        if (hasChunks) {
          onViewChunks(retrievalChunksToCitations(retrieval.chunks));
        }
      }}
      className={cn(
        base,
        "bg-emerald-50 text-emerald-700 transition-colors",
        hasChunks
          ? "cursor-pointer hover:bg-emerald-100"
          : "cursor-default"
      )}
      title={hasChunks ? "点击查看检索结果" : undefined}
    >
      <Database className="h-3 w-3" />
      命中 {retrieval.hit_count ?? 0} 段 · {retrieval.time_ms ?? 0}ms
      {hasChunks ? (
        <span className="ml-0.5 text-emerald-600">· 查看</span>
      ) : null}
    </button>
  );
}

function ReferencesSidePanel({
  citations,
  onClose,
}: {
  citations: Citation[];
  onClose: () => void;
}) {
  // 按文档分组
  const docGroups = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<
      string,
      {
        fileName: string;
        fileId: string | null | undefined;
        citations: Array<Citation & { globalIndex: number }>;
      }
    >();

    citations.forEach((c, i) => {
      const key = docGroupKey(c);
      if (!groups.has(key)) {
        order.push(key);
        groups.set(key, {
          fileName: c.file_name || c.file_id || "未知文档",
          fileId: c.file_id,
          citations: [],
        });
      }
      groups.get(key)!.citations.push({ ...c, globalIndex: i + 1 });
    });

    return order.map((key) => ({ key, ...groups.get(key)! }));
  }, [citations]);

  return (
    <aside
      className="flex min-h-0 w-[min(380px,42vw)] max-w-[100vw] shrink-0 flex-col border-l border-gray-200 bg-white"
      aria-label="全部来源"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          全部来源 · {docGroups.length} 篇文档
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        tabIndex={-1}
        onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
      >
        {docGroups.map((doc) => (
          <DocGroup key={doc.key} doc={doc} />
        ))}
      </div>
    </aside>
  );
}

/** 将 preview 原文转为纯文本摘要（约 2 行，~80 字） */
function previewSnippet(preview: string | null | undefined): string {
  if (!preview) return "";
  const plain = stripHtmlToPlain(preview.trim());
  if (plain.length <= 80) return plain;
  return `${plain.slice(0, 80)}…`;
}

/**
 * 图片型引用的预览占位（后续替换为缩略图 / 图片预览）
 * TODO: 接入图片预览逻辑
 */
function ImageChunkPreview({ preview }: { preview?: string | null }) {
  const caption = preview
    ? (() => {
        const m = preview.match(/image_caption\s*:\s*(.+?)(?:\n|image_|$)/i);
        return m ? m[1].trim() : null;
      })()
    : null;

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <ImageIcon className="h-3 w-3 shrink-0 text-blue-600" />
      <span className="line-clamp-2">{caption || "（图片引用）"}</span>
    </div>
  );
}

/** 单个文档分组（默认折叠） */
function DocGroup({
  doc,
}: {
  doc: {
    key: string;
    fileName: string;
    fileId: string | null | undefined;
    citations: Array<Citation & { globalIndex: number }>;
  };
}) {
  const [open, setOpen] = useState(false);

  const openFile = () => {
    if (!doc.fileId) return;
    window.open(
      `/knowledge/file/${encodeURIComponent(doc.fileId)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* 文档标题行（可折叠） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50/70 px-4 py-2.5 text-left transition-colors hover:bg-gray-100/70"
      >
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-medium leading-snug text-foreground">
            {doc.fileName}
          </span>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            · {doc.citations.length} 段引用
          </span>
        </div>
        {doc.fileId ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              openFile();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                openFile();
              }
            }}
            className="shrink-0 rounded-md px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10"
          >
            打开文档
          </span>
        ) : null}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* 引用片段列表（折叠内容） */}
      {open ? (
        <div className="divide-y divide-gray-50">
          {doc.citations.map((c) => {
            const Icon =
              (c.chunk_type && CHUNK_TYPE_ICON[c.chunk_type]) || FileText;
            const pageText =
              typeof c.page_index === "number"
                ? `p.${c.page_index + 1}`
                : null;
            const isImage = c.chunk_type === "image";

            return (
              <div
                key={`${c.chunk_id}-${c.globalIndex}`}
                className="px-4 py-2.5"
              >
                {/* 头部：序号 + 图标 + 章节 + 页码 */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {c.globalIndex}
                  </span>
                  <Icon className="h-3 w-3 shrink-0 text-blue-700" />
                  {c.section_title ? (
                    <span className="truncate font-medium text-foreground">
                      {c.section_title}
                    </span>
                  ) : null}
                  {pageText ? <span>{pageText}</span> : null}
                </div>

                {/* 预览：图片走单独入口，其余显示 2 行纯文本 */}
                {isImage ? (
                  <ImageChunkPreview preview={c.preview} />
                ) : (
                  (() => {
                    const snippet = previewSnippet(c.preview);
                    return snippet ? (
                      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {snippet}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground/60">
                        （无预览文本）
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// 消息分组：连续 assistant 消息合并为一个视觉块
// ============================================================

interface MessageGroup {
  type: "user" | "assistant-group";
  messages: UiChatMessage[];
}

/** 把 messages 切分为 user 单条 + assistant 连续组 */
function groupMessages(messages: UiChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentAssistantGroup: UiChatMessage[] = [];

  const flushAssistant = () => {
    if (currentAssistantGroup.length > 0) {
      groups.push({ type: "assistant-group", messages: [...currentAssistantGroup] });
      currentAssistantGroup = [];
    }
  };

  for (const m of messages) {
    if (m.role === "user") {
      flushAssistant();
      groups.push({ type: "user", messages: [m] });
    } else if (m.role === "assistant") {
      currentAssistantGroup.push(m);
    }
    // tool / system 已在 hook 层被过滤，不会出现
  }
  flushAssistant();
  return groups;
}

// ============================================================
// 操作按钮栏（复制、点赞、反对、分享）
// ============================================================

function AssistantActionBar({ messages }: { messages: UiChatMessage[] }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<"up" | "down" | null>(null);

  const handleCopy = useCallback(() => {
    const text = messages
      .map((m) => m.content)
      .filter(Boolean)
      .join("\n\n");
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [messages]);

  const handleShare = useCallback(() => {
    const text = messages
      .map((m) => m.content)
      .filter(Boolean)
      .join("\n\n");
    if (navigator.share) {
      void navigator.share({ text });
    } else {
      void navigator.clipboard.writeText(text);
    }
  }, [messages]);

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] transition-colors",
          copied
            ? "bg-emerald-50 text-emerald-600"
            : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
        )}
        title="复制回答"
      >
        <Copy className="h-3 w-3" />
        {copied ? "已复制" : "复制"}
      </button>
      <button
        type="button"
        onClick={() => setLiked((v) => (v === "up" ? null : "up"))}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          liked === "up"
            ? "bg-emerald-50 text-emerald-600"
            : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
        )}
        title="赞"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setLiked((v) => (v === "down" ? null : "down"))}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          liked === "down"
            ? "bg-red-50 text-red-500"
            : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
        )}
        title="踩"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
        title="分享"
      >
        <Share2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ============================================================
// 单条用户消息
// ============================================================

function UserMessageBubble({
  message,
  onViewRetrievalChunks,
}: {
  message: UiChatMessage;
  onViewRetrievalChunks?: (citations: Citation[]) => void;
}) {
  return (
    <div className="flex gap-3 animate-fadeIn">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-sm text-foreground">
        你
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm leading-7 text-foreground">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        <RetrievalChip
          retrieval={message.retrieval}
          onViewChunks={onViewRetrievalChunks}
        />
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
// 连续 assistant 消息组（合并为一个视觉块）
// ============================================================

/** 单个 assistant round 的可折叠内容块（中间轮默认折叠，最后一轮 / 正在流式展开） */
function AssistantRoundBlock({
  message,
  isLast,
  isIntermediate,
}: {
  message: UiChatMessage;
  /** 是否是组内最后一条（最终总结） */
  isLast: boolean;
  /** 是否是中间轮（非最后一条且组内有多条） */
  isIntermediate: boolean;
}) {
  // 中间轮默认折叠；正在流式时保持展开；最后一轮始终展开
  const [collapsed, setCollapsed] = useState(isIntermediate && !message.inflight);

  // 当新的 round 出现后（当前 round 不再 inflight），自动折叠中间轮
  useEffect(() => {
    if (isIntermediate && !message.inflight) {
      setCollapsed(true);
    }
  }, [isIntermediate, message.inflight]);

  const m = message;
  const hasContent = Boolean(m.content);

  return (
    <div>
      {/* 思考块 */}
      {m.thinking ? (
        <ThinkingBlock
          thinking={m.thinking}
          inflight={Boolean(m.inflight)}
        />
      ) : null}

      {/* 中间轮折叠控制 */}
      {isIntermediate && hasContent ? (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {collapsed ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronUp className="h-3 w-3" />
          )}
          <span>{collapsed ? "展开中间过程" : "折叠中间过程"}</span>
        </button>
      ) : null}

      {/* 正文（中间轮可折叠） */}
      {hasContent && !collapsed ? (
        <div
          className={cn(
            "rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-7 text-foreground",
            // 中间轮样式区分：加一条左边框标识
            isIntermediate && "border-l-2 border-primary/20 rounded-l-lg"
          )}
        >
          <div className="markdown-body prose prose-sm max-w-none text-foreground prose-pre:bg-gray-900 prose-pre:text-gray-100">
            <MarkdownAnswer
              content={m.content}
              citations={m.citations}
            />
          </div>
        </div>
      ) : hasContent && collapsed ? (
        /* 折叠态：显示简短摘要 */
        <div
          className="cursor-pointer rounded-lg border-l-2 border-gray-200 bg-gray-50/50 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-gray-100"
          onClick={() => setCollapsed(false)}
        >
          <span className="line-clamp-1">{m.content.slice(0, 100)}{m.content.length > 100 ? "…" : ""}</span>
        </div>
      ) : m.inflight ? (
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在生成回复…
          </div>
        </div>
      ) : null}

      {/* 工具调用时间线（在每个 round 内紧跟正文，不随正文折叠） */}
      <ToolCallTimeline toolCalls={m.tool_calls} />

      {/* 已停止 */}
      {m.cancelled ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-muted">
          <CircleStop className="h-3 w-3" />
          已停止生成
        </div>
      ) : null}
    </div>
  );
}

function AssistantMessageGroup({
  messages,
  onOpenSourcesPanel,
}: {
  messages: UiChatMessage[];
  onOpenSourcesPanel?: (citations: Citation[]) => void;
}) {
  // 合并所有 round 的 citations（去重 by chunk_id，后来者覆盖）
  const mergedCitations = useMemo(() => {
    const map = new Map<string, Citation>();
    for (const m of messages) {
      for (const c of m.citations ?? []) {
        map.set(c.chunk_id, c);
      }
    }
    return Array.from(map.values());
  }, [messages]);

  const isGroupInflight = messages.some((m) => m.inflight);
  const lastMsg = messages[messages.length - 1];
  const hasMultipleRounds = messages.length > 1;

  return (
    <div className="flex gap-3 animate-fadeIn">
      {/* 头像 */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary text-sm">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {/* 每条 assistant 消息的内容连续渲染 */}
        {messages.map((m, idx) => {
          const isLast = idx === messages.length - 1;
          const isIntermediate = hasMultipleRounds && !isLast;
          return (
            <div key={m.id} className={idx > 0 ? "mt-3" : ""}>
              <AssistantRoundBlock
                message={m}
                isLast={isLast}
                isIntermediate={isIntermediate}
              />
            </div>
          );
        })}

        {/* ---- 以下内容仅在整组末尾显示一次 ---- */}

        {/* 操作按钮（复制、赞、踩、分享） */}
        {!isGroupInflight && messages.some((m) => m.content) ? (
          <AssistantActionBar messages={messages} />
        ) : null}

        {/* 全部来源：合并后的 citations 统一显示 */}
        {!isGroupInflight ? (
          <ReferencedDocumentsBlock
            citations={mergedCitations}
            onOpenAllSources={onOpenSourcesPanel}
          />
        ) : null}

        {/* token 统计（取最后一条的 usage，或汇总） */}
        {!isGroupInflight && lastMsg?.usage ? (
          <div className="mt-1.5 text-[10px] text-muted/70">
            tokens · prompt {lastMsg.usage.prompt_tokens} · completion{" "}
            {lastMsg.usage.completion_tokens}
            {typeof lastMsg.usage.thinking_tokens === "number"
              ? ` · thinking ${lastMsg.usage.thinking_tokens}`
              : ""}{" "}
            · total {lastMsg.usage.total_tokens}
          </div>
        ) : null}

        {lastMsg?.created_at ? (
          <div className="mt-1 text-[10px] text-muted">
            {formatDate(lastMsg.created_at)}
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

        {/* 消息列表 */}
        <div
          ref={scrollRef}
          tabIndex={-1}
          onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
          className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 outline-none"
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

          {groupMessages(messages).map((group, gi) => {
            if (group.type === "user") {
              const m = group.messages[0];
              return (
                <UserMessageBubble
                  key={m.id}
                  message={m}
                  onViewRetrievalChunks={setSourcesSideCitations}
                />
              );
            }
            // assistant-group
            const groupKey = group.messages.map((m) => m.id).join("|");
            // 合并所有 round 的 citations 用于打开侧面板
            const allCitations = (() => {
              const map = new Map<string, Citation>();
              for (const m of group.messages) {
                for (const c of m.citations ?? []) map.set(c.chunk_id, c);
              }
              return Array.from(map.values());
            })();
            return (
              <AssistantMessageGroup
                key={groupKey}
                messages={group.messages}
                onOpenSourcesPanel={
                  allCitations.length > 0
                    ? setSourcesSideCitations
                    : undefined
                }
              />
            );
          })}
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
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
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
