"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentCheckStatus } from "@/lib/types";

interface DocumentUploaderProps {
  onFileSelect: (file: File) => void;
  status: DocumentCheckStatus;
  selectedFile: File | null;
  onClearFile: () => void;
}

export const DocumentUploader = ({
  onFileSelect,
  status,
  selectedFile,
  onClearFile,
}: DocumentUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = ["uploading", "parsing", "validating"].includes(status);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleFileChange = (file: File) => {
    // 验证文件类型
    const validTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!validTypes.includes(file.type)) {
      alert("请上传 PDF、图片或 Word 文档");
      return;
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("文件大小不能超过 10MB");
      return;
    }

    onFileSelect(file);
  };

  const handleClick = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "上传中...";
      case "parsing":
        return "解析文档中...";
      case "validating":
        return "校验中...";
      case "completed":
        return "校验完成";
      case "error":
        return "处理失败";
      default:
        return "上传文档进行检查";
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
          isDragging && !isProcessing
            ? "border-primary bg-primary/5"
            : "border-dark-border bg-dark-card hover:border-primary/50 hover:bg-dark-card/80",
          isProcessing && "cursor-not-allowed opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileChange(file);
          }}
          className="hidden"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              {getStatusText()}
            </p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-xs text-muted">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearFile();
              }}
              className="mt-2 flex items-center gap-2 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/20"
            >
              <X className="h-4 w-4" />
              清除文件
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                拖拽文件到此处或点击上传
              </p>
              <p className="mt-2 text-xs text-muted">
                支持 PDF、图片、Word 文档，最大 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status Message */}
      {status === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          文档处理失败，请重试
        </div>
      )}
    </div>
  );
};
