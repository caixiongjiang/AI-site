"use client";

import { KnowledgeFile } from "@/lib/knowledge-types";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  AlertCircle,
  Clock3,
  ExternalLink,
  FileText,
  Library,
  Sparkles,
} from "lucide-react";

interface DocumentViewProps {
  file: KnowledgeFile;
  kbName: string;
  previewUrl: string;
}

const statusLabelMap: Record<string, string> = {
  pending: "等待处理",
  processing: "正在处理",
  success: "可以围绕这份文件提问",
  failed: "处理失败",
};

export const DocumentView = ({ file, kbName, previewUrl }: DocumentViewProps) => {
  const progress = Math.round((file.progress ?? 0) * 100);
  const statusLabel = statusLabelMap[file.index_status || "pending"];
  const isPdf =
    file.mime_type?.includes("pdf") || file.file_name.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,21,22,0.98),rgba(12,14,15,0.98))]">
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary-light" />
              单文件工作区
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <FileText className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-2xl text-foreground">{file.file_name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Library className="h-3.5 w-3.5" />
                    {kbName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {file.updated_at ? `${formatDate(file.updated_at)} 更新` : "刚刚上传"}
                  </span>
                  <span>{formatBytes(file.file_size)}</span>
                </div>
              </div>
            </div>
          </div>

          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground transition-colors hover:border-primary"
          >
            <ExternalLink className="h-4 w-4" />
            新窗口打开原文件
          </a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/5 bg-dark-card p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">文件状态</div>
            <div className="mt-2 text-sm text-foreground">{statusLabel}</div>
            <div className="mt-3 h-2 rounded-full bg-black/20">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.max(progress, file.index_status === "success" ? 100 : 8)}%`,
                }}
              />
            </div>
            <div className="mt-2 text-xs text-muted">{progress}%</div>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-dark-card p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">文件说明</div>
            <div className="mt-2 text-sm leading-6 text-foreground">
              {file.description || "这份文件还没有补充说明，你可以直接在右侧提问获取摘要。"}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/5 bg-dark-card p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">查看方式</div>
            <div className="mt-2 text-sm leading-6 text-foreground">
              {isPdf
                ? "当前页面会直接嵌入 PDF 预览，同时保留单文件问答。"
                : "当前文件不是 PDF，暂时显示文件信息卡片，你仍然可以在右侧围绕它单独提问。"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-5">
        {isPdf ? (
          <iframe
            title={file.file_name}
            src={previewUrl}
            className="h-full min-h-[720px] w-full rounded-[28px] border border-white/5 bg-white"
          />
        ) : (
          <div className="flex h-full min-h-[720px] flex-col justify-between rounded-[28px] border border-dashed border-white/10 bg-dark-card/80 p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
                <AlertCircle className="h-3.5 w-3.5" />
                暂不支持内嵌预览
              </div>
              <div className="mt-5 text-xl text-foreground">{file.file_name}</div>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                如果后端提供了该文件的在线预览地址，这里可以直接显示原文。当前这份文件仍然可以在右侧进行单独问答。
              </p>
            </div>

            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm text-black transition-transform hover:-translate-y-0.5"
            >
              <ExternalLink className="h-4 w-4" />
              尝试打开原文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
