"use client";

/**
 * ImagePreviewPopover - 图片预览弹窗组件
 *
 * 可复用的图片预览弹窗，点击触发按钮后通过 API 按需加载图片 URL，
 * 在 portal popover 中展示图片及其元数据（文件名、页码、章节标题、caption）。
 *
 * 用于：
 * - CitationChip 中图片类型引用的预览
 * - 全部来源侧边栏 / 搜索结果中图片 chunk 的预览
 */

import {
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  type MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { fetchChunkImagePreview } from "@/lib/api/knowledge";
import { CitationPreviewMarkdown } from "@/components/knowledge/CitationPreviewMarkdown";
import { normalizeCitationAnnotation } from "@/components/knowledge/citationPreviewUtils";
import { cn } from "@/lib/utils";

const POPOVER_W = 320;
const VIEW_PAD = 8;

function usePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popRef: RefObject<HTMLDivElement | null>,
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
  }, [open, anchorRef, popRef]);
}

export interface ImagePreviewPopoverProps {
  /** 图片 chunk ID */
  chunkId: string;
  /** 图片标题/caption */
  caption?: string | null;
  /** 脚注 */
  footnote?: string | null;
  /** 文件名 */
  fileName?: string | null;
  /** 页码（从 0 开始） */
  pageIndex?: number | null;
  /** 章节标题 */
  sectionTitle?: string | null;
  /** 触发按钮的额外 class */
  triggerClassName?: string;
  /** 触发按钮的文案 */
  triggerLabel?: string;
}

export function ImagePreviewPopover({
  chunkId,
  caption,
  footnote,
  fileName,
  pageIndex,
  sectionTitle,
  triggerClassName,
  triggerLabel = "预览",
}: ImagePreviewPopoverProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePopoverPosition(open, anchorRef, popRef);

  // 点击触发时加载图片
  const handleToggle = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpen((prev) => {
      const next = !prev;
      // 首次打开时加载图片
      if (next && !imageUrl && !loading) {
        setLoading(true);
        setError(null);
        fetchChunkImagePreview(chunkId)
          .then((res) => {
            setImageUrl(res?.preview_url ?? null);
            if (!res?.preview_url) {
              setError("无法获取图片预览链接");
            }
          })
          .catch((err) => {
            setError(err?.message || "加载图片失败");
          })
          .finally(() => {
            setLoading(false);
          });
      }
      return next;
    });
  }, [chunkId, imageUrl, loading]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (
        popRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pageText =
    typeof pageIndex === "number" ? `p.${pageIndex + 1}` : null;
  const displayCaption = normalizeCitationAnnotation(caption);
  const displayFootnote = normalizeCitationAnnotation(footnote);

  const popoverEl =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            role="tooltip"
            className={cn(
              "fixed z-[100] flex flex-col rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl",
              "max-h-[min(80vh,32rem)] max-w-[min(320px,calc(100vw-16px))] overflow-hidden",
            )}
            style={{
              pointerEvents: "auto",
              top: 0,
              left: 0,
              width: POPOVER_W,
            }}
          >
            {/* 头部：文件名 + 页码 + 章节 */}
            {fileName || sectionTitle ? (
              <div className="shrink-0 space-y-0.5 border-b border-gray-100 pb-2">
                {fileName ? (
                  <div className="truncate text-[12px] font-medium leading-snug text-foreground">
                    {fileName}
                    {pageText ? (
                      <span className="ml-1 font-normal text-muted">
                        · {pageText}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {sectionTitle ? (
                  <div className="truncate text-[11px] leading-snug text-muted">
                    {sectionTitle}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 图片区域 */}
            <div className="mt-2 min-h-0 flex-1 overflow-auto overscroll-contain rounded-md border border-gray-200 bg-gray-50/80 p-1.5">
              {loading ? (
                <div className="flex items-center justify-center gap-1.5 py-6 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载中…
                </div>
              ) : error ? (
                <div className="flex items-center justify-center gap-1.5 py-6 text-[11px] text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {error}
                </div>
              ) : imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={caption || "图片预览"}
                  className="mx-auto max-h-[min(55vh,20rem)] w-auto max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                  （暂无图片）
                </div>
              )}
            </div>

            {/* 标题（支持 LaTeX） */}
            {displayCaption ? (
              <div className="mt-2 shrink-0 px-1 text-[11px] text-gray-700">
                <CitationPreviewMarkdown content={displayCaption} />
              </div>
            ) : null}
            {/* 脚注 */}
            {displayFootnote ? (
              <div className="mt-1 shrink-0 px-1 text-[10px] text-gray-500">
                <CitationPreviewMarkdown content={displayFootnote} />
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10",
          triggerClassName,
        )}
      >
        <ImageIcon className="h-3 w-3" />
        {triggerLabel}
      </button>
      {popoverEl}
    </>
  );
}
