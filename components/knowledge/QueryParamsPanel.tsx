"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Maximize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 与后端 src/retrieve/pipeline/types.py 的 RoutePlan / RouteConfig / QueryAnalysis
// 对齐。params 是 Record<string, unknown>，所有字段都做运行时守卫，缺字段即跳过该块。
// ---------------------------------------------------------------------------

interface QueryAnalysisView {
  intent?: string;
  key_entities: string[];
  contains_jargon?: boolean;
  context_dependent?: boolean;
  reasoning?: string;
}

interface RouteConfigView {
  route: string;
  top_k?: number;
  params: Record<string, unknown>;
}

interface RoutePlanView {
  analysis?: QueryAnalysisView;
  routes: RouteConfigView[];
  fusionStrategy?: string;
  fusionWeights: Record<string, number>;
  rerankTopN?: number;
}

/** 路由标识 → 中文短名 + 配色（与后端 capabilities 的 display_name 对齐） */
const ROUTE_META: Record<string, { label: string; tone: string }> = {
  chunk_dense: { label: "语义向量", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  bm25_sparse: { label: "稀疏全文", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  exact_match: { label: "精确字面", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  boolean_search: { label: "布尔逻辑", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  section_dense: { label: "章节主题", tone: "bg-teal-50 text-teal-700 ring-teal-200" },
  qa_dense: { label: "QA 语义", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  summary_dense: { label: "摘要语义", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
};

const NEUTRAL_TONE = "bg-gray-100 text-gray-600 ring-gray-200";
const OUTLINE_TONE = "bg-white text-gray-700 ring-gray-200";

/** 路由 params 内部键的中文标签；未收录的键回落显示原始键名 */
const PARAM_LABELS: Record<string, string> = {
  query_text: "检索文本",
  keywords: "关键词",
  match_mode: "匹配模式",
  filters: "过滤条件",
  bool_expression: "布尔表达式",
  score_threshold: "分数阈值",
  chunk_type: "chunk 类型",
  kb_id: "知识库",
  file_id: "文件",
  document_id: "文档",
  top_k: "top_k",
};

const TOP_LEVEL_LABELS: Record<string, string> = {
  query_text: "原始问题",
  top_k: "最终 top_k",
  chunk_type: "chunk 类型",
};

/** 结构化区已单独渲染的顶层键，剩余键进入「其他参数」兜底展示 */
const HANDLED_TOP_LEVEL = new Set([
  "query_text",
  "top_k",
  "chunk_type",
  "route_plan",
  "direct_answer",
]);

function paramLabel(key: string): string {
  return PARAM_LABELS[key] ?? key;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** 无空格长串（uuid / kb_id / chunk_id 等）按 ID 处理：中段省略 + 点击复制 */
function looksLikeId(v: string): boolean {
  return v.length >= 24 && !/\s/.test(v);
}

function shortenId(v: string): string {
  if (v.length <= 20) return v;
  return `${v.slice(0, 10)}…${v.slice(-6)}`;
}

function parseRoutePlan(raw: unknown): RoutePlanView | null {
  const plan = asRecord(raw);
  if (!plan) return null;

  const analysisRaw = asRecord(plan.query_analysis);
  const analysis: QueryAnalysisView | undefined = analysisRaw
    ? {
        intent: typeof analysisRaw.intent === "string" ? analysisRaw.intent : undefined,
        key_entities: asStringArray(analysisRaw.key_entities),
        contains_jargon:
          typeof analysisRaw.contains_jargon === "boolean"
            ? analysisRaw.contains_jargon
            : undefined,
        context_dependent:
          typeof analysisRaw.context_dependent === "boolean"
            ? analysisRaw.context_dependent
            : undefined,
        reasoning:
          typeof analysisRaw.reasoning === "string" ? analysisRaw.reasoning : undefined,
      }
    : undefined;

  const routes: RouteConfigView[] = Array.isArray(plan.route_plan)
    ? plan.route_plan.flatMap((item) => {
        const r = asRecord(item);
        if (!r || typeof r.route !== "string") return [];
        return [
          {
            route: r.route,
            top_k: typeof r.top_k === "number" ? r.top_k : undefined,
            params: asRecord(r.params) ?? {},
          },
        ];
      })
    : [];

  const weightsRaw = asRecord(plan.fusion_weights) ?? {};
  const fusionWeights: Record<string, number> = {};
  for (const [k, v] of Object.entries(weightsRaw)) {
    if (typeof v === "number") fusionWeights[k] = v;
  }

  return {
    analysis,
    routes,
    fusionStrategy:
      typeof plan.fusion_strategy === "string" ? plan.fusion_strategy : undefined,
    fusionWeights,
    rerankTopN: typeof plan.rerank_top_n === "number" ? plan.rerank_top_n : undefined,
  };
}

/* --------------------------------- 原子件 --------------------------------- */

function useCopy(text: string): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  return [copied, copy];
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, copy] = useCopy(text);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        copy();
      }}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-gray-200 hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function Chip({
  children,
  tone = NEUTRAL_TONE,
  mono = false,
  title,
}: {
  children: ReactNode;
  tone?: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] leading-4 ring-1",
        mono && "font-mono",
        tone,
      )}
    >
      {children}
    </span>
  );
}

/** 长 ID：中段省略、hover 看全文、点击复制 */
function IdChip({ value }: { value: string }) {
  const [copied, copy] = useCopy(value);
  return (
    <button
      type="button"
      title={`${value}（点击复制）`}
      onClick={copy}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] leading-4 ring-1 transition-colors",
        copied
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50",
      )}
    >
      <span className="truncate">{shortenId(value)}</span>
      {copied ? <Check className="h-2.5 w-2.5 shrink-0" /> : null}
    </button>
  );
}

/**
 * 一行 label / value。顶层用定宽左列保持纵向对齐；嵌套层（如 filters.kb_id）
 * 改用自适应宽度，避免两级定宽标签在 320px 侧栏里吃掉近一半横向空间。
 */
function Row({
  label,
  nested = false,
  children,
}: {
  label: string;
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2 py-0.5">
      <span
        className={cn(
          "shrink-0 text-[11px] leading-5 text-muted-foreground",
          nested ? "whitespace-nowrap" : "w-[62px]",
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1 text-[11px] leading-5 text-foreground">{children}</div>
    </div>
  );
}

/** 值渲染：数组→chips，对象→递归行，长 ID→IdChip，布尔→是/否 */
function Value({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <Chip tone={value ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : NEUTRAL_TONE}>
        {value ? "是" : "否"}
      </Chip>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono">{value}</span>;
  }
  if (typeof value === "string") {
    if (looksLikeId(value)) return <IdChip value={value} />;
    return <span className="break-words">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">空</span>;
    const allScalar = value.every((v) => typeof v === "string" || typeof v === "number");
    if (allScalar) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => {
            const s = String(v);
            return looksLikeId(s) ? (
              <IdChip key={`${s}-${i}`} value={s} />
            ) : (
              <Chip key={`${s}-${i}`} tone={OUTLINE_TONE} mono>
                {s}
              </Chip>
            );
          })}
        </div>
      );
    }
    return (
      <div className="space-y-1">
        {value.map((v, i) => (
          <Value key={i} value={v} depth={depth + 1} />
        ))}
      </div>
    );
  }
  const rec = asRecord(value);
  if (rec) {
    const entries = Object.entries(rec);
    if (entries.length === 0) return <span className="text-muted-foreground">空</span>;
    // 嵌套过深退化成紧凑 JSON，避免无限缩进把窄栏挤爆
    if (depth >= 2) {
      return (
        <span className="break-words font-mono text-[10px] text-gray-500">
          {JSON.stringify(rec)}
        </span>
      );
    }
    return (
      <div className={cn(depth > 0 && "border-l border-gray-200 pl-2")}>
        {entries.map(([k, v]) => (
          <Row key={k} label={paramLabel(k)} nested>
            <Value value={v} depth={depth + 1} />
          </Row>
        ))}
      </div>
    );
  }
  return <span className="break-words">{String(value)}</span>;
}

/* --------------------------------- 各区块 --------------------------------- */

function AnalysisBlock({ analysis }: { analysis: QueryAnalysisView }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isEmpty =
    !analysis.intent &&
    analysis.key_entities.length === 0 &&
    !analysis.contains_jargon &&
    !analysis.context_dependent &&
    !analysis.reasoning;
  if (isEmpty) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-foreground">意图分析</span>
        {analysis.intent ? (
          <Chip tone="bg-primary/10 text-primary ring-primary/20">{analysis.intent}</Chip>
        ) : null}
        {analysis.contains_jargon ? <Chip>含专有名词</Chip> : null}
        {analysis.context_dependent ? <Chip>依赖上下文</Chip> : null}
      </div>
      {analysis.key_entities.length > 0 ? (
        <Row label="关键实体">
          <div className="flex flex-wrap gap-1">
            {analysis.key_entities.map((e) => (
              <Chip key={e} tone={OUTLINE_TONE}>
                {e}
              </Chip>
            ))}
          </div>
        </Row>
      ) : null}
      {analysis.reasoning ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {showReasoning ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            推理过程
          </button>
          {showReasoning ? (
            <p className="mt-1 whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-600">
              {analysis.reasoning}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RouteCard({ route, index }: { route: RouteConfigView; index: number }) {
  const meta = ROUTE_META[route.route];
  const entries = Object.entries(route.params);
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-medium text-gray-500">
          {index + 1}
        </span>
        <span className="font-mono text-[11px] font-medium text-foreground">{route.route}</span>
        {meta ? <Chip tone={meta.tone}>{meta.label}</Chip> : null}
        {route.top_k !== undefined ? (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            top_k {route.top_k}
          </span>
        ) : null}
      </div>
      {entries.length > 0 ? (
        <div>
          {entries.map(([k, v]) => (
            <Row key={k} label={paramLabel(k)}>
              <Value value={v} />
            </Row>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">无额外参数（沿用请求级原问）</p>
      )}
    </li>
  );
}

function RawJsonBlock({ params }: { params: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const text = useMemo(() => JSON.stringify(params, null, 2), [params]);
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          原始 JSON
        </button>
        <div className="pr-1.5">
          <CopyButton text={text} label="复制原始 JSON" />
        </div>
      </div>
      {open ? (
        // 保留缩进结构 + 横向滚动，不用 break-all，避免长 ID 被从中间切断
        <pre className="max-h-[260px] overflow-auto rounded-b-lg bg-gray-50 px-2.5 py-2 text-[10px] leading-relaxed text-gray-600">
          {text}
        </pre>
      ) : null}
    </section>
  );
}

/* ---------------------------------- 主体 ---------------------------------- */

export function QueryParamsBody({
  params,
  magnified = false,
}: {
  params: Record<string, unknown>;
  magnified?: boolean;
}) {
  const plan = useMemo(() => parseRoutePlan(params.route_plan), [params]);
  const queryText = typeof params.query_text === "string" ? params.query_text : null;
  const others = useMemo(
    () => Object.entries(params).filter(([k]) => !HANDLED_TOP_LEVEL.has(k)),
    [params],
  );

  return (
    <div className="space-y-2">
      {queryText ? (
        <section className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-foreground">原始问题</span>
            {typeof params.top_k === "number" ? <Chip mono>top_k {params.top_k}</Chip> : null}
            {typeof params.chunk_type === "string" ? (
              <Chip mono>{params.chunk_type}</Chip>
            ) : null}
            <div className="ml-auto">
              <CopyButton text={queryText} label="复制原始问题" />
            </div>
          </div>
          <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground">
            {queryText}
          </p>
        </section>
      ) : null}

      {plan?.analysis ? <AnalysisBlock analysis={plan.analysis} /> : null}

      {plan && plan.routes.length > 0 ? (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
            <span className="text-[11px] font-medium text-foreground">召回路由</span>
            <span className="text-[10px] text-muted-foreground">
              {plan.routes.length} 路并行
            </span>
          </div>
          <ul className={cn("space-y-1.5", magnified && "grid grid-cols-2 gap-1.5 space-y-0")}>
            {plan.routes.map((r, i) => (
              <RouteCard key={`${r.route}-${i}`} route={r} index={i} />
            ))}
          </ul>
        </section>
      ) : null}

      {plan && (plan.fusionStrategy || plan.rerankTopN !== undefined) ? (
        <section className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="mb-1 text-[11px] font-medium text-foreground">融合与重排</div>
          {plan.fusionStrategy ? (
            <Row label="融合策略">
              <Chip mono tone={OUTLINE_TONE}>
                {plan.fusionStrategy}
              </Chip>
            </Row>
          ) : null}
          {Object.keys(plan.fusionWeights).length > 0 ? (
            <Row label="路由权重">
              <div className="flex flex-wrap gap-1">
                {Object.entries(plan.fusionWeights).map(([k, v]) => (
                  <Chip key={k} mono tone={OUTLINE_TONE}>
                    {k} {v}
                  </Chip>
                ))}
              </div>
            </Row>
          ) : null}
          {plan.rerankTopN !== undefined ? (
            <Row label="rerank">
              <span className="font-mono">候选 {plan.rerankTopN}</span>
            </Row>
          ) : null}
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="mb-1 text-[11px] font-medium text-foreground">其他参数</div>
          {others.map(([k, v]) => (
            <Row key={k} label={TOP_LEVEL_LABELS[k] ?? paramLabel(k)}>
              <Value value={v} />
            </Row>
          ))}
        </section>
      ) : null}

      <RawJsonBlock params={params} />
    </div>
  );
}

function QueryParamsModal({
  params,
  onClose,
}: {
  params: Record<string, unknown>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">查询参数</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <QueryParamsBody params={params} magnified />
        </div>
      </div>
    </div>
  );
}

/** 「全部来源」侧栏中的「查询参数」栏目：结构化展示路由计划，替代裸 JSON */
export function QueryParamsSection({ params }: { params: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const routeCount = useMemo(() => parseRoutePlan(params.route_plan)?.routes.length ?? 0, [params]);

  return (
    <div className="border-b border-gray-100">
      <div className="flex w-full items-center gap-2 bg-gray-50/70 px-3 py-2.5 transition-colors hover:bg-gray-100/70">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <Database className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-[13px] font-medium text-foreground">查询参数</span>
          {routeCount > 0 ? (
            <span className="ml-auto text-[11px] text-muted-foreground">{routeCount} 路</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-gray-200 hover:text-primary"
          aria-label="放大查看"
          title="放大查看"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open ? (
        <div className="px-2 pb-3 pt-2">
          <QueryParamsBody params={params} />
        </div>
      ) : null}
      {modalOpen ? (
        <QueryParamsModal params={params} onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  );
}
