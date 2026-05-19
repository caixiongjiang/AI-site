"use client";

/**
 * CitationChip - 内联引用 chip
 *
 * - 浮层通过 createPortal 挂到 document.body，避免落在 markdown 的 <p> 内触发非法嵌套与 hydration 报错；
 * - 表格 preview：table_caption / table_body(HTML) / table_footnote，表体区域固定 max-height + 双向滚动；
 * - 图片 preview：image_* 分段或 Markdown 图片，标题/脚注 + 原图（安全 src 白名单）；
 * - 其余 preview：GFM + KaTeX（CitationPreviewMarkdown）；
 * - 点击在有 file_id 时打开原文档。
 */

import {
  AlignJustify,
  FileText,
  Image as ImageIcon,
  Table as TableIcon,
} from "lucide-react";
import {
  type ComponentType,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Citation } from "@/lib/chat-types";
import { CitationPreviewMarkdown } from "@/components/knowledge/CitationPreviewMarkdown";
import { cn } from "@/lib/utils";
import {
  parseImagePreviewPreview,
  parseTablePreviewPreview,
  sanitizeCitationHtml,
  sanitizeCitationImageSrc,
} from "@/components/knowledge/citationPreviewUtils";

export interface CitationChipProps {
  index: number | "?";
  citation?: Citation;
  rawChunkId: string;
}

const CHUNK_TYPE_ICON: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  table: TableIcon,
  image: ImageIcon,
  text: AlignJustify,
};

const CHUNK_TYPE_LABEL: Record<string, string> = {
  table: "表格",
  image: "图片",
  text: "文本",
};

function shortHash(chunkId: string): string {
  const m = chunkId.match(/^chunk-([0-9a-f]{6,12})/i);
  return m ? m[1] : chunkId.slice(0, 8);
}

const POPOVER_W = 288;
const VIEW_PAD = 8;
const HOVER_CLOSE_MS = 160;

function usePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popRef: RefObject<HTMLDivElement | null>,
  positionKey: string,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;

    const place = () => {
      const a = anchor.getBoundingClientRect();
      const p = pop.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = a.bottom + 6;
      let left = a.left;
      if (top + p.height > vh - VIEW_PAD) {
        top = Math.max(VIEW_PAD, a.top - p.height - 6);
      }
      if (left + p.width > vw - VIEW_PAD) {
        left = vw - p.width - VIEW_PAD;
      }
      if (left < VIEW_PAD) left = VIEW_PAD;
      if (top < VIEW_PAD) top = VIEW_PAD;
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
    };

    place();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(place);
      ro.observe(pop);
    }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, positionKey, anchorRef, popRef]);
}

export function CitationPreviewBody({
  preview,
  chunkType,
}: {
  preview: string;
  chunkType?: string | null;
}) {
  const table = useMemo(() => parseTablePreviewPreview(preview), [preview]);
  const imageParts = useMemo(() => parseImagePreviewPreview(preview), [preview]);

  const useImageLayout =
    imageParts &&
    (chunkType === "image" ||
      /image_(caption|footnote|body)\s*:/i.test(preview) ||
      Boolean(imageParts.imageUrl));

  if (table) {
    return (
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 text-left">
        {table.caption ? (
          <div className="shrink-0 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-900">
            {table.caption}
          </div>
        ) : null}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-md border border-gray-200 bg-white",
            "citation-preview-table text-[10px] leading-tight text-gray-900",
            "[&_table]:min-w-full [&_table]:border-collapse",
            "[&_td]:border [&_td]:border-gray-200 [&_td]:px-1.5 [&_td]:py-1",
            "[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-1.5 [&_th]:py-1"
          )}
          dangerouslySetInnerHTML={{
            __html: sanitizeCitationHtml(table.bodyHtml),
          }}
        />
        {table.footnote ? (
          <div className="shrink-0 rounded-md bg-gray-50 px-2 py-1.5 text-[10px] text-gray-600">
            {table.footnote}
          </div>
        ) : null}
      </div>
    );
  }

  if (useImageLayout && imageParts) {
    const safeSrc = imageParts.imageUrl
      ? sanitizeCitationImageSrc(imageParts.imageUrl)
      : null;
    return (
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 text-left">
        {imageParts.caption ? (
          <div className="shrink-0 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] font-medium text-gray-900">
            {imageParts.caption}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-md border border-gray-200 bg-gray-50/80 p-1.5">
          {safeSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeSrc}
              alt={imageParts.caption || "引用图片"}
              className="mx-auto max-h-[min(55vh,20rem)] w-auto max-w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="px-2 py-6 text-center text-[11px] text-muted-foreground">
              （预览中无可用图片链接）
            </div>
          )}
        </div>
        {imageParts.footnote ? (
          <div className="shrink-0 rounded-md bg-gray-50 px-2 py-1.5 text-[10px] text-gray-600">
            {imageParts.footnote}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 text-left">
      <CitationPreviewMarkdown content={preview} />
    </div>
  );
}

export function CitationChip({
  index,
  citation,
  rawChunkId,
}: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  }, [cancelScheduledClose]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  const hasFullMeta = Boolean(citation?.file_id || citation?.file_name);
  const ChunkIcon =
    (citation?.chunk_type && CHUNK_TYPE_ICON[citation.chunk_type]) || FileText;
  const typeLabel =
    (citation?.chunk_type && CHUNK_TYPE_LABEL[citation.chunk_type]) || "片段";

  const fileName = citation?.file_name || "未知文件";
  const pageText =
    typeof citation?.page_index === "number"
      ? `p.${citation.page_index + 1}`
      : null;
  const sectionTitle = citation?.section_title || null;
  const preview = citation?.preview || null;

  const positionKey = `${preview ?? ""}|${citation?.chunk_type ?? ""}|${citation?.chunk_id ?? ""}`;

  usePopoverPosition(open, anchorRef, popRef, positionKey);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fileId = citation?.file_id;
    if (!fileId) return;
    const url = `/knowledge/file/${encodeURIComponent(fileId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const popoverEl =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            role="tooltip"
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={scheduleClose}
            className={cn(
              "fixed z-[100] flex flex-col rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl",
              "max-h-[min(80vh,28rem)] max-w-[min(288px,calc(100vw-16px))] overflow-hidden"
            )}
            style={{
              pointerEvents: "auto",
              top: 0,
              left: 0,
              width: POPOVER_W,
            }}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
              <ChunkIcon className="h-3 w-3 shrink-0" />
              <span className="font-medium">{typeLabel}</span>
            </div>
            <div className="mt-1.5 truncate text-[12px] font-medium text-foreground">
              {fileName}
              {pageText ? (
                <span className="ml-1 font-normal text-muted">· {pageText}</span>
              ) : null}
            </div>
            {sectionTitle ? (
              <div className="mt-0.5 truncate text-[11px] text-muted">
                {sectionTitle}
              </div>
            ) : null}
            {preview ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CitationPreviewBody
                  preview={preview}
                  chunkType={citation?.chunk_type}
                />
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-muted">（暂无预览）</div>
            )}
            {!hasFullMeta ? (
              <div className="mt-2 text-[10px] text-amber-600">
                元数据不完整（id: {shortHash(rawChunkId)}）
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="relative inline-block align-baseline">
      <button
        ref={anchorRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={() => {
          cancelScheduledClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        disabled={!citation?.file_id}
        className={cn(
          "inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium leading-none align-middle mx-0.5 transition-colors",
          hasFullMeta
            ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer ring-1 ring-primary/20"
            : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 cursor-default"
        )}
        title={hasFullMeta ? "点击打开原文档" : "引用片段（无法跳转）"}
      >
        <ChunkIcon className="h-2.5 w-2.5" />
        <span>{index}</span>
      </button>
      {popoverEl}
    </span>
  );
}
