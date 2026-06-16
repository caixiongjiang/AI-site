"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquareText, Loader2, X } from "lucide-react";
import { DocumentView } from "@/components/knowledge/DocumentView";
import { KnowledgeChatPanel } from "@/components/knowledge/KnowledgeChatPanel";
import {
  CachedKnowledgeFileView,
  getCachedKnowledgeFileView,
} from "@/lib/knowledge-viewer";
import { fetchFilePreview } from "@/lib/api/knowledge";
import type { KnowledgeFile } from "@/lib/knowledge-types";

export default function KnowledgeFilePage() {
  const params = useParams<{ fileId: string }>();
  const searchParams = useSearchParams();
  const fileId = Array.isArray(params?.fileId) ? params.fileId[0] : params?.fileId;
  const highlightChunkId = searchParams?.get("chunkId") || null;
  const [cachedFile, setCachedFile] = useState<CachedKnowledgeFileView | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [loadingFromApi, setLoadingFromApi] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    const cached = getCachedKnowledgeFileView(fileId);
    if (cached) {
      setCachedFile(cached);
    } else {
      // 缓存未命中（如从 CitationChip 直接打开），从 API 获取文件信息
      setLoadingFromApi(true);
      fetchFilePreview(fileId)
        .then((data) => {
          const file: KnowledgeFile = {
            file_id: data.file_id,
            file_name: data.file_name,
            mime_type: data.mime_type ?? null,
            file_size: data.file_size ?? null,
            knowledge_base_id: undefined,
          };
          setCachedFile({ file });
          setPreviewUrl(data.preview_url);
        })
        .catch((err) => {
          setPreviewError(
            err instanceof Error ? err.message : "获取文件信息失败"
          );
        })
        .finally(() => setLoadingFromApi(false));
    }
  }, [fileId]);

  // 有缓存时，单独获取 preview URL
  useEffect(() => {
    if (!fileId || !cachedFile || previewUrl) return;
    let cancelled = false;

    fetchFilePreview(fileId)
      .then((data) => {
        if (!cancelled) setPreviewUrl(data.preview_url);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(
            err instanceof Error ? err.message : "获取文件预览地址失败"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileId, cachedFile, previewUrl]);

  if (!fileId) {
    return null;
  }

  if (!cachedFile && !loadingFromApi) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 text-sm text-primary transition-colors hover:text-primary-light"
          >
            <ArrowLeft className="h-4 w-4" />
            返回知识库
          </Link>
          <div className="mt-4 text-lg text-foreground">未找到文件上下文</div>
          <p className="mt-2 text-sm text-muted">
            请先从知识库页面点击文件进入。
          </p>
        </div>
      </div>
    );
  }

  if (loadingFromApi) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">正在加载文件信息...</span>
      </div>
    );
  }

  const chatDisabled = cachedFile?.file.index_status !== "success";

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>

          {previewError ? (
            <span className="text-xs text-amber-600">预览加载失败</span>
          ) : null}

          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            className={
              chatOpen
                ? "inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20"
                : "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
            }
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            文件问答
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <DocumentView
            file={cachedFile!.file}
            kbName={cachedFile?.knowledgeBaseName || "当前知识库"}
            previewUrl={previewUrl ?? ""}
            isLoadingPreview={!previewUrl && !previewError}
            highlightChunkId={highlightChunkId}
          />
        </div>
      </div>

      {chatOpen ? (
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <span className="text-xs font-medium text-foreground">文件问答</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-gray-200 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <KnowledgeChatPanel
              knowledgeBaseId={cachedFile?.file.knowledge_base_id ?? null}
              knowledgeBaseName={cachedFile?.knowledgeBaseName}
              selectedFolderName={cachedFile?.file.file_name}
              disabled={chatDisabled}
              disabledReason={
                chatDisabled
                  ? "文件还在处理中，处理完成后可开始问答。"
                  : undefined
              }
              enabled
              compact
              className="h-full rounded-none border-0 shadow-none"
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
