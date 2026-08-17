"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Files,
  Loader2,
  Minimize2,
  Maximize2,
  UploadCloud,
  X,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { FileIcon } from "@/components/knowledge/FileIcon";

export interface UploadState {
  totalFiles: number;
  fileNames: string[];
  progress: number; // 0 to 1
  phase: "uploading" | "indexing" | "completed" | "error";
  loaded?: number;
  total?: number;
  speed?: number; // bytes / s
  estimatedSeconds?: number;
  errorMessage?: string;
}

interface UploadProgressCardProps {
  uploadState: UploadState | null;
  onClose: () => void;
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatRemainingTime(seconds?: number): string {
  if (seconds === undefined || seconds <= 0 || !Number.isFinite(seconds)) {
    return "计算中…";
  }
  if (seconds < 60) {
    return `剩余约 ${seconds} 秒`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `剩余约 ${mins} 分 ${secs} 秒` : `剩余约 ${mins} 分钟`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `剩余约 ${hours} 小时 ${remMins} 分`;
}

export function UploadProgressCard({
  uploadState,
  onClose,
}: UploadProgressCardProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  if (!uploadState) return null;

  const {
    totalFiles,
    fileNames,
    progress,
    phase,
    loaded = 0,
    total = 0,
    speed = 0,
    estimatedSeconds = 0,
    errorMessage,
  } = uploadState;

  const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));

  // 最小化状态展示精简浮窗
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-6 z-[95] flex items-center gap-2.5 rounded-full border border-gray-200 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all duration-300 hover:shadow-2xl">
        {phase === "uploading" && (
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 animate-bounce text-primary" />
            <span className="text-xs font-medium text-foreground">
              上传中 ({percent}%)
            </span>
          </div>
        )}
        {phase === "indexing" && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-xs font-medium text-foreground">
              构建索引中…
            </span>
          </div>
        )}
        {phase === "completed" && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">
              上传完成
            </span>
          </div>
        )}
        {phase === "error" && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium text-red-600">上传失败</span>
          </div>
        )}

        <div className="flex items-center gap-1 pl-1 border-l border-gray-200">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="rounded p-1 text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
            title="展开任务详情"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {(phase === "completed" || phase === "error") && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-6 z-[95] w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* 头部状态与操作 */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          {phase === "uploading" && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="h-4 w-4 animate-pulse" />
            </div>
          )}
          {phase === "indexing" && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {phase === "completed" && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          )}
          {phase === "error" && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold text-foreground">
              {phase === "uploading" && `正在上传文件 (${totalFiles} 个)`}
              {phase === "indexing" && `正在初始化索引 (${totalFiles} 个)`}
              {phase === "completed" && "上传并处理已就绪"}
              {phase === "error" && "上传中断或失败"}
            </h4>
            <p className="text-[11px] text-muted truncate">
              {phase === "uploading" && "数据传输中，可继续在当前页面浏览"}
              {phase === "indexing" && "正在投递 AKS 节点生成向量分块"}
              {phase === "completed" && "文件已成功录入知识库"}
              {phase === "error" && "网络或服务端出现异常"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
            title="最小化"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          {(phase === "completed" || phase === "error") && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 文件列表预览 */}
      <div className="mt-3">
        {fileNames.length === 1 ? (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50/80 px-2.5 py-1.5 text-xs text-foreground/90">
            <FileIcon fileName={fileNames[0]} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {fileNames[0]}
            </span>
            {total > 0 && (
              <span className="shrink-0 text-[11px] text-muted">
                {formatBytes(total)}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowAllFiles(!showAllFiles)}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50/80 px-2.5 py-1.5 text-xs text-foreground/90 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Files className="h-3.5 w-3.5 text-muted shrink-0" />
                <span className="truncate font-medium">
                  {fileNames[0]} 等 {fileNames.length} 个文件
                </span>
              </div>
              {showAllFiles ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
              )}
            </button>
            {showAllFiles && (
              <div className="max-h-24 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-1.5 space-y-1">
                {fileNames.map((name, idx) => (
                  <div
                    key={`${name}-${idx}`}
                    className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-muted truncate"
                  >
                    <FileIcon fileName={name} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 进度条与指标 */}
      <div className="mt-3 space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              phase === "uploading" && "bg-gradient-to-r from-emerald-500 to-teal-500",
              phase === "indexing" && "w-full bg-blue-500 animate-pulse",
              phase === "completed" && "w-full bg-emerald-500",
              phase === "error" && "w-full bg-red-500"
            )}
            style={{
              width:
                phase === "uploading"
                  ? `${Math.max(4, percent)}%`
                  : undefined,
            }}
          />
        </div>

        {/* 传输指标详情 */}
        {phase === "uploading" && (
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="font-semibold text-foreground/80">
              {percent}% · {formatBytes(loaded)} / {formatBytes(total)}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-primary font-medium">{formatSpeed(speed)}</span>
              <span>{formatRemainingTime(estimatedSeconds)}</span>
            </div>
          </div>
        )}

        {phase === "indexing" && (
          <div className="flex items-center justify-between text-[11px] text-blue-600 font-medium">
            <span>文件已送达，后台解析中…</span>
            <span>已完成 100% 上传</span>
          </div>
        )}

        {phase === "completed" && (
          <div className="flex items-center justify-between text-[11px] text-emerald-600 font-medium">
            <span>已成功加入知识库</span>
            <span>✓ 就绪</span>
          </div>
        )}

        {phase === "error" && (
          <div className="text-[11px] text-red-600">
            {errorMessage || "上传过程中发生错误，请重试"}
          </div>
        )}
      </div>

      {/* 底部贴心小提示 */}
      {phase === "uploading" && (
        <div className="mt-2.5 rounded-md bg-amber-50/80 px-2.5 py-1.5 text-[10px] text-amber-700/90 leading-tight">
          💡 提示：大文件传输中，请勿手动刷新或关闭网页，以免中断上传连接。
        </div>
      )}
    </div>
  );
}
