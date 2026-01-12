"use client";

import { ValidationResult } from "@/lib/types";
import { ValidationCard } from "./ValidationCard";
import { BarChart3, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface ValidationResultsProps {
  results: ValidationResult[];
}

export const ValidationResults = ({ results }: ValidationResultsProps) => {
  if (results.length === 0) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-dark-border bg-dark-card">
        <div className="flex flex-col items-center gap-4 text-muted">
          <BarChart3 className="h-16 w-16" />
          <p className="text-sm">校验结果将在检查完成后显示</p>
        </div>
      </div>
    );
  }

  // 统计结果
  const stats = {
    total: results.length,
    success: results.filter((r) => r.is_valid).length,
    warning: results.filter(
      (r) => !r.is_valid && r.severity === "warning"
    ).length,
    error: results.filter(
      (r) => !r.is_valid && r.severity !== "warning"
    ).length,
  };

  return (
    <div className="flex flex-col rounded-xl border border-dark-border bg-dark-card" style={{ height: '500px' }}>
      {/* Header with Title */}
      <div className="flex-shrink-0 border-b border-dark-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">检查详情</h3>
      </div>
      
      {/* Statistics - 整合在内部 */}
      <div className="flex-shrink-0 border-b border-dark-border bg-dark/30 p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col items-center rounded-lg border border-dark-border bg-dark-card p-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted">总计</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              {stats.total}
            </p>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-green-500">通过</span>
            </div>
            <p className="mt-1 text-xl font-bold text-green-500">
              {stats.success}
            </p>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-xs text-yellow-500">警告</span>
            </div>
            <p className="mt-1 text-xl font-bold text-yellow-500">
              {stats.warning}
            </p>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs text-red-500">错误</span>
            </div>
            <p className="mt-1 text-xl font-bold text-red-500">
              {stats.error}
            </p>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {results.map((result, index) => (
          <ValidationCard key={index} result={result} />
        ))}
      </div>
    </div>
  );
};
