"use client";

import Image from "next/image";
import { ValidationResult } from "@/lib/types";
import { FileText } from "lucide-react";

interface DocumentPreviewProps {
  imageUrl?: string;
  validationResults: ValidationResult[];
  fileName?: string;
}

export const DocumentPreview = ({
  imageUrl,
  validationResults,
  fileName,
}: DocumentPreviewProps) => {
  // 过滤出有位置信息的错误项
  const resultsWithPosition = validationResults.filter(
    (result) => result.position && !result.is_valid
  );

  if (!imageUrl) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-dark-border bg-dark-card">
        <div className="flex flex-col items-center gap-4 text-muted">
          <FileText className="h-16 w-16" />
          <p className="text-sm">文档预览将在上传后显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-dark-border bg-dark-card">
      {/* Header */}
      <div className="border-b border-dark-border bg-dark-card/50 px-4 py-3">
        <p className="truncate text-sm font-medium text-foreground">
          {fileName || "文档预览"}
        </p>
      </div>

      {/* Preview Container */}
      <div className="relative min-h-[400px] overflow-auto p-4">
        <div className="relative inline-block min-w-full">
          <Image
            src={imageUrl}
            alt="Document preview"
            width={800}
            height={1000}
            className="w-full rounded-lg"
            unoptimized
          />

          {/* SVG Overlay for Error Highlights */}
          {resultsWithPosition.length > 0 && (
            <svg
              className="pointer-events-none absolute left-0 top-0 h-full w-full"
              style={{ mixBlendMode: "multiply" }}
            >
              {resultsWithPosition.map((result, index) => {
                if (!result.position) return null;

                const { x, y, width, height } = result.position;
                const color =
                  result.severity === "error"
                    ? "rgba(239, 68, 68, 0.3)"
                    : "rgba(251, 191, 36, 0.3)";

                return (
                  <g key={index}>
                    {/* Highlight Rectangle */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={color}
                      stroke={
                        result.severity === "error"
                          ? "rgb(239, 68, 68)"
                          : "rgb(251, 191, 36)"
                      }
                      strokeWidth="2"
                      rx="4"
                    />
                    {/* Error Label */}
                    <text
                      x={x}
                      y={y - 5}
                      fill={
                        result.severity === "error"
                          ? "rgb(239, 68, 68)"
                          : "rgb(251, 191, 36)"
                      }
                      fontSize="12"
                      fontWeight="600"
                    >
                      {result.field}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Legend */}
      {resultsWithPosition.length > 0 && (
        <div className="border-t border-dark-border bg-dark-card/50 px-4 py-3">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border-2 border-red-500 bg-red-500/30" />
              <span className="text-muted">错误项</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border-2 border-yellow-500 bg-yellow-500/30" />
              <span className="text-muted">警告项</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
