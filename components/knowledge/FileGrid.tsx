"use client";

import { KnowledgeFile } from "@/lib/knowledge-types";
import { formatBytes, formatDate } from "@/lib/utils";
import { FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileGridProps {
  files: KnowledgeFile[];
  onFileClick: (file: KnowledgeFile) => void;
  onDeleteFile?: (file: KnowledgeFile) => void;
}

const statusMap: Record<
  string,
  { label: string; className: string; barClassName: string }
> = {
  pending: {
    label: "待索引",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    barClassName: "bg-amber-500",
  },
  processing: {
    label: "索引中",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    barClassName: "bg-sky-500",
  },
  success: {
    label: "已完成",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    barClassName: "bg-emerald-500",
  },
  failed: {
    label: "失败",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    barClassName: "bg-red-500",
  },
};

export const FileGrid = ({
  files,
  onFileClick,
  onDeleteFile,
}: FileGridProps) => {
  if (files.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/10 bg-dark-card/70 p-10 text-center">
        <div className="text-base text-foreground">当前目录还没有资料</div>
        <div className="mt-2 text-sm text-muted">
          上传文档后可立即触发索引，并在右侧发起知识问答。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => {
        const status = file.index_status || "pending";
        const statusUi = statusMap[status] || statusMap.pending;
        const progress = Math.max(0, Math.min(1, file.progress ?? 0));

        return (
          <div
            key={file.file_id}
            className="group flex items-start gap-4 rounded-[24px] border border-white/5 bg-dark-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-foreground" />
            </div>
            <button onClick={() => onFileClick(file)} className="flex-1 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {file.file_name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>{formatBytes(file.file_size)}</span>
                    {file.updated_at && <span>{formatDate(file.updated_at)}</span>}
                    {file.mime_type && <span>{file.mime_type}</span>}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs",
                    statusUi.className
                  )}
                >
                  {statusUi.label}
                </span>
              </div>
              {file.description && (
                <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted">
                  {file.description}
                </div>
              )}
              {status === "processing" && (
                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-dark-border">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        statusUi.barClassName
                      )}
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {Math.round(progress * 100)}% · 正在构建索引
                  </div>
                </div>
              )}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onFileClick(file)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-primary hover:text-foreground"
                aria-label={`查看 ${file.file_name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {onDeleteFile && (
                <button
                  onClick={() => onDeleteFile(file)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                  aria-label={`删除 ${file.file_name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
