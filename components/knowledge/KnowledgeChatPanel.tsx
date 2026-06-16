"use client";

import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlignJustify,
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleStop,
  Clock,
  Copy,
  Cpu,
  Database,
  Eye,
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
import {
  useChatModels,
  type ChatModelItem,
} from "@/lib/api/chat-models";
import { MarkdownAnswer } from "@/components/knowledge/MarkdownAnswer";
import { CitationPreviewMarkdown } from "@/components/knowledge/CitationPreviewMarkdown";
import { ImagePreviewPopover } from "@/components/knowledge/ImagePreviewPopover";
import {
  normalizeCitationAnnotation,
  stripHtmlToPlain,
} from "@/components/knowledge/citationPreviewUtils";
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
  /**
   * 用户在 FolderTree 上选中的文件夹 ID（v0.8.0 文件夹问答）。
   * 传入后：
   *   - 「新建会话」按钮会自动用此 folder 创建 folder scope session；
   *   - active session 的 folder_id 会与之比对，决定 banner 文案。
   * 不传 / null → 走 KB scope（与 v0.7.0 行为一致）。
   */
  selectedFolderId?: string | null;
  /** 文件夹的可读名称，仅用于 banner / 按钮文案 */
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

const SESSION_DEFAULT_VISIBLE = 5;

interface ChatSettings {
  agentMode: boolean;
  enableThinking: boolean;
  enableMultimodal: boolean;
  /**
   * 用户从 `/api/chat/models` 选定的 LiteLLM 模型字符串（如 `openai/gpt-4o-mini`）。
   *
   * - 空字符串 / null：表示用户没有显式选择，让后端走 session 默认（最终落到
   *   `model_preset`，也就是后台 agent 用的那一档）。
   * - 非空：每轮 chat WS 请求会带上 `model` 字段，覆盖 session 已存的偏好。
   *
   * 注意：模型 preset 不再出现在前端，是后端抽取 / 起标题 / 摘要等场景的事。
   */
  model: string;
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
        <div className="border-t border-amber-200/70 px-3 py-2 text-xs leading-6 text-amber-900">
          <CitationPreviewMarkdown content={thinking} />
        </div>
      ) : null}
    </div>
  );
}

function ToolCallTimeline({ toolCalls, onViewSearchResults }: { toolCalls: ToolCallRecord[]; onViewSearchResults?: (citations: Citation[], params?: Record<string, unknown>) => void }) {
  if (!toolCalls || toolCalls.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {toolCalls.map((tc) => (
        <ToolCallRow key={tc.id} tc={tc} onViewSearchResults={onViewSearchResults} />
      ))}
    </div>
  );
}

const SEARCH_TOOL_NAMES = new Set(["search_knowledge_base"]);
const IMAGE_TOOL_NAMES = new Set(["read_image_chunks"]);

const RETRIEVAL_STAGE_LABEL: Record<string, string> = {
  planning: "大模型规划检索路线…",
  searching: "多路召回中…",
  reranking: "精排结果中…",
};

const IMAGE_TOOL_STAGE_LABEL: Record<string, string> = {
  loading_images: "加载图片中…",
  calling_vlm: "调用多模态大模型理解图片…",
};

function formatExecutionModelLabel(model?: string | null): string {
  if (!model) return "";
  return model
    .replace(/^litellm_proxy\//, "")
    .replace(/^dashscope\//, "");
}

function toolResultCountLabel(count: number | undefined): string {
  const n = count ?? 0;
  return `· ${n} 条结果`;
}

/**
 * 从工具结果文本中提取图片 URL 和对应 caption
 * 匹配模式: `image_url: <url>` + 后续 `caption: <text>`
 */
function extractToolResultImages(text: string): Array<{ url: string; caption: string }> {
  if (!text) return [];
  const results: Array<{ url: string; caption: string }> = [];
  // 匹配 image_url: <url>（支持 http(s) 和 presigned URL）
  const urlRe = /image_url:\s*(https?:\/\/[^\s\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[1];
    // 向后找 caption
    const rest = text.slice(m.index + m[0].length);
    const captionMatch = rest.match(/^\s*\n?caption:\s*(.+?)(?:\n|$)/);
    const caption = captionMatch ? captionMatch[1].trim() : "";
    results.push({ url, caption });
  }
  return results;
}

/** 渲染工具结果中的图片（presigned URL） */
function ToolResultImageGallery({ text }: { text: string }) {
  const images = useMemo(() => extractToolResultImages(text), [text]);
  if (images.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {images.map((img, i) => (
        <div key={i} className="flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption || `图片 ${i + 1}`}
            className="max-h-60 w-auto max-w-full rounded-md border border-gray-200 object-contain"
            loading="lazy"
          />
          {img.caption ? (
            <span className="text-[10px] text-gray-500">{img.caption}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** 工具展开区统一高度；内容超出时在框内纵向滚动，保证完整可读 */
const TOOL_CALL_DETAIL_BOX_CLASS =
  "h-40 overflow-y-auto overflow-x-auto rounded-lg bg-white/70 p-2 text-[11px] leading-5 whitespace-pre-wrap break-words";

function ToolCallDetailBlock({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "blue" | "emerald" | "violet";
  children: ReactNode;
}) {
  const labelTone =
    tone === "emerald"
      ? "text-emerald-800/70"
      : tone === "violet"
        ? "text-violet-800/70"
        : "text-blue-800/70";
  const textTone =
    tone === "emerald"
      ? "text-emerald-900"
      : tone === "violet"
        ? "text-violet-900"
        : "text-blue-900";
  return (
    <div>
      <div className={cn("mb-1 text-[11px]", labelTone)}>{label}</div>
      <div className={cn(TOOL_CALL_DETAIL_BOX_CLASS, textTone)}>{children}</div>
    </div>
  );
}

function ToolCallRow({ tc, onViewSearchResults }: { tc: ToolCallRecord; onViewSearchResults?: (citations: Citation[], params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const inflight = Boolean(tc.inflight);
  const isSearchTool = SEARCH_TOOL_NAMES.has(tc.name);
  const isImageTool = IMAGE_TOOL_NAMES.has(tc.name);
  const hasRetrievalProgress = isSearchTool && tc.retrieval_progress;
  const imageStageLabel =
    isImageTool && tc.execution_stage
      ? IMAGE_TOOL_STAGE_LABEL[tc.execution_stage] ?? "处理图片中…"
      : null;
  const executionModelLabel = formatExecutionModelLabel(tc.execution_model);

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

  // 检索工具：绿色主题卡片
  if (isSearchTool) {
    const stageLabel = hasRetrievalProgress
      ? RETRIEVAL_STAGE_LABEL[tc.retrieval_progress ?? ""] ?? "正在检索…"
      : null;

    // 完成态：显示命中数量 + 查看按钮
    if (!inflight && tc.result_brief) {
      const hasChunks = tc.retrieval_chunks && tc.retrieval_chunks.length > 0;
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-xs">
          {/* 整行可点击展开/折叠（"查看"按钮除外） */}
          <div
            className="flex cursor-pointer items-center justify-between gap-2"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-emerald-900">
              <Database className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="truncate font-medium">search_knowledge_base</span>
              <span className="shrink-0 text-emerald-700/80">
                {toolResultCountLabel(tc.items_added)}
                {tc.time_ms != null
                  ? ` · ${((tc.time_ms ?? 0) / 1000).toFixed(1)}s`
                  : ""}
              </span>
              {executionModelLabel ? (
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                  {executionModelLabel}
                </span>
              ) : null}
            </span>
            <div className="flex items-center gap-1">
              {hasChunks && onViewSearchResults ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewSearchResults(
                      retrievalChunksToCitations(tc.retrieval_chunks),
                      tc.retrieval_params,
                    );
                  }}
                  className="rounded-md px-1.5 py-0.5 text-[11px] text-emerald-600 transition-colors hover:bg-emerald-100"
                >
                  查看
                </button>
              ) : null}
              <span className="rounded-md p-0.5 text-emerald-600">
                {open ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </span>
            </div>
          </div>
          {open ? (
            <div className="mt-2 space-y-2">
              <ToolCallDetailBlock label="查询" tone="emerald">
                {argsPreview}
              </ToolCallDetailBlock>
              {tc.result_brief ? (
                <ToolCallDetailBlock label="结果" tone="emerald">
                  {tc.result_brief}
                </ToolCallDetailBlock>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    // 进行中：显示检索进度
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-xs ring-1 ring-emerald-200/70">
        <div className="flex items-center gap-1.5 text-emerald-900">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />
          <span className="truncate font-medium">search_knowledge_base</span>
          <span className="shrink-0 text-emerald-700/80">
            · {stageLabel ?? "调用中…"}
          </span>
        </div>
      </div>
    );
  }

  // 图片理解工具：紫色主题卡片
  if (isImageTool) {
    const statusText = inflight
      ? imageStageLabel ?? "调用中…"
      : toolResultCountLabel(tc.items_added);

    return (
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-xs transition-colors",
          inflight
            ? "border-violet-300 bg-violet-50/70 ring-1 ring-violet-200/70"
            : "border-violet-200 bg-violet-50/40",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-violet-900"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {inflight ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-600" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 shrink-0 text-violet-600" />
            )}
            <span className="truncate font-medium">read_image_chunks</span>
            <span className="shrink-0 text-violet-700/80">· {statusText}</span>
            {executionModelLabel ? (
              <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                {executionModelLabel}
              </span>
            ) : null}
            {!inflight && tc.time_ms != null ? (
              <span className="shrink-0 text-violet-700/70">
                · {((tc.time_ms ?? 0) / 1000).toFixed(1)}s
              </span>
            ) : null}
          </span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>
        {open ? (
          <div className="mt-2 space-y-2">
            <ToolCallDetailBlock label="参数" tone="violet">
              {argsPreview}
            </ToolCallDetailBlock>
            {inflight ? (
              <ToolCallDetailBlock label="结果" tone="violet">
                <span className="inline-flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {imageStageLabel ?? "正在处理图片…"}
                  </span>
                  {executionModelLabel ? (
                    <span className="text-[10px] text-violet-600/80">
                      多模态模型：{executionModelLabel}
                    </span>
                  ) : null}
                </span>
              </ToolCallDetailBlock>
            ) : tc.result_brief ? (
              <ToolCallDetailBlock label="结果" tone="violet">
                <ToolResultImageGallery text={tc.result_brief} />
                {tc.result_brief}
              </ToolCallDetailBlock>
            ) : (
              <ToolCallDetailBlock label="结果" tone="violet">
                <span className="text-violet-700/70">（工具未返回结果）</span>
              </ToolCallDetailBlock>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // 普通工具：蓝色主题卡片
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
            {inflight ? "· 调用中…" : toolResultCountLabel(tc.items_added)}
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
          <ToolCallDetailBlock label="参数" tone="blue">
            {argsPreview}
          </ToolCallDetailBlock>
          {inflight ? (
            <ToolCallDetailBlock label="结果" tone="blue">
              <span className="inline-flex items-center gap-1.5 text-blue-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在调用工具，结果稍后返回…
              </span>
            </ToolCallDetailBlock>
          ) : tc.result_brief ? (
            <ToolCallDetailBlock label="结果" tone="blue">
              {tc.result_brief}
            </ToolCallDetailBlock>
          ) : (
            <ToolCallDetailBlock label="结果" tone="blue">
              <span className="text-blue-700/70">（工具未返回结果）</span>
            </ToolCallDetailBlock>
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
    image_file_path: c.image_file_path ?? null,
    bucket_name: c.bucket_name ?? null,
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
    const stageLabel: Record<string, string> = {
      planning: "大模型规划检索路线…",
      searching: "多路召回中…",
      reranking: "精排结果中…",
    };
    const label = stageLabel[retrieval.stage ?? ""] ?? "正在检索知识库…";
    return (
      <span className={cn(base, "bg-primary/10 text-primary")}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {label}
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
      命中 {retrieval.hit_count ?? 0} 段 · {((retrieval.time_ms ?? 0) / 1000).toFixed(1)}s
      {hasChunks ? (
        <span className="ml-0.5 text-emerald-600">· 查看</span>
      ) : null}
    </button>
  );
}

/** 从 citation alias（如 "c7"）提取序号，用于与 MarkdownAnswer 中的内联引用序号保持一致 */
function getAliasIndex(c: Citation): number {
  if (c.alias) {
    const m = /^c(\d+)$/i.exec(c.alias);
    if (m) return Number(m[1]);
  }
  return 0;
}

function ReferencesSidePanel({
  citations,
  showScore,
  params,
  onClose,
}: {
  citations: Citation[];
  /** true=检索结果（按 score 降序，显示分数）；false=全部来源（按页码，不显示分数） */
  showScore: boolean;
  /** 查询参数 JSON（仅检索结果视图有） */
  params?: Record<string, unknown>;
  onClose: () => void;
}) {
  const [paramsOpen, setParamsOpen] = useState(false);

  // 按 score 或页码排列，再按文档分组
  const docGroups = useMemo(() => {
    const sorted = [...citations].sort(
      showScore
        ? (a, b) => (b.score ?? 0) - (a.score ?? 0)
        : (a, b) => (a.page_index ?? Infinity) - (b.page_index ?? Infinity)
    );
    const order: string[] = [];
    const groups = new Map<
      string,
      {
        fileName: string;
        fileId: string | null | undefined;
        citations: Array<Citation & { globalIndex: number }>;
      }
    >();

    sorted.forEach((c, i) => {
      const key = docGroupKey(c);
      if (!groups.has(key)) {
        order.push(key);
        groups.set(key, {
          fileName: c.file_name || c.file_id || "未知文档",
          fileId: c.file_id,
          citations: [],
        });
      }
      // 搜索结果：按排序后的顺序编号（1,2,3…）；全部来源：使用 alias 编号与文本引用一致
      const globalIndex = showScore ? i + 1 : getAliasIndex(c);
      groups.get(key)!.citations.push({ ...c, globalIndex });
    });

    return order.map((key) => ({ key, ...groups.get(key)! }));
  }, [citations]);

  return (
    <aside
      className="flex min-h-0 w-[min(320px,35vw)] max-w-[100vw] shrink-0 flex-col border-l border-gray-200 bg-white"
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
        {showScore && params && Object.keys(params).length > 0 ? (
          <div className="border-b border-gray-100">
            <button
              type="button"
              onClick={() => setParamsOpen((v) => !v)}
              className="flex w-full items-center gap-2 bg-gray-50/70 px-3 py-2.5 text-left transition-colors hover:bg-gray-100/70"
            >
              {paramsOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <Database className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-[13px] font-medium text-foreground">查询参数</span>
            </button>
            {paramsOpen ? (
              <div className="max-h-[300px] overflow-auto px-3 pb-3">
                <pre className="whitespace-pre-wrap break-all rounded-md bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
                  {JSON.stringify(params, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
        {docGroups.map((doc) => (
          <DocGroup key={doc.key} doc={doc} showScore={showScore} />
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
 * 从 preview 文本中提取图片标题（支持中英文格式）
 */
function extractImageCaption(preview: string | null | undefined): string | null {
  if (!preview) return null;
  // 英文格式: image_caption: xxx
  const en = preview.match(/image_caption\s*:\s*(.+?)(?:\n|image_|$)/i);
  if (en) {
    const v = normalizeCitationAnnotation(en[1]);
    if (v) return v;
  }
  // 中文格式: 标题：xxx
  const cn = preview.match(/标题[：:]\s*(.+?)(?:\n|$)/);
  if (cn) {
    const v = normalizeCitationAnnotation(cn[1]);
    if (v) return v;
  }
  return null;
}

/**
 * 从 preview 文本中提取图片脚注（支持中英文格式）
 */
function extractImageFootnote(preview: string | null | undefined): string | null {
  if (!preview) return null;
  // 英文格式: image_footnote: xxx
  const en = preview.match(/image_footnote\s*:\s*(.+?)(?:\n|image_|$)/i);
  if (en) {
    const v = normalizeCitationAnnotation(en[1]);
    if (v) return v;
  }
  // 中文格式: 脚注：xxx
  const cn = preview.match(/脚注[：:]\s*(.+?)(?:\n|$)/);
  if (cn) {
    const v = normalizeCitationAnnotation(cn[1]);
    if (v) return v;
  }
  return null;
}

/**
 * 图片型引用的预览：显示标题文字 + 预览按钮
 * 点击预览按钮弹出图片预览弹窗（按需加载图片 URL）
 */
function ImageChunkPreview({
  chunkId,
  preview,
  fileName,
  pageIndex,
  sectionTitle,
}: {
  chunkId: string;
  preview?: string | null;
  fileName?: string | null;
  pageIndex?: number | null;
  sectionTitle?: string | null;
}) {
  const caption = extractImageCaption(preview);
  const footnote = extractImageFootnote(preview);

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <ImageIcon className="h-3 w-3 shrink-0 text-blue-600" />
      <span className="line-clamp-1 flex-1">{caption || "（图片引用）"}</span>
      <ImagePreviewPopover
        chunkId={chunkId}
        caption={caption}
        footnote={footnote}
        fileName={fileName}
        pageIndex={pageIndex}
        sectionTitle={sectionTitle}
        triggerClassName="shrink-0"
      />
    </div>
  );
}

/** 单个文档分组（默认折叠） */
function DocGroup({
  doc,
  showScore,
}: {
  doc: {
    key: string;
    fileName: string;
    fileId: string | null | undefined;
    citations: Array<Citation & { globalIndex: number }>;
  };
  showScore: boolean;
}) {
  const [open, setOpen] = useState(true);

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
        className="flex w-full items-center gap-2 bg-gray-50/70 px-3 py-2.5 text-left transition-colors hover:bg-gray-100/70"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
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

            // 全部来源模式（非搜索结果）：点击跳转到文件中的位置
            const canNavigate = !showScore && c.file_id;

            const handleCitationClick = () => {
              if (!canNavigate || !c.file_id) return;
              const params = new URLSearchParams();
              params.set("chunkId", c.chunk_id);
              if (c.chunk_type) params.set("type", c.chunk_type);
              window.open(
                `/knowledge/file/${encodeURIComponent(c.file_id)}?${params.toString()}`,
                "_blank",
                "noopener,noreferrer"
              );
            };

            return (
              <div
                key={`${c.chunk_id}-${c.globalIndex}`}
                className="px-4 py-2.5"
              >
                {/* 头部：点击后在原文中定位（预览区不触发跳转） */}
                {canNavigate ? (
                  <button
                    type="button"
                    onClick={handleCitationClick}
                    className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-gray-50"
                  >
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
                    <span className="ml-auto text-[10px] text-primary/60">定位</span>
                  </button>
                ) : (
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
                    {showScore && typeof c.score === "number" ? (
                      <span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        {(c.score * 100).toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                )}

                {/* 预览区：仅展示，不触发原文跳转 */}
                <div
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {isImage ? (
                    <ImageChunkPreview
                      chunkId={c.chunk_id}
                      preview={c.preview}
                      fileName={c.file_name}
                      pageIndex={c.page_index}
                      sectionTitle={c.section_title}
                    />
                  ) : (
                    (() => {
                      const snippet = previewSnippet(c.preview);
                      return snippet ? (
                        <div className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                          {snippet}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground/60">
                          （无预览文本）
                        </div>
                      );
                    })()
                  )}
                </div>
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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!message.content) return;
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  return (
    <div className="animate-fadeIn">
      <div className="mb-1.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-sm text-foreground">
          你
        </div>
      </div>
      <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm leading-7 text-foreground">
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
      {message.content ? (
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] transition-colors",
              copied
                ? "bg-emerald-50 text-emerald-600"
                : "text-muted-foreground hover:bg-gray-100 hover:text-foreground",
            )}
            title="复制问题"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      ) : null}
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
  allCitations,
  onViewSearchResults,
}: {
  message: UiChatMessage;
  /** 是否是组内最后一条（最终总结） */
  isLast: boolean;
  /** 是否是中间轮（非最后一条且组内有多条） */
  isIntermediate: boolean;
  /** 整组合并后的 citations（跨 round 去重），供 MarkdownAnswer 渲染引用 */
  allCitations: Citation[];
  onViewSearchResults?: (citations: Citation[], params?: Record<string, unknown>) => void;
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
              citations={allCitations}
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
      <ToolCallTimeline toolCalls={m.tool_calls} onViewSearchResults={onViewSearchResults} />

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
  priorCitations,
  onOpenSourcesPanel,
  onViewSearchResults,
}: {
  messages: UiChatMessage[];
  /** 前面所有 group 累积的 citations（跨 turn 引用） */
  priorCitations?: Citation[];
  onOpenSourcesPanel?: (citations: Citation[]) => void;
  onViewSearchResults?: (citations: Citation[], params?: Record<string, unknown>) => void;
}) {
  // 本 group 自身的 citations（全量，供跨 turn 合并用）
  const ownCitations = useMemo(() => {
    const map = new Map<string, Citation>();
    for (const m of messages) {
      for (const c of m.citations ?? []) {
        map.set(c.chunk_id, c);
      }
    }
    return Array.from(map.values());
  }, [messages]);

  // 本轮 LLM 实际引用的 citations（用于"引用来源"展示）
  const citedCitations = useMemo(() => {
    const cited = new Set<string>();
    const re = /\[c(\d+)\]/g;
    for (const m of messages) {
      if (!m.content) continue;
      let match;
      while ((match = re.exec(m.content)) !== null) {
        cited.add(`c${match[1]}`);
      }
    }
    if (cited.size === 0) return [];
    return ownCitations.filter((c) => c.alias && cited.has(c.alias));
  }, [messages, ownCitations]);

  // 跨 turn 合并 citations（用于 MarkdownAnswer 渲染 [cN] 引用）
  const allCitationsForRender = useMemo(() => {
    const map = new Map<string, Citation>();
    for (const c of priorCitations ?? []) {
      if (c.chunk_id) map.set(c.chunk_id, c);
    }
    for (const c of ownCitations) {
      map.set(c.chunk_id, c);
    }
    return Array.from(map.values());
  }, [ownCitations, priorCitations]);

  const isGroupInflight = messages.some((m) => m.inflight);
  const lastMsg = messages[messages.length - 1];
  const hasMultipleRounds = messages.length > 1;

  return (
    <div className="animate-fadeIn">
      {/* 头像 */}
      <div className="mb-1.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary text-sm">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="min-w-0">
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
                allCitations={allCitationsForRender}
                onViewSearchResults={onViewSearchResults}
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
            citations={citedCitations}
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
            "flex items-center gap-1 truncate text-[12.5px] leading-5",
            active ? "text-primary" : "text-foreground"
          )}
          title={
            session.folder_id
              ? `${session.title || "新会话"} · folder scope`
              : session.title || "新会话"
          }
        >
          {session.folder_id ? (
            <Folder
              className="h-3 w-3 shrink-0 text-emerald-500"
              aria-label="folder scope"
            />
          ) : null}
          <span className="truncate">{session.title || "新会话"}</span>
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
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-foreground transition-colors hover:border-primary",
          open && "border-primary bg-primary/5 text-primary"
        )}
        title="历史会话"
        aria-label="历史会话"
      >
        <Clock className="h-3.5 w-3.5" />
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
                className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-foreground hover:border-primary"
                title="新建会话"
                aria-label="新建会话"
              >
                <Plus className="h-3 w-3" />
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
// 会话图标栏 + 可折叠历史面板（默认隐藏）
// ============================================================

function SessionIconRail({
  historyOpen,
  onToggleHistory,
  onNew,
}: {
  historyOpen: boolean;
  onToggleHistory: () => void;
  onNew: () => void;
}) {
  return (
    <div className="hidden w-11 shrink-0 flex-col items-center gap-2 border-r border-gray-100 bg-gray-50/40 py-3 lg:flex">
      <button
        type="button"
        onClick={onNew}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white hover:text-primary"
        title="新建会话"
        aria-label="新建会话"
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleHistory}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          historyOpen
            ? "bg-primary/10 text-primary"
            : "text-muted hover:bg-white hover:text-primary"
        )}
        title="历史会话"
        aria-label="历史会话"
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  );
}

function SessionDrawer({
  scopeLabel,
  sessions,
  activeSessionId,
  onClose,
  onSelect,
  onRename,
  onDelete,
}: SessionListProps & {
  scopeLabel?: string;
  onClose: () => void;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-100 bg-gray-50/40 lg:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium text-foreground">
          {scopeLabel ?? "历史会话"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-gray-100 hover:text-foreground"
          title="关闭"
          aria-label="关闭历史会话"
        >
          <X className="h-3.5 w-3.5" />
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
          "flex h-5 items-center gap-1 rounded-full px-2.5 transition-colors",
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
          "flex h-5 items-center gap-1 rounded-full px-2.5 transition-colors",
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
  supportsThinking,
}: {
  /** 当前模型是否支持思考链；false 时 chip 灰色禁用，true 时绿色自动开启不可关闭 */
  supportsThinking?: boolean;
}) {
  const modelSupports = supportsThinking === true;

  return (
    <button
      type="button"
      disabled
      className={cn(
        "flex h-6 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors",
        modelSupports
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default"
          : "border-gray-200 bg-white text-muted cursor-not-allowed opacity-60"
      )}
      title={
        modelSupports
          ? "思考链已开启（当前模型支持思考）"
          : "当前模型不支持思考链"
      }
    >
      <Brain className="h-3 w-3" />
      思考
    </button>
  );
}

function MultimodalChip({
  supportsMultimodal,
}: {
  /** 当前模型是否支持多模态读图；false 时 chip 灰色禁用，true 时绿色自动开启不可关闭 */
  supportsMultimodal?: boolean;
}) {
  const modelSupports = supportsMultimodal === true;

  return (
    <button
      type="button"
      disabled
      className={cn(
        "flex h-6 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors",
        modelSupports
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default"
          : "border-gray-200 bg-white text-muted cursor-not-allowed opacity-60"
      )}
      title={
        modelSupports
          ? "多模态已开启（当前模型支持图片理解）"
          : "当前模型不支持多模态"
      }
    >
      <Eye className="h-3 w-3" />
      多模态
    </button>
  );
}

/**
 * 模型选择器 chip
 *
 * 交互合约
 * --------
 * - 模型清单由调用方通过 props 传入（panel 层 ``useChatModels`` 已拉好），
 *   chip 只负责渲染下拉 + 触发 onChange，不再自己发请求。
 * - 扁平列表：按后端给出的顺序逐条列出，不分组、不显示 provider header，
 *   不展示原始 LiteLLM id，**只显示 ``label``**。
 * - 默认选哪个由 panel 在 settings 同步效果里决定（已对话 → 走 session
 *   持久化的 model；新会话 → 列表第一个）。
 *
 * Edge case
 * ---------
 * - 当 ``value`` 在当前列表里找不到（老会话用了已下线的模型）时，按钮文案
 *   退化为 raw value 字符串，下拉里没有任何条目高亮——提示用户重新选一个。
 * - 列表为空（模型清单尚未加载 / proxy 空配置）时下拉里出现一行说明文案，
 *   而不是渲染零项给用户看。
 */
function ModelChip({
  value,
  models,
  onChange,
  disabled,
  errored,
}: {
  /** 当前已选模型 ID（LiteLLM 字符串） */
  value: string;
  /** 由父组件 ``useChatModels`` 提供 */
  models: ChatModelItem[];
  onChange: (next: string) => void;
  disabled?: boolean;
  /** 模型清单接口拉取失败时显示一行温和提示 */
  errored?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const display = useMemo(() => {
    if (!value) return { label: "选择模型", title: "请选择一个模型" };
    const hit = models.find((m) => m.id === value);
    if (hit) return { label: hit.label, title: hit.id };
    return { label: value, title: value };
  }, [value, models]);

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
        title={display.title}
      >
        <Cpu className="h-3 w-3" />
        <span className="max-w-[160px] truncate">{display.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-1 max-h-80 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {errored ? (
              <div className="px-2.5 py-1.5 text-[10px] text-amber-600">
                模型清单接口不可达，使用离线兜底列表
              </div>
            ) : null}

            {models.length === 0 ? (
              <div className="flex items-center gap-1 px-2.5 py-2 text-[11px] text-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> 加载模型中…
              </div>
            ) : (
              models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50",
                    m.id === value && "bg-primary/5"
                  )}
                  title={m.id}
                >
                  <span
                    className={cn(
                      "truncate text-xs",
                      m.id === value ? "text-primary" : "text-foreground"
                    )}
                  >
                    {m.label}
                  </span>
                </button>
              ))
            )}
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
  modeLocked,
  models,
  modelsErrored,
}: {
  settings: ChatSettings;
  onChange: (next: ChatSettings) => void;
  isStreaming: boolean;
  compact?: boolean;
  /** 会话已有消息时锁定模式，不允许切换 */
  modeLocked?: boolean;
  /** 由 panel 通过 ``useChatModels`` 集中拉取后下发，避免每个 chip 各自请求 */
  models: ChatModelItem[];
  modelsErrored?: boolean;
}) {
  // 当前模型是否支持思考链
  const currentModelSupportsThinking = useMemo(() => {
    if (!settings.model) return false;
    const hit = models.find((m) => m.id === settings.model);
    return hit?.supports_thinking === true;
  }, [settings.model, models]);

  // 当前模型是否支持多模态读图
  const currentModelSupportsMultimodal = useMemo(() => {
    if (!settings.model) return false;
    const hit = models.find((m) => m.id === settings.model);
    return hit?.supports_multimodal === true;
  }, [settings.model, models]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ModeToggle
        agentMode={settings.agentMode}
        disabled={isStreaming || modeLocked}
        onChange={(v) => onChange({ ...settings, agentMode: v })}
      />
      <ThinkingChip supportsThinking={currentModelSupportsThinking} />
      <MultimodalChip supportsMultimodal={currentModelSupportsMultimodal} />
      <ModelChip
        value={settings.model}
        models={models}
        errored={modelsErrored}
        disabled={isStreaming}
        onChange={(v) => {
          onChange({ ...settings, model: v });
        }}
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
  selectedFolderId = null,
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
    folderId: selectedFolderId,
    folderName: selectedFolderName ?? null,
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
    enableMultimodal: false,
    model: "",
    maxToolRounds: 5,
  });

  // 模型清单（页面级单例，多个 chip 共享，不会重复请求）
  const { models, errored: modelsErrored } = useChatModels();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [sourcesSidePanel, setSourcesSidePanel] = useState<{
    citations: Citation[];
    showScore: boolean;
    params?: Record<string, unknown>;
  } | null>(null);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);

  // 切换 session / 模型清单到位时，同步 chip 默认值。
  //
  // model 字段优先级（仅在模型清单已加载完成后生效）：
  //   1. ``activeSession.model`` 且**仍在当前清单里** —— 已对话过、后端持久化的
  //      选择，最高优先；
  //   2. 列表第一项 —— 新会话 / session.model 在当前清单中已不存在（如模型下线
  //      或老数据写了 fallback id 进去）；
  //   3. 空字符串 —— 模型清单本身也是空（极少见，proxy 完全空配置）。
  //
  // 这里用 ref 区分两种触发：
  //   - "切了 session"：完全按上面优先级覆盖 prev.model；
  //   - "models 引用更新（同 session）"：保留 prev.model 中"在新清单里仍然存在"
  //     的用户选择；不存在时回落到第一项。
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSession) return;
    if (models.length === 0) {
      // 模型清单还没回包，先把其它字段同步好，model 留空待后续 settle，
      // 避免拿 fallback 的第一项当默认锁死，让 chip 先显示"选择模型"占位。
      const switchedNow =
        prevSessionIdRef.current !== activeSession.session_id;
      prevSessionIdRef.current = activeSession.session_id;
      setSettings((prev) => ({
        agentMode: activeSession.agent_mode,
        enableThinking: activeSession.enable_thinking,
        enableMultimodal: false,
        model: switchedNow ? "" : prev.model,
        maxToolRounds: activeSession.max_tool_rounds || 5,
      }));
      return;
    }

    const inList = (id: string) => models.some((m) => m.id === id);
    const sessionModel = activeSession.model || "";
    const firstAvailable = models[0].id;
    const switchedSession =
      prevSessionIdRef.current !== activeSession.session_id;
    prevSessionIdRef.current = activeSession.session_id;

    setSettings((prev) => {
      let nextModel: string;
      if (switchedSession) {
        nextModel = inList(sessionModel) ? sessionModel : firstAvailable;
      } else {
        // 同一 session 内：用户已经改过的 prev.model 优先（前提是仍在清单里）；
        // 否则按 session.model → first 的顺序。
        if (prev.model && inList(prev.model)) {
          nextModel = prev.model;
        } else if (inList(sessionModel)) {
          nextModel = sessionModel;
        } else {
          nextModel = firstAvailable;
        }
      }
      // 思考和多模态自动跟随模型能力开启
      const resolvedModel = models.find((m) => m.id === nextModel);
      const modelSupportsThinking = resolvedModel?.supports_thinking === true;
      const modelSupportsMultimodal = resolvedModel?.supports_multimodal === true;
      return {
        agentMode: activeSession.agent_mode,
        enableThinking: modelSupportsThinking,
        enableMultimodal: modelSupportsMultimodal,
        model: nextModel,
        maxToolRounds: activeSession.max_tool_rounds || 5,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.session_id, models]);

  // 检测用户是否在底部（阈值 50px）
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 50;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // 自动滚动到底（仅当用户在底部时）
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  const effectiveDisabled = disabled || !knowledgeBaseId || !enabled;

  const handleSend = async (preset?: string) => {
    if (effectiveDisabled || isStreaming) return;
    const content = (preset ?? input).trim();
    if (!content) return;
    setInput("");
    isAtBottomRef.current = true;
    // 思考和多模态自动跟随模型能力
    const resolvedModel = models.find((m) => m.id === settings.model);
    const effectiveThinking = resolvedModel?.supports_thinking === true;
    const effectiveMultimodal = resolvedModel?.supports_multimodal === true;
    await send(content, {
      agentMode: settings.agentMode,
      enableThinking: effectiveThinking,
      enableMultimodal: effectiveMultimodal,
      // 用户选了具体 model 才透传；空字符串 → 沿用 session 当前偏好。
      // 注意：这里不再传 modelPreset——preset 是后端事项，前端只表达"我要这个具体模型"。
      ...(settings.model ? { model: settings.model } : {}),
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

  // 新建会话时把当前 chip 选择带过去（保留模型 / 思考链 / agent 模式偏好），
  // 避免新会话回到 fast preset 默认值——这是用户的 mental model：
  // "我刚选了 gpt-4o-mini，新开对话还应该是 gpt-4o-mini"。
  //
  // v0.8.0：scope 选择策略（不接收参数版本）：
  //   - 若用户当前在 FolderTree 选中了某 folder（selectedFolderId 非空）→
  //     默认锁在该 folder（folder scope）；用户可点 banner 上的「新建文件夹会话」
  //     按钮显式触发同样动作；
  //   - 若没选 folder → 走 KB scope（原 v0.7.0 行为）。
  // 这样侧边栏的「新建」按钮与 banner 「新建文件夹会话」按钮共享同一行为，
  // 由"用户当前是否站在某 folder 上"自然区分，不再需要一个隐藏开关。
  const handleNewSession = useCallback(async () => {
    // 思考和多模态自动跟随模型能力
    const resolvedModel = models.find((m) => m.id === settings.model);
    const effectiveThinking = resolvedModel?.supports_thinking === true;
    const effectiveMultimodal = resolvedModel?.supports_multimodal === true;
    await newSession({
      agentMode: settings.agentMode,
      enableThinking: effectiveThinking,
      enableMultimodal: effectiveMultimodal,
      // 空字符串 → 显式置空 model，让后端用 model_preset 默认（不是"不传"）
      model: settings.model || null,
      // 显式按"用户当前是否选中 folder"决定 scope；hook 内部也会兜底，
      // 但这里写明意图便于后续如果想引入"忽略 folder"的入口（例如紧凑模式
      // 顶栏「新建（KB）」按钮）只需调 newSession({ folderId: null }) 即可。
      folderId: selectedFolderId ?? null,
    });
  }, [
    newSession,
    settings.agentMode,
    settings.enableThinking,
    settings.model,
    selectedFolderId,
  ]);

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
    : selectedFolderName
      ? `向文件夹「${selectedFolderName}」提问...`
      : `直接向「${activeSession?.title || knowledgeBaseName || "知识库"}」提问...`;

  const sessionScopeLabel = selectedFolderName
    ? `文件夹「${selectedFolderName}」`
    : knowledgeBaseName
      ? `知识库「${knowledgeBaseName}」`
      : "历史会话";

  // 跨 turn 累积 citations：每个 assistant group 可引用前面所有 group 的 chunk
  const groupsWithAccumulatedCitations = useMemo(() => {
    const groups = groupMessages(messages);
    const accumulated = new Map<string, Citation>();
    return groups.map((group) => {
      if (group.type === "assistant-group") {
        for (const m of group.messages) {
          for (const c of m.citations ?? []) {
            if (c.chunk_id) accumulated.set(c.chunk_id, c);
          }
        }
      }
      return { group, accumulatedCitations: Array.from(accumulated.values()) };
    });
  }, [messages]);

  return (
    <section
      className={cn(
        "relative flex h-full min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm",
        className
      )}
    >
      {/* 左侧图标栏 + 可折叠历史面板（默认隐藏） */}
      {!compact ? (
        <>
          <SessionIconRail
            historyOpen={sessionPanelOpen}
            onToggleHistory={() => setSessionPanelOpen((v) => !v)}
            onNew={() => void handleNewSession()}
          />
          {sessionPanelOpen ? (
            <SessionDrawer
              scopeLabel={sessionScopeLabel}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onClose={() => setSessionPanelOpen(false)}
              onSelect={(id) => {
                void selectSession(id);
                setSessionPanelOpen(false);
              }}
              onRename={handleSessionRename}
              onDelete={(s) => void handleSessionDelete(s)}
            />
          ) : null}
        </>
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
                {selectedFolderName
                  ? `文件夹问答 · ${selectedFolderName}`
                  : knowledgeBaseName
                    ? `知识库问答 · ${knowledgeBaseName}`
                    : "选择一个知识库以开始问答"}
                {activeSession ? ` · ${activeSession.message_count} 条消息` : ""}
              </p>
            </div>

            {/* 紧凑模式：顶栏放新建 + 历史 popover */}
            {compact ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleNewSession()}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-foreground hover:border-primary"
                  title="新建会话"
                  aria-label="新建会话"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </button>
                <SessionPopover
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelect={(id) => void selectSession(id)}
                  onNew={() => void handleNewSession()}
                  onRename={handleSessionRename}
                  onDelete={(s) => void handleSessionDelete(s)}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* scope 由左侧 KB / 文件夹选择驱动；切换时 hook 会自动加载对应 session 列表 */}

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
          onScroll={handleScroll}
          onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
          className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 outline-none"
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

          {groupsWithAccumulatedCitations.map(({ group, accumulatedCitations }, gi) => {
            if (group.type === "user") {
              const m = group.messages[0];
              return (
                <UserMessageBubble
                  key={m.id}
                  message={m}
                  onViewRetrievalChunks={(c) =>
                    setSourcesSidePanel({
                      citations: c,
                      showScore: true,
                      params: m.retrieval?.params,
                    })
                  }
                />
              );
            }
            // assistant-group
            const groupKey = group.messages.map((m) => m.id).join("|");
            return (
              <AssistantMessageGroup
                key={groupKey}
                messages={group.messages}
                priorCitations={accumulatedCitations}
                onOpenSourcesPanel={(c) =>
                  setSourcesSidePanel({ citations: c, showScore: false })
                }
                onViewSearchResults={(c, params) =>
                  setSourcesSidePanel({ citations: c, showScore: true, params })
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
              modeLocked={messages.length > 0}
              models={models}
              modelsErrored={modelsErrored}
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
        {sourcesSidePanel && sourcesSidePanel.citations.length > 0 ? (
          <ReferencesSidePanel
            citations={sourcesSidePanel.citations}
            showScore={sourcesSidePanel.showScore}
            params={sourcesSidePanel.params}
            onClose={() => setSourcesSidePanel(null)}
          />
        ) : null}
      </div>
    </section>
  );
};
