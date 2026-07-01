"use client";

import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlignJustify,
  AlertTriangle,
  ArrowUp,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleStop,
  Clock,
  Copy,
  Cpu,
  Database,
  Eye,
  ExternalLink,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Plus,
  Search,
  Share2,
  Sparkle,
  Sparkles,
  Table as TableIcon,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useKnowledgeChat } from "@/lib/hooks/useKnowledgeChat";
import {
  useChatModels,
  type ChatModelItem,
} from "@/lib/api/chat-models";
import { MarkdownAnswer } from "@/components/knowledge/MarkdownAnswer";
import { ReportViewer } from "@/components/knowledge/ReportViewer";
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
import { fetchSkills, type SkillDescriptor } from "@/lib/api/skills";
import { SlashSkillMenu } from "@/components/skills/SlashSkillMenu";
import {
  AtFileMentionMenu,
  type AtMention,
} from "@/components/knowledge/AtFileMentionMenu";
import {
  MentionComposer,
  type MentionComposerHandle,
} from "@/components/knowledge/MentionComposer";
import {
  INTERACTION_MODE_OPTIONS,
  type InteractionMode,
  modeFromInteraction,
} from "@/lib/chat/interaction-modes";
import { isAction } from "@/lib/actions/chat-actions";

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

/** 对话主内容最大宽度，居中窄栏（类似 Cursor） */
const CHAT_CONTENT_CLASS = "mx-auto w-full max-w-[720px]";

interface ChatSettings {
  interactionMode: InteractionMode;
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

/**
 * 从消息正文中提取 HTML 报告片段，返回 null 表示不是 HTML 报告。
 *
 * 兼容三种情况：
 *   1. 纯 HTML（以 `<!DOCTYPE html>` 或 `<html>` 开头）
 *   2. HTML 前带说明文字（如"现在所有证据已收齐，让我生成完整的 HTML 报告。"）
 *   3. HTML 被 ```html 代码块包裹
 *
 * 通过定位 `<!DOCTYPE html>` / `<html>` 起点并截到 `</html>` 终点，
 * 自动剥离前导说明、代码块围栏与尾部多余内容。
 */
function extractHtmlReport(content: string): string | null {
  if (!content) return null;
  const startMatch = /<!DOCTYPE html|<html[\s>]/i.exec(content);
  if (!startMatch) return null;
  let html = content.slice(startMatch.index);
  const endMatch = /<\/html\s*>/i.exec(html);
  if (!endMatch) return null;
  html = html.slice(0, endMatch.index + endMatch[0].length);
  return html.trim();
}

function hasHtmlReportStart(content: string): boolean {
  return /<!DOCTYPE html|<html[\s>]/i.test(content);
}

/** 单个 assistant round 的可折叠内容块（中间轮默认折叠，最后一轮 / 正在流式展开） */
function AssistantRoundBlock({
  message,
  isLast,
  isIntermediate,
  allCitations,
  onViewSearchResults,
  onViewReport,
}: {
  message: UiChatMessage;
  /** 是否是组内最后一条（最终总结） */
  isLast: boolean;
  /** 是否是中间轮（非最后一条且组内有多条） */
  isIntermediate: boolean;
  /** 整组合并后的 citations（跨 round 去重），供 MarkdownAnswer 渲染引用 */
  allCitations: Citation[];
  onViewSearchResults?: (citations: Citation[], params?: Record<string, unknown>) => void;
  onViewReport?: (html: string, citations: Citation[]) => void;
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
  // 模型可能在 HTML 报告前后附带说明文字（如"现在所有证据已收齐，让我生成…"），
  // 或用 ```html 代码块包裹，这里从正文任意位置抽取出纯 HTML 片段。
  const reportHtml = useMemo(() => extractHtmlReport(m.content), [m.content]);
  const isHtmlReport = Boolean(reportHtml);
  const isReportGenerating = Boolean(
    m.inflight && hasHtmlReportStart(m.content) && !isHtmlReport
  );

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
        isReportGenerating ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在生成调研报告…
            </div>
          </div>
        ) : isHtmlReport ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">调研报告已生成</span>
              </div>
              <button
                type="button"
                onClick={() => onViewReport?.(reportHtml ?? m.content, allCitations)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                查看报告
              </button>
            </div>
          </div>
        ) : (
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
        )
      ) : hasContent && collapsed ? (
        /* 折叠态：显示简短摘要 */
        <div
          className="cursor-pointer rounded-lg border-l-2 border-gray-200 bg-gray-50/50 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-gray-100"
          onClick={() => setCollapsed(false)}
        >
          <span className="line-clamp-1">{m.content.slice(0, 100)}{m.content.length > 100 ? "…" : ""}</span>
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
  onViewReport,
}: {
  messages: UiChatMessage[];
  /** 前面所有 group 累积的 citations（跨 turn 引用） */
  priorCitations?: Citation[];
  onOpenSourcesPanel?: (citations: Citation[]) => void;
  onViewSearchResults?: (citations: Citation[], params?: Record<string, unknown>) => void;
  onViewReport?: (html: string, citations: Citation[]) => void;
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
                onViewReport={onViewReport}
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

/**
 * 模型能力图标：思考 / 多模态（仅在模型选择列表中展示）
 */
function ModelCapabilityIcons({ model }: { model: ChatModelItem }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <Brain
        className={cn(
          "h-3 w-3",
          model.supports_thinking ? "text-primary" : "text-gray-300"
        )}
        aria-label={model.supports_thinking ? "支持思考" : "不支持思考"}
      />
      <Eye
        className={cn(
          "h-3 w-3",
          model.supports_multimodal ? "text-primary" : "text-gray-300"
        )}
        aria-label={model.supports_multimodal ? "支持多模态" : "不支持多模态"}
      />
    </span>
  );
}

function applyModelSelection(
  settings: ChatSettings,
  model: ChatModelItem
): ChatSettings {
  return {
    ...settings,
    model: model.id,
    enableThinking: model.supports_thinking === true,
    enableMultimodal: model.supports_multimodal === true,
  };
}

/**
 * 输入栏右侧内联模型选择：hover 时在上方展开列表（与 Cursor 一致）
 */
function InlineModelPicker({
  value,
  models,
  onChange,
  disabled,
}: {
  value: string;
  models: ChatModelItem[];
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const display = useMemo(() => {
    if (!value) return "选择模型";
    const hit = models.find((m) => m.id === value);
    if (hit) return hit.label;
    const slash = value.lastIndexOf("/");
    return slash >= 0 ? value.slice(slash + 1) : value;
  }, [value, models]);

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => {
        if (!disabled) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-2 text-[11px] text-muted transition-colors hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span>{display}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </button>
      {hovered ? (
        <div className="absolute bottom-full right-0 z-50 mb-1 min-w-[11rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="max-h-56 overflow-y-auto p-1">
            {models.length === 0 ? (
              <div className="flex items-center gap-1 px-2.5 py-2 text-[11px] text-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> 加载模型中…
              </div>
            ) : (
              models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange(m.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50",
                    m.id === value && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      m.id === value ? "text-primary" : "text-foreground"
                    )}
                  >
                    {m.label}
                  </span>
                  <ModelCapabilityIcons model={m} />
                  {m.id === value ? (
                    <Check className="h-3 w-3 shrink-0 text-primary" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Plan 模式选中后在输入栏展示的黄色 pill（与 Cursor 一致；Agent 默认不展示）
 */
function InteractionModeChip({
  mode,
  disabled,
  onRemove,
}: {
  mode: InteractionMode;
  disabled?: boolean;
  onRemove: () => void;
}) {
  if (mode !== "plan") return null;

  const plan = INTERACTION_MODE_OPTIONS.find((o) => o.key === "plan");
  if (!plan) return null;
  const Icon = plan.icon;

  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] leading-none whitespace-nowrap box-border",
        "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      <Icon className="h-3 w-3 shrink-0 text-amber-600" strokeWidth={1.75} />
      <span>{plan.label}</span>
      {!disabled ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-200/70 hover:text-amber-800"
          aria-label="退出 Plan 模式"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * ➕ 号浮层配置菜单（Cursor 风格）
 *
 * 结构：顶部搜索框 + 上段模式选择（Agent / Plan）+ 分隔线
 *      + 下段带 > 子菜单（模型 / 技能 / 工具轮）。
 * - 搜索框过滤所有条目文字；
 * - 上段点击选中模式（非 toggle），已选中项显示勾选；
 * - 下段 hover 时在右侧展开子菜单，与 Cursor 一致。
 */
function PlusConfigMenu({
  settings,
  onChange,
  models,
  skills,
  selectedSkills,
  onToggleSkill,
  isStreaming,
  onClose,
}: {
  settings: ChatSettings;
  onChange: (next: ChatSettings) => void;
  models: ChatModelItem[];
  skills: SkillDescriptor[];
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  isStreaming?: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hoveredSub, setHoveredSub] = useState<null | "models" | "skills" | "tools">(null);

  const q = query.trim().toLowerCase();
  const match = (text: string) => !q || text.toLowerCase().includes(q);

  const modeDisabled = isStreaming === true;

  // 模式选择：Agent / Plan（点击选中，非 toggle）
  const modeItems = INTERACTION_MODE_OPTIONS.filter(
    (it) => match(it.label) || match(it.desc)
  );

  const currentModelLabel = useMemo(() => {
    if (!settings.model) return "选择模型";
    return models.find((m) => m.id === settings.model)?.label ?? settings.model;
  }, [settings.model, models]);

  const filteredMenuSkills = useMemo(() => {
    return skills.filter(
      (s) => match(s.name) || match(s.description) || match("技能")
    );
  }, [skills, q]);

  const skillsValue =
    selectedSkills.length > 0
      ? `${selectedSkills.length} 已选`
      : `${skills.length} 可用`;

  const subItems = [
    { key: "models" as const, icon: Cpu, label: "模型", value: currentModelLabel },
    { key: "skills" as const, icon: Sparkle, label: "技能", value: skillsValue },
    { key: "tools" as const, icon: Wrench, label: "工具轮", value: String(settings.maxToolRounds) },
  ].filter((it) => {
    if (it.key === "skills") {
      return match(it.label) || match(it.value) || filteredMenuSkills.length > 0;
    }
    return match(it.label) || match(it.value);
  });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-50 mb-2 w-60 overflow-visible rounded-xl border border-gray-200 bg-white shadow-xl">
        {/* 顶部搜索框 */}
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索配置项…"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
          />
        </div>

        <div className="relative">
          {/* 上段：模式选择（Agent / Plan） */}
          {modeItems.length > 0 ? (
            <div className="p-1.5">
              {modeItems.map((it) => {
                const Icon = it.icon;
                const selected = settings.interactionMode === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    disabled={modeDisabled}
                    onClick={() => {
                      if (modeDisabled) return;
                      if (!selected) {
                        onChange({ ...settings, interactionMode: it.key });
                      }
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                      modeDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-gray-50",
                      selected && it.key === "plan" && "bg-amber-50",
                      selected && it.key === "agent" && "bg-gray-50"
                    )}
                    title={it.desc}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selected && it.key === "plan"
                          ? "text-amber-600"
                          : selected
                            ? "text-primary"
                            : "text-muted"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-xs font-medium",
                          selected && it.key === "plan"
                            ? "text-amber-700"
                            : "text-foreground"
                        )}
                      >
                        {it.label}
                      </div>
                      <div className="truncate text-[10px] text-muted">{it.desc}</div>
                    </div>
                    {selected ? (
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          it.key === "plan" ? "text-amber-600" : "text-primary"
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* 分隔线 */}
          {modeItems.length > 0 && subItems.length > 0 ? (
            <div className="mx-3 h-px bg-gray-100" />
          ) : null}

          {/* 下段：hover 时在右侧展开子菜单（Cursor 风格） */}
          {subItems.length > 0 ? (
            <div className="p-1.5">
              {subItems.map((it) => {
                const Icon = it.icon;
                const isHovered = hoveredSub === it.key;
                return (
                  <div
                    key={it.key}
                    className="relative"
                    onMouseEnter={() => setHoveredSub(it.key)}
                    onMouseLeave={() => setHoveredSub(null)}
                  >
                    <div
                      className={cn(
                        "flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                        isHovered && "bg-gray-50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">{it.label}</div>
                      </div>
                      <span className="max-w-[88px] truncate text-[10px] text-muted">{it.value}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </div>

                    {isHovered && it.key === "models" ? (
                      <div className="absolute bottom-0 left-full z-10 pl-1">
                        <div className="w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                          <div className="max-h-56 overflow-y-auto p-1">
                          {models.length === 0 ? (
                            <div className="flex items-center gap-1 px-2.5 py-2 text-[11px] text-muted">
                              <Loader2 className="h-3 w-3 animate-spin" /> 加载模型中…
                            </div>
                          ) : (
                            models.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => onChange(applyModelSelection(settings, m))}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50",
                                  m.id === settings.model && "bg-primary/5"
                                )}
                              >
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-xs",
                                    m.id === settings.model ? "text-primary" : "text-foreground"
                                  )}
                                >
                                  {m.label}
                                </span>
                                <ModelCapabilityIcons model={m} />
                                {m.id === settings.model ? (
                                  <Check className="h-3 w-3 shrink-0 text-primary" />
                                ) : null}
                              </button>
                            ))
                          )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isHovered && it.key === "skills" ? (
                      <div className="absolute bottom-0 left-full z-10 pl-1">
                        <div className="w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                          <div className="max-h-56 overflow-y-auto p-1">
                            {filteredMenuSkills.length === 0 ? (
                              <div className="px-2.5 py-2 text-[11px] text-muted">暂无可用技能</div>
                            ) : (
                              filteredMenuSkills.map((skill) => {
                                const selected = selectedSkills.includes(skill.name);
                                return (
                                  <button
                                    key={skill.name}
                                    type="button"
                                    onClick={() => onToggleSkill(skill.name)}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50",
                                      selected && "bg-primary/5"
                                    )}
                                    title={skill.description}
                                  >
                                    <Sparkle className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                                    <span
                                      className={cn(
                                        "min-w-0 flex-1 truncate text-xs",
                                        selected ? "text-primary" : "text-foreground"
                                      )}
                                    >
                                      {skill.name}
                                    </span>
                                    {selected ? (
                                      <Check className="h-3 w-3 shrink-0 text-primary" />
                                    ) : null}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isHovered && it.key === "tools" ? (
                      <div className="absolute bottom-0 left-full z-10 pl-1">
                        <div className="w-44 rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                          <span>最大工具回合</span>
                          <span className="text-foreground">{settings.maxToolRounds}</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={settings.maxToolRounds}
                          onChange={(e) =>
                            onChange({ ...settings, maxToolRounds: Number(e.target.value) })
                          }
                          className="w-full accent-primary"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-muted">
                          <span>1</span>
                          <span>10</span>
                        </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {modeItems.length === 0 && subItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-muted">无匹配配置项</div>
          ) : null}
        </div>
      </div>
    </>
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
    hasSummary,
    phase,
    lastError,
    isStreaming,
    isLoading,
    selectSession,
    newSession,
    renameActive,
    deleteActive,
    clearMessages,
    summarizeContext,
    stopSummarize,
    summarizing,
    send,
    stop,
    clearError,
  } = chat;

  // input 是编辑器纯文本镜像（用于发送禁用判断 / slash 触发 / 布局），
  // 真正的富文本与 pill 由 MentionComposer 维护。
  const [input, setInput] = useState("");
  const [selectedSkillNames, setSelectedSkillNames] = useState<string[]>([]);
  // 当前编辑器里内联 @ 引用（Cursor 式，可多个，文件/目录混选）
  const [mentions, setMentions] = useState<AtMention[]>([]);
  // 由编辑器算出的 @ 触发词（null=未触发；""=浏览；非空=搜索）
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const composerRef = useRef<MentionComposerHandle>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillDescriptor[]>([]);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportCitations, setReportCitations] = useState<Citation[]>([]);

  // 加载可用技能列表（首次挂载）
  useEffect(() => {
    fetchSkills({ enabledOnly: true })
      .then(setAvailableSkills)
      .catch(() => {});
  }, []);
  const [settings, setSettings] = useState<ChatSettings>({
    interactionMode: "agent",
    enableThinking: false,
    enableMultimodal: false,
    model: "",
    maxToolRounds: 10,
  });
  // ➕ 号浮层配置菜单开关（临时态，无需持久化）
  const [plusMenuOpen, setPlusMenuOpen] = useState<boolean>(false);

  // 模型清单（页面级单例，多个 chip 共享，不会重复请求）
  const { models } = useChatModels();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  // Cursor 式滚动：新用户消息发出后置顶，底部保留一段"呼吸区"空白
  const turnAnchorRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);
  const pendingPinRef = useRef(false);
  const [bottomSpacer, setBottomSpacer] = useState(0);
  // 单/多行布局：仅当内容真实折行（lineCount>1）或含换行符时切多行；
  // @ pill / 空格 / 短文本 均不应触发变高。
  const [inputMultiline, setInputMultiline] = useState(false);
  const inputMultilineRef = useRef(false);
  // 单行布局下缓存编辑器可用宽度，用于从多行退回时探测是否仍是一行
  const singleLineWidthRef = useRef(0);
  const lineProbeRef = useRef<HTMLDivElement>(null);

  const fitsSingleLineAtNarrowWidth = useCallback((html: string) => {
    const probe = lineProbeRef.current;
    const width = singleLineWidthRef.current;
    if (!probe || width <= 0 || !html) return false;
    probe.style.width = `${width}px`;
    probe.innerHTML = html;
    const style = window.getComputedStyle(probe);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    return probe.scrollHeight <= lineHeight + 2;
  }, []);

  // 布局只信「几何测量」：lineCount 由编辑器实际渲染高度算出（空内容 / 纯空格 /
  // 浏览器 <br> 残渣均为 1 行），不再用序列化文本里的 \n，避免误判换行。
  const updateInputLayout = useCallback(
    (_text: string, lineCount: number, editorHtml: string, editorWidth: number) => {
      // 记录单行布局下的可用宽度（多行布局编辑器独占整行，宽度更大，不能用作探测基准）
      if (!inputMultilineRef.current && editorWidth > 0) {
        singleLineWidthRef.current = editorWidth;
      }

      let shouldMultiline = inputMultilineRef.current;
      if (lineCount > 1) {
        shouldMultiline = true;
      } else if (inputMultilineRef.current) {
        // 当前多行但几何已回到 1 行：多行布局宽度更大，需回到「单行窄宽度」探测，
        // 确认收窄后仍是一行才退回，避免宽窄切换来回抖动。
        if (!editorHtml || fitsSingleLineAtNarrowWidth(editorHtml)) {
          shouldMultiline = false;
        }
      }

      if (inputMultilineRef.current !== shouldMultiline) {
        inputMultilineRef.current = shouldMultiline;
        setInputMultiline(shouldMultiline);
      }
    },
    [fitsSingleLineAtNarrowWidth]
  );

  const showMultilineLayout = inputMultiline;

  // 单/多行布局切换后编辑器宽度变化，需重新测量行数（避免窄宽度下误折行）
  useEffect(() => {
    const id = requestAnimationFrame(() => composerRef.current?.remeasure());
    return () => cancelAnimationFrame(id);
  }, [showMultilineLayout]);

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

  // 切换会话时重置为 Agent（后端尚无 plan 持久化）
  useEffect(() => {
    if (!activeSession?.session_id) return;
    setSettings((prev) => ({ ...prev, interactionMode: "agent" }));
    inputMultilineRef.current = false;
    setInputMultiline(false);
  }, [activeSession?.session_id]);

  useEffect(() => {
    if (!activeSession) return;
    if (models.length === 0) {
      // 模型清单还没回包，先把其它字段同步好，model 留空待后续 settle，
      // 避免拿 fallback 的第一项当默认锁死，让 chip 先显示"选择模型"占位。
      const switchedNow =
        prevSessionIdRef.current !== activeSession.session_id;
      prevSessionIdRef.current = activeSession.session_id;
      setSettings((prev) => ({
        ...prev,
        enableThinking: activeSession.enable_thinking,
        enableMultimodal: false,
        model: switchedNow ? "" : prev.model,
        maxToolRounds: activeSession.max_tool_rounds || 10,
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
        ...prev,
        enableThinking: modelSupportsThinking,
        enableMultimodal: modelSupportsMultimodal,
        model: nextModel,
        maxToolRounds: activeSession.max_tool_rounds || 10,
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

  // 底部"呼吸区"高度：让当前轮（最后一条用户消息 + 助手回复）能被滚动到视口顶部，
  // 同时在滚到最底部时，最后一行文字大致落在视口中部（Cursor 视觉）。
  const recomputeSpacer = useCallback(() => {
    const container = scrollRef.current;
    const anchor = turnAnchorRef.current;
    const spacerEl = bottomSpacerRef.current;
    if (!container || !anchor || !spacerEl) {
      setBottomSpacer(0);
      return;
    }
    const cTop = container.getBoundingClientRect().top;
    const scroll = container.scrollTop;
    const anchorTop = anchor.getBoundingClientRect().top - cTop + scroll;
    const spacerTop = spacerEl.getBoundingClientRect().top - cTop + scroll;
    // 当前轮高度（不含 spacer 自身）
    const turnHeight = spacerTop - anchorTop;
    const desired = Math.max(0, container.clientHeight - turnHeight);
    setBottomSpacer((prev) => (Math.abs(prev - desired) > 1 ? desired : prev));
  }, []);

  // 把当前轮（最后一条用户消息）平滑滚动到视口顶部
  const scrollTurnToTop = useCallback((smooth: boolean) => {
    const container = scrollRef.current;
    const anchor = turnAnchorRef.current;
    if (!container || !anchor) return;
    const cTop = container.getBoundingClientRect().top;
    const anchorTop =
      anchor.getBoundingClientRect().top - cTop + container.scrollTop;
    const target = Math.max(0, anchorTop - 12);
    container.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
    isAtBottomRef.current = false;
  }, []);

  // 布局副作用：先算呼吸区高度，再决定滚动行为
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    recomputeSpacer();
    if (pendingPinRef.current) {
      pendingPinRef.current = false;
      // 等呼吸区高度应用后再滚，保证有足够空间置顶
      requestAnimationFrame(() => scrollTurnToTop(true));
      return;
    }
    // 未处于置顶状态时：仅当用户本就在底部且内容溢出，才跟随到底
    const overflows = container.scrollHeight > container.clientHeight + 4;
    if (isAtBottomRef.current && overflows) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming, recomputeSpacer, scrollTurnToTop]);

  // 视口尺寸变化时重算呼吸区
  useEffect(() => {
    const onResize = () => recomputeSpacer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeSpacer]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setSettings((prev) => ({ ...prev, interactionMode: "agent" }));
      inputMultilineRef.current = false;
      setInputMultiline(false);
      await selectSession(sessionId);
    },
    [selectSession]
  );

  const effectiveDisabled = disabled || !knowledgeBaseId || !enabled;

  // 处理动作选择
  const handleAction = useCallback(
    async (name: string) => {
      if (name === "clear") {
        // 清空当前会话的消息（保留会话本身）
        setSelectedSkillNames([]);
        composerRef.current?.clear();
        setMentions([]);
        try {
          await clearMessages();
        } catch (error) {
          console.error("清空上下文失败:", error);
        }
      } else if (name === "summary") {
        // 总结对话上下文（后端生成摘要并标记旧消息）
        setSelectedSkillNames([]);
        composerRef.current?.clear();
        setMentions([]);
        try {
          await summarizeContext();
        } catch (error) {
          console.error("总结上下文失败:", error);
        }
      }
    },
    [clearMessages, summarizeContext]
  );

  const slashMenu = SlashSkillMenu({
    skills: availableSkills,
    query: slashQuery,
    onSelectMode: (mode) => {
      setSettings((prev) => ({ ...prev, interactionMode: mode }));
      composerRef.current?.removeSlashTrigger();
    },
    onSelect: (name, kind) => {
      if (kind === "action") {
        // 动作：直接执行，不入编辑器
        void handleAction(name);
        composerRef.current?.removeSlashTrigger();
      } else {
        // 技能：作为内联 pill 插入编辑器（同时清掉行首 `/` 触发词）
        composerRef.current?.insertSkill(name);
      }
    },
    disabled: effectiveDisabled || isStreaming,
  });

  const atMenu = AtFileMentionMenu({
    knowledgeBaseId,
    query: atQuery,
    onSelect: (mention) => {
      // 在编辑器光标处插入原子 pill（Cursor 式：留在文本之间，可多个）
      composerRef.current?.insertMention(mention);
    },
    disabled: effectiveDisabled || isStreaming,
  });

  // 切换知识库时清空编辑器（@ 引用仅在当前知识库内有效）
  useEffect(() => {
    composerRef.current?.clear();
    setMentions([]);
    setSelectedSkillNames([]);
    setAtQuery(null);
    setSlashQuery(null);
    inputMultilineRef.current = false;
    setInputMultiline(false);
  }, [knowledgeBaseId]);

  const handleSend = async (preset?: string) => {
    if (effectiveDisabled || isStreaming) return;
    // preset（starter prompt）无内联引用；否则取编辑器实时内容
    const content = (preset ?? composerRef.current?.getText() ?? input).trim();
    const turnMentions: AtMention[] = preset
      ? []
      : composerRef.current?.getMentions() ?? mentions;
    const skillNames = (
      preset ? [] : composerRef.current?.getSkills() ?? selectedSkillNames
    ).filter((name) => !isAction(name));
    // 允许仅含 @ / skill pill、无额外文字时发送
    if (
      !preset &&
      !content &&
      turnMentions.length === 0 &&
      skillNames.length === 0
    ) {
      return;
    }
    // 清空输入
    composerRef.current?.clear();
    setInput("");
    setMentions([]);
    setAtQuery(null);
    setSlashQuery(null);
    // 新一轮：发出后把这条用户消息滚动到视口顶部，而不是贴底
    isAtBottomRef.current = false;
    pendingPinRef.current = true;
    // 思考和多模态自动跟随模型能力
    const resolvedModel = models.find((m) => m.id === settings.model);
    const effectiveThinking = resolvedModel?.supports_thinking === true;
    const effectiveMultimodal = resolvedModel?.supports_multimodal === true;
    await send(content, {
      mode: modeFromInteraction(settings.interactionMode),
      enableThinking: effectiveThinking,
      enableMultimodal: effectiveMultimodal,
      // 用户选了具体 model 才透传；空字符串 → 沿用 session 当前偏好。
      // 注意：这里不再传 modelPreset——preset 是后端事项，前端只表达"我要这个具体模型"。
      ...(settings.model ? { model: settings.model } : {}),
      maxToolRounds: settings.maxToolRounds,
      forcedSkillNames: skillNames.length > 0 ? skillNames : undefined,
      // @ 内联引用（软引用，可多个）：透传给后端解析为引用块 + seeding
      mentions:
        turnMentions.length > 0
          ? turnMentions.map((m) => ({ kind: m.kind, id: m.id }))
          : undefined,
    });
    setSelectedSkillNames([]);
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
    // 新会话固定默认 Agent 模式
    setSettings((prev) => ({ ...prev, interactionMode: "agent" }));
    // 思考和多模态自动跟随模型能力
    const resolvedModel = models.find((m) => m.id === settings.model);
    const effectiveThinking = resolvedModel?.supports_thinking === true;
    const effectiveMultimodal = resolvedModel?.supports_multimodal === true;
    await newSession({
      mode: "agent",
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
    settings.model,
    models,
    selectedFolderId,
  ]);

  const handleSessionRename = (s: ChatSessionInfo) => {
    if (s.session_id !== activeSessionId) {
      void handleSelectSession(s.session_id).then(() => {
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
      await handleSelectSession(s.session_id);
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

  // 最后一条用户消息所在 group 索引：作为"当前轮"的置顶锚点
  const lastUserGroupIndex = useMemo(() => {
    let idx = -1;
    groupsWithAccumulatedCitations.forEach((g, i) => {
      if (g.group.type === "user") idx = i;
    });
    return idx;
  }, [groupsWithAccumulatedCitations]);

  // 是否显示 "Planning next moves"：模型正在生成，但当前这一轮还没有任何可见输出
  //（思考 or 正文）——即用户提问后的等待期、以及多轮之间的间隙。一旦开始吐字则隐藏。
  const showPlanning = useMemo(() => {
    if (!isStreaming) return false;
    const activeInflight = messages.find(
      (m) => m.role === "assistant" && m.inflight
    );
    if (!activeInflight) return true;
    return !activeInflight.content && !activeInflight.thinking;
  }, [isStreaming, messages]);

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
                void handleSelectSession(id);
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
        <div className="border-b border-gray-100">
          <div className={cn(CHAT_CONTENT_CLASS, "px-4 py-3 sm:px-5")}>
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
                    {activeSession?.title || knowledgeBaseName}
                  </span>
                )}
                <PhasePill phase={phase} />
              </div>
              <p className="mt-1 truncate text-[11px] leading-5 text-muted">
                {selectedFolderName
                  ? selectedFolderName
                  : knowledgeBaseName
                    ? knowledgeBaseName
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
                  onSelect={(id) => void handleSelectSession(id)}
                  onNew={() => void handleNewSession()}
                  onRename={handleSessionRename}
                  onDelete={(s) => void handleSessionDelete(s)}
                />
              </div>
            ) : null}
          </div>
          </div>
        </div>

        {/* scope 由左侧 KB / 文件夹选择驱动；切换时 hook 会自动加载对应 session 列表 */}

        {phase === "disconnected" ? (
          <div className={cn(CHAT_CONTENT_CLASS, "mt-3 px-4 sm:px-5")}>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span className="flex-1">
              连接已断开。直接发送下一条消息即可自动重连。
            </span>
          </div>
          </div>
        ) : null}

        {lastError ? (
          <div className={cn(CHAT_CONTENT_CLASS, "mt-3 px-4 sm:px-5")}>
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
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
          </div>
        ) : null}

        {/* 消息列表 + 输入区：消息在剩余视口内垂直居中，输入固定底部 */}
        <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          tabIndex={-1}
          onScroll={handleScroll}
          onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
          style={{ scrollbarGutter: "stable both-edges" }}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain outline-none"
        >
          <div
            className={cn(
              "flex min-h-full flex-col",
              messages.length === 0 && "justify-center"
            )}
          >
          <div className={cn(CHAT_CONTENT_CLASS, "space-y-4 px-4 pt-4 pb-2 sm:px-5")}>
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

          {/* 上下文已总结提示 */}
          {hasSummary && messages.length > 0 ? (
            <div className="mb-4 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5 text-xs text-muted">
                <FileText className="h-3.5 w-3.5" />
                <span>chat context summarized</span>
              </div>
            </div>
          ) : null}

          {groupsWithAccumulatedCitations.map(({ group, accumulatedCitations }, gi) => {
            if (group.type === "user") {
              const m = group.messages[0];
              const isLastUser = gi === lastUserGroupIndex;
              return (
                <div key={m.id} ref={isLastUser ? turnAnchorRef : undefined}>
                  <UserMessageBubble
                    message={m}
                    onViewRetrievalChunks={(c) =>
                      setSourcesSidePanel({
                        citations: c,
                        showScore: true,
                        params: m.retrieval?.params,
                      })
                    }
                  />
                </div>
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
                onViewReport={(html, citations) => {
                  setReportHtml(html);
                  setReportCitations(citations);
                }}
              />
            );
          })}
          {showPlanning ? (
            <div className="flex">
              <span className="text-shimmer text-[13px] font-medium">
                Planning next moves
              </span>
            </div>
          ) : null}
          <div
            ref={bottomSpacerRef}
            aria-hidden
            style={{ height: bottomSpacer }}
          />
          </div>
          </div>
        </div>

        {/* 输入区：参数扁平化 toolbar + textarea + 发送/停止 */}
        <div className="shrink-0">
          <div className={cn(CHAT_CONTENT_CLASS, "px-4 pb-4 pt-2 sm:px-5")}>
          {disabledReason ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              {disabledReason}
            </div>
          ) : null}

          <div className="transition-colors">
            {summarizing ? (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Summarizing chat context
                </span>
                <button
                  type="button"
                  onClick={stopSummarize}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-primary transition-colors hover:bg-primary/10"
                  title="中断总结"
                >
                  停止
                </button>
              </div>
            ) : null}
            <div
              className={cn(
                "relative border border-gray-200 bg-white transition-colors focus-within:border-primary",
                showMultilineLayout ? "rounded-2xl" : "rounded-full py-2"
              )}
            >
              {slashMenu.renderMenu()}
              {atMenu.renderMenu()}
              {/* 隐藏探测：克隆编辑器 HTML，在单行窄宽度下预测是否仍是一行 */}
              <div
                ref={lineProbeRef}
                aria-hidden
                className="pointer-events-none absolute -z-50 invisible block whitespace-pre-wrap break-words text-sm leading-5"
                style={{ width: 0, left: -9999, top: -9999 }}
              />
              <div
                className={cn(
                  showMultilineLayout
                    ? "flex flex-col gap-1.5 px-3 py-2"
                    : "flex items-center gap-1.5 px-3"
                )}
              >
                {!showMultilineLayout ? (
                  <div className="relative flex shrink-0 items-center gap-1.5">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setPlusMenuOpen((v) => !v)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-muted transition-colors hover:border-primary hover:text-primary"
                        title="配置（模式 / 模型 / 技能 / 工具轮）"
                        aria-label="配置"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      {plusMenuOpen ? (
                        <PlusConfigMenu
                          settings={settings}
                          onChange={setSettings}
                          models={models}
                          skills={availableSkills}
                          selectedSkills={selectedSkillNames.filter((name) => !isAction(name))}
                          onToggleSkill={(name) => {
                            if (selectedSkillNames.includes(name)) {
                              composerRef.current?.removeSkill(name);
                            } else {
                              composerRef.current?.insertSkill(name);
                            }
                          }}
                          isStreaming={isStreaming}
                          onClose={() => setPlusMenuOpen(false)}
                        />
                      ) : null}
                    </div>
                    <InteractionModeChip
                      mode={settings.interactionMode}
                      disabled={isStreaming}
                      onRemove={() =>
                        setSettings((prev) => ({ ...prev, interactionMode: "agent" }))
                      }
                    />
                  </div>
                ) : null}
                <MentionComposer
                  ref={composerRef}
                  disabled={effectiveDisabled || isStreaming || summarizing}
                  placeholder={summarizing ? "正在总结上下文…" : placeholder}
                  compact={!showMultilineLayout}
                  className={cn(showMultilineLayout ? "w-full" : "min-w-0 flex-1")}
                  onChange={({
                    text,
                    mentions: ms,
                    skills,
                    atQuery: q,
                    slashQuery: sq,
                    lineCount,
                    editorHtml,
                    editorWidth,
                  }) => {
                    setInput(text);
                    setMentions(ms);
                    setSelectedSkillNames(skills);
                    setAtQuery(q);
                    setSlashQuery(sq);
                    updateInputLayout(text, lineCount, editorHtml, editorWidth);
                  }}
                  onMenuKeyDown={(e) => {
                    if (atMenu.handleKeyDown(e)) return;
                    if (slashMenu.handleKeyDown(e)) return;
                  }}
                  onSubmit={() => void handleSend()}
                />
                {showMultilineLayout ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setPlusMenuOpen((v) => !v)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-muted transition-colors hover:border-primary hover:text-primary"
                          title="配置（模式 / 模型 / 技能 / 工具轮）"
                          aria-label="配置"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        {plusMenuOpen ? (
                          <PlusConfigMenu
                            settings={settings}
                            onChange={setSettings}
                            models={models}
                            skills={availableSkills}
                            selectedSkills={selectedSkillNames.filter((name) => !isAction(name))}
                            onToggleSkill={(name) => {
                              if (selectedSkillNames.includes(name)) {
                                composerRef.current?.removeSkill(name);
                              } else {
                                composerRef.current?.insertSkill(name);
                              }
                            }}
                            isStreaming={isStreaming}
                            onClose={() => setPlusMenuOpen(false)}
                          />
                        ) : null}
                      </div>
                      <InteractionModeChip
                        mode={settings.interactionMode}
                        disabled={isStreaming}
                        onRemove={() =>
                          setSettings((prev) => ({ ...prev, interactionMode: "agent" }))
                        }
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <InlineModelPicker
                        value={settings.model}
                        models={models}
                        disabled={effectiveDisabled || isStreaming || summarizing}
                        onChange={(model) => {
                          const resolved = models.find((m) => m.id === model);
                          if (resolved) {
                            setSettings(applyModelSelection(settings, resolved));
                          } else {
                            setSettings({ ...settings, model });
                          }
                        }}
                      />
                      {isStreaming ? (
                        <button
                          type="button"
                          onClick={stop}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
                          title="停止生成"
                        >
                          <CircleStop className="h-3.5 w-3.5" />
                        </button>
                      ) : summarizing ? (
                        <button
                          type="button"
                          onClick={stopSummarize}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
                          title="中断总结"
                        >
                          <CircleStop className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSend()}
                          disabled={effectiveDisabled || !input.trim()}
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                            effectiveDisabled || !input.trim()
                              ? "cursor-not-allowed bg-gray-200 text-muted"
                              : "bg-neutral-900 text-white hover:bg-neutral-800"
                          )}
                          title="发送（Enter）"
                        >
                          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="shrink-0">
                      <InlineModelPicker
                        value={settings.model}
                        models={models}
                        disabled={effectiveDisabled || isStreaming || summarizing}
                        onChange={(model) => {
                          const resolved = models.find((m) => m.id === model);
                          if (resolved) {
                            setSettings(applyModelSelection(settings, resolved));
                          } else {
                            setSettings({ ...settings, model });
                          }
                        }}
                      />
                    </div>
                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={stop}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
                        title="停止生成"
                      >
                        <CircleStop className="h-3.5 w-3.5" />
                      </button>
                    ) : summarizing ? (
                      <button
                        type="button"
                        onClick={stopSummarize}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400"
                        title="中断总结"
                      >
                        <CircleStop className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={effectiveDisabled || !input.trim()}
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                          effectiveDisabled || !input.trim()
                            ? "cursor-not-allowed bg-gray-200 text-muted"
                            : "bg-neutral-900 text-white hover:bg-neutral-800"
                        )}
                        title="发送（Enter）"
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
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

      {/* 调研报告模态框 */}
      {reportHtml && (
        <ReportViewer
          htmlContent={reportHtml}
          citations={reportCitations}
          onClose={() => {
            setReportHtml(null);
            setReportCitations([]);
          }}
        />
      )}
    </section>
  );
};
