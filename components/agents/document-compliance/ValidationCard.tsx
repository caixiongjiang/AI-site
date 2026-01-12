"use client";

import { ValidationResult } from "@/lib/types";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationCardProps {
  result: ValidationResult;
}

export const ValidationCard = ({ result }: ValidationCardProps) => {
  const severity = result.severity || (result.is_valid ? "success" : "error");

  const getIcon = () => {
    switch (severity) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getBgColor = () => {
    switch (severity) {
      case "success":
        return "bg-green-500/10 border-green-500/30";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/30";
      case "error":
        return "bg-red-500/10 border-red-500/30";
    }
  };

  const getTextColor = () => {
    switch (severity) {
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all hover:shadow-md",
        getBgColor()
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{getIcon()}</div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">{result.field}</h4>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                severity === "success" && "bg-green-500/20 text-green-500",
                severity === "warning" && "bg-yellow-500/20 text-yellow-500",
                severity === "error" && "bg-red-500/20 text-red-500"
              )}
            >
              {severity === "success"
                ? "通过"
                : severity === "warning"
                  ? "警告"
                  : "错误"}
            </span>
          </div>

          {result.error_msg && (
            <p className={cn("text-sm", getTextColor())}>{result.error_msg}</p>
          )}

          {result.original_value !== null &&
            result.original_value !== undefined && (
              <div className="rounded bg-dark-card/50 px-3 py-2">
                <p className="text-xs text-muted">原始值</p>
                <p className="mt-1 text-sm text-foreground">
                  {typeof result.original_value === "object"
                    ? JSON.stringify(result.original_value)
                    : String(result.original_value)}
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
