"use client";

import { KnowledgeFile } from "@/lib/knowledge-types";
import { formatBytes } from "@/lib/utils";
import { AlertCircle, FileText } from "lucide-react";

interface DocumentViewProps {
  file: KnowledgeFile;
  kbName: string;
  previewUrl: string;
  isLoadingPreview?: boolean;
}

export const DocumentView = ({ file, previewUrl, isLoadingPreview }: DocumentViewProps) => {
  const isPdf =
    file.mime_type?.includes("pdf") || file.file_name.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-muted" />
        <span className="truncate text-sm text-foreground">{file.file_name}</span>
        <span className="text-xs text-muted">{formatBytes(file.file_size)}</span>
      </div>

      <div className="flex-1">
        {isLoadingPreview ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-muted">正在加载预览...</div>
          </div>
        ) : isPdf && previewUrl ? (
          <iframe
            title={file.file_name}
            src={previewUrl}
            className="h-full w-full border-0 bg-gray-100"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-muted">
              <AlertCircle className="h-3.5 w-3.5" />
              暂不支持内嵌预览
            </div>
            <div className="mt-4 text-lg text-foreground">{file.file_name}</div>
            <p className="mt-2 max-w-md text-center text-sm text-muted">
              当前文件格式不支持内嵌预览。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
