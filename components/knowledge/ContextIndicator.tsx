"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ContextStatusReport } from "@/lib/chat-types";

function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function formatCompactionTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      ` ${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch {
    return iso;
  }
}

/** 分项配色与命名对齐 Cursor 的 Context Usage 面板 */
const SEGMENT_COLORS = {
  system: "#6b7280",
  tools: "#7b7fe3",
  skills: "#a16207",
  summary: "#c2405a",
  conversation: "#d1441f",
} as const;

export function ContextIndicator({
  report,
  className,
}: {
  report: ContextStatusReport | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 移动端没有 hover：点开后点外面要能收起，否则面板会一直压着对话
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // 口径与 Cursor 一致：满窗口做分母（输出预留不计入 used）
  const pct = useMemo(() => {
    if (!report || report.max_context <= 0) return 0;
    const raw = (report.used_tokens / report.max_context) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [report]);

  const segments = useMemo(() => {
    if (!report) return [];
    const b = report.breakdown;
    return [
      { key: "system", label: "System prompt", value: b.system, color: SEGMENT_COLORS.system },
      { key: "tools", label: "Tool definitions", value: b.tools_schema, color: SEGMENT_COLORS.tools },
      { key: "skills", label: "Skills", value: b.skills ?? 0, color: SEGMENT_COLORS.skills },
      { key: "summary", label: "Summarized conversation", value: b.summary ?? 0, color: SEGMENT_COLORS.summary },
      // 当轮 user 输入（含 @ 引用块）与历史同属对话，合并展示
      { key: "conversation", label: "Conversation", value: b.history + b.user, color: SEGMENT_COLORS.conversation },
    ];
  }, [report]);

  const visibleSegments = useMemo(() => {
    return segments.filter((s) => s.value > 0);
  }, [segments]);

  const nearLimit =
    !!report && report.will_compact_at > 0 && report.used_tokens >= report.will_compact_at;

  if (!report) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-muted",
          className
        )}
        title="上下文用量暂不可用"
      >
        <span className="hidden sm:inline">Context&nbsp;</span>—
      </span>
    );
  }

  const denom = Math.max(report.max_context, 1);

  return (
    // 移动端保持 static：面板要相对头部整宽展开（见下方 absolute left/right），
    // 只有 sm 以上才把定位上下文收回按钮自身，做右对齐浮层。
    <div
      ref={rootRef}
      className={cn("inline-flex sm:relative", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
          nearLimit
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-gray-200 bg-white text-muted hover:border-gray-300 hover:text-foreground"
        )}
        title={`Context ${pct}% · ${formatTokens(report.used_tokens)} / ${formatTokens(report.max_context)}`}
        aria-expanded={open}
      >
        <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-gray-200" aria-hidden>
          <span
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              nearLimit ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
        {/* 窄屏只留百分比，把宽度让给标题与状态胶囊 */}
        <span className="hidden sm:inline">Context&nbsp;</span>
        <span>{pct}%</span>
      </button>

      {open ? (
        <div
          className={cn(
            // 移动端：相对头部整宽下落，左右各留一点边距，看起来像一块贴边面板；
            // sm 以上：回到按钮下方右对齐的 320px 浮层。
            "absolute left-3 right-3 top-full z-30 mt-1.5 max-h-[min(70vh,28rem)] overflow-y-auto",
            "rounded-2xl border border-gray-200 bg-white p-3.5 text-xs shadow-2xl ring-1 ring-black/5",
            "sm:left-auto sm:right-0 sm:mt-1 sm:w-80 sm:rounded-xl sm:p-3 sm:text-[11px]"
          )}
        >
          {/* 小三角：仅桌面端指向触发按钮 */}
          <span
            aria-hidden
            className="absolute -top-1 right-8 hidden h-2 w-2 rotate-45 border-l border-t border-gray-200 bg-white sm:block"
          />

          <div className="mb-2 flex items-center justify-between text-foreground">
            <span className="font-medium">Context Usage</span>
            <span className="text-muted">{report.counting}</span>
          </div>

          <div className="mb-1.5 flex items-baseline justify-between">
            <span className={cn("text-[13px] font-medium", nearLimit ? "text-amber-700" : "text-foreground")}>
              {pct}% Full
            </span>
            <span className="text-muted">
              ~{formatTokens(report.used_tokens)} / {formatTokens(report.max_context)} Tokens
            </span>
          </div>

          {/* 分段用量条：段序与下方图例一致 */}
          <div className="mb-3 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            {visibleSegments.map((s) => (
              <span
                key={s.key}
                style={{
                  width: `${(s.value / denom) * 100}%`,
                  // 极小占比也要留得住颜色，否则 4% 时几乎看不到这一段
                  minWidth: 3,
                  backgroundColor: s.color,
                }}
                title={`${s.label} ${formatTokens(s.value)}`}
              />
            ))}
          </div>

          <div className="space-y-1">
            {visibleSegments.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="shrink-0 text-muted">{formatTokens(s.value)}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-muted">
            <div className="flex justify-between">
              <span>Reserved output</span>
              <span>{formatTokens(report.reserved_output)}</span>
            </div>
            <div className="flex justify-between">
              <span>Auto-compact at</span>
              <span>{formatTokens(report.will_compact_at)}</span>
            </div>
          </div>

          {nearLimit ? <p className="mt-2 text-amber-700">接近上限，将自动压缩</p> : null}

          {report.last_compaction ? (
            <p className="mt-2 border-t border-gray-100 pt-2 text-muted">
              上次压缩：{formatCompactionTime(report.last_compaction.at)}
              {report.last_compaction.input_tokens != null &&
              report.last_compaction.summary_tokens != null
                ? ` · ${formatTokens(report.last_compaction.input_tokens)} → ${formatTokens(report.last_compaction.summary_tokens)}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
