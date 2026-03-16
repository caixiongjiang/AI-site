"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentView } from "@/components/knowledge/DocumentView";
import { KnowledgeChatPanel } from "@/components/knowledge/KnowledgeChatPanel";
import {
  CachedKnowledgeFileView,
  buildKnowledgePreviewUrl,
  getCachedKnowledgeFileView,
} from "@/lib/knowledge-viewer";

const filePrompts = [
  "总结这份文件的核心结论",
  "列出这份文件里最值得追问的 5 个点",
  "从风险和遗漏角度帮我检查这份文件",
];

export default function KnowledgeFilePage() {
  const params = useParams<{ fileId: string }>();
  const fileId = Array.isArray(params?.fileId) ? params.fileId[0] : params?.fileId;
  const [cachedFile, setCachedFile] = useState<CachedKnowledgeFileView | null>(null);

  useEffect(() => {
    if (!fileId) return;
    setCachedFile(getCachedKnowledgeFileView(fileId));
  }, [fileId]);

  if (!fileId) {
    return null;
  }

  if (!cachedFile) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.12),transparent_28%),linear-gradient(180deg,#121516_0%,#0f1112_100%)] px-6 py-8">
        <div className="mx-auto max-w-4xl rounded-[32px] border border-white/5 bg-dark-card p-8">
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回知识库
          </Link>
          <div className="mt-6 text-2xl text-foreground">未找到这份文件的本地上下文</div>
          <p className="mt-3 text-sm leading-7 text-muted">
            这个单文件页面依赖知识库列表页缓存的文件信息。请先从知识库页面点击文件进入，这样我们才能同时打开预览和单文件问答。
          </p>
        </div>
      </div>
    );
  }

  const previewUrl = buildKnowledgePreviewUrl(cachedFile.file.file_id);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.12),transparent_28%),linear-gradient(180deg,#121516_0%,#0f1112_100%)] px-4 py-4 md:px-6 md:py-6">
      <div className="mb-4 flex items-center">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Link>
      </div>

      <div className="grid min-h-[calc(100vh-88px)] gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(520px,1.2fr)]">
        <DocumentView
          file={cachedFile.file}
          kbName={cachedFile.knowledgeBaseName || "当前知识库"}
          previewUrl={previewUrl}
        />

        <KnowledgeChatPanel
          title="单文件问答"
          subtitle={`围绕「${cachedFile.file.file_name}」直接提问，回答范围只聚焦当前文件。`}
          contextName={cachedFile.file.file_name}
          starterPrompts={filePrompts}
          placeholder="针对当前文件继续提问..."
          className="min-h-[820px]"
        />
      </div>
    </div>
  );
}
