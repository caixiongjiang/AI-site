"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { Upload, Camera, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadedFile } from "@/lib/types";

interface MultiFileUploaderProps {
  files: UploadedFile[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (fileId: string) => void;
  disabled?: boolean;
}

export const MultiFileUploader = ({
  files,
  onFilesAdd,
  onFileRemove,
  disabled = false,
}: MultiFileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isWaitingScreenshot, setIsWaitingScreenshot] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipboardCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastClipboardImageRef = useRef<string | null>(null);

  // 检测操作系统（客户端）
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator) {
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }
  }, []);

  // 点击页面其他地方取消截图等待
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isWaitingScreenshot) {
        handleCancelScreenshot();
      }
    };

    if (isWaitingScreenshot) {
      // 延迟添加事件监听，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isWaitingScreenshot]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (clipboardCheckIntervalRef.current) {
        clearInterval(clipboardCheckIntervalRef.current);
      }
    };
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      // 验证文件类型
      const validTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!validTypes.includes(file.type)) {
        alert(`文件 ${file.name} 格式不支持`);
        return false;
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`文件 ${file.name} 大小超过 10MB`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      onFilesAdd(validFiles);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(Array.from(selectedFiles));
    }
    // 重置 input 以允许选择相同文件
    e.target.value = "";
  };

  // 系统截图功能（引导用户使用系统快捷键）
  const handleSystemScreenshot = async () => {
    setIsWaitingScreenshot(true);

    // 先记录当前剪贴板中的图片（如果有的话），避免检测到旧图片
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            // 记录当前图片的大小作为标识
            lastClipboardImageRef.current = `${blob.size}-${blob.type}`;
            break;
          }
        }
      }
    } catch (err) {
      // 可能没有剪贴板权限或没有内容，继续
      lastClipboardImageRef.current = null;
    }

    // 开始轮询检测剪贴板
    let attempts = 0;
    const maxAttempts = 120; // 最多等待60秒（每500ms检查一次）

    clipboardCheckIntervalRef.current = setInterval(async () => {
      attempts++;

      try {
        const clipboardItems = await navigator.clipboard.read();
        
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              const currentImageId = `${blob.size}-${blob.type}`;
              
              // 只有当检测到新图片时才处理（与初始图片不同）
              if (currentImageId !== lastClipboardImageRef.current) {
                const file = new File(
                  [blob],
                  `screenshot-${Date.now()}.png`,
                  { type: "image/png" }
                );
                
                // 找到新图片，停止轮询
                if (clipboardCheckIntervalRef.current) {
                  clearInterval(clipboardCheckIntervalRef.current);
                  clipboardCheckIntervalRef.current = null;
                }
                
                setIsWaitingScreenshot(false);
                lastClipboardImageRef.current = null;
                handleFiles([file]);
                return;
              }
            }
          }
        }
      } catch (err) {
        // 剪贴板读取可能失败，继续尝试
      }

      // 超时停止
      if (attempts >= maxAttempts) {
        if (clipboardCheckIntervalRef.current) {
          clearInterval(clipboardCheckIntervalRef.current);
          clipboardCheckIntervalRef.current = null;
        }
        setIsWaitingScreenshot(false);
        lastClipboardImageRef.current = null;
      }
    }, 500);
  };

  // 取消截图等待
  const handleCancelScreenshot = () => {
    if (clipboardCheckIntervalRef.current) {
      clearInterval(clipboardCheckIntervalRef.current);
      clipboardCheckIntervalRef.current = null;
    }
    lastClipboardImageRef.current = null;
    setIsWaitingScreenshot(false);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-primary" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled && !isWaitingScreenshot) {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
          isDragging && !disabled
            ? "border-primary bg-primary/5"
            : "border-dark-border bg-dark-card hover:border-primary/50 hover:bg-dark-card/80",
          (disabled || isWaitingScreenshot) && "cursor-not-allowed opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-4 p-6">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              点击区域或拖拽文件到此处上传
            </p>
            <p className="mt-2 text-xs text-muted">
              支持 PDF、图片、Word 文档，每个文件最大 10MB
            </p>
            <div className="mt-3 rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2">
              <p className="text-xs text-blue-500">
                💡 <strong>系统截图</strong>：{' '}
                {isMac
                  ? 'Cmd + Shift + 4（框选） 或 Cmd + Shift + 3（全屏）' 
                  : 'Win + Shift + S（推荐） 或 PrtScn（全屏）'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) fileInputRef.current?.click();
              }}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/20 hover:scale-105",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <Upload className="h-5 w-5" />
              选择文件
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) handleSystemScreenshot();
              }}
              disabled={disabled || isWaitingScreenshot}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-5 py-2.5 text-sm font-medium text-green-500 transition-all hover:bg-green-500/20 hover:scale-105",
                (disabled || isWaitingScreenshot) && "cursor-not-allowed opacity-50"
              )}
              title="使用系统截图功能"
            >
              <Camera className="h-5 w-5" />
              系统截图
            </button>
          </div>
        </div>
      </div>

      {/* Screenshot Waiting */}
      {isWaitingScreenshot && (
        <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Camera className="h-5 w-5 text-purple-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-500">
                  等待系统截图中...
                </p>
                <p className="mt-1 text-xs text-muted">
                  {isMac
                    ? 'Cmd + Shift + 4（框选） 或 Cmd + Shift + 3（全屏）'
                    : 'Win + Shift + S（框选） 或 PrtScn（全屏）'}
                </p>
                <p className="mt-1 text-xs text-purple-500/80">
                  截图后自动检测并上传
                </p>
              </div>
            </div>
            <button
              onClick={handleCancelScreenshot}
              className="shrink-0 rounded-lg border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-500 transition-colors hover:bg-purple-500/30"
              title="取消等待"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              已选择 {files.length} 个文件
            </p>
            {!disabled && (
              <button
                onClick={() => files.forEach((f) => onFileRemove(f.id))}
                className="text-xs text-red-500 hover:text-red-400"
              >
                清空全部
              </button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className="flex items-center gap-3 rounded-lg border border-dark-border bg-dark-card p-3"
              >
                {/* File Preview or Icon */}
                <div className="shrink-0">
                  {uploadedFile.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadedFile.preview}
                      alt={uploadedFile.file.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10">
                      {getFileIcon(uploadedFile.file)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {uploadedFile.file.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-muted">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>
                    {uploadedFile.status === "uploading" && (
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-20 overflow-hidden rounded-full bg-dark-border">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${uploadedFile.progress || 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-primary">
                          {uploadedFile.progress}%
                        </span>
                      </div>
                    )}
                    {uploadedFile.status === "completed" && (
                      <span className="text-xs text-green-500">✓ 已上传</span>
                    )}
                    {uploadedFile.status === "error" && (
                      <span className="text-xs text-red-500">✗ 失败</span>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    onClick={() => onFileRemove(uploadedFile.id)}
                    className="shrink-0 rounded p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
