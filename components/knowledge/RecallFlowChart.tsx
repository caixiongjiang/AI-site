"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  Workflow,
  X,
} from "lucide-react";
import type { RecallStats } from "@/lib/chat-types";

const COLOR_PRIMARY = "#00B36B";
const COLOR_CYAN = "#06b6d4";
const COLOR_DEDUP = "#9ca3af";

const rcStyle = `
@keyframes rcFlow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -30; }
}
`;

function flowWidth(flow: number, maxFlow: number): number {
  if (maxFlow <= 0) return 1.5;
  return Math.max(1.5, Math.min(8, (flow / maxFlow) * 8));
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(20, (x2 - x1) * 0.5);
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function isQaPinned(stats: RecallStats): boolean {
  return Boolean(stats.qa_pinned);
}

function recallPathBadge(stats: RecallStats): string {
  const n = `${stats.routes.length} 路`;
  return isQaPinned(stats) ? `QA 置顶 · ${n}` : n;
}

export function RecallFlowChart({ stats, magnified = false }: { stats: RecallStats; magnified?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const qaPinned = isQaPinned(stats);

  const routes = stats.routes;
  const n = routes.length;
  const rowH = 76;
  const nodeH = 54;
  const H = Math.max(n * rowH + 24, 300);
  const centerY = H / 2;

  const colRecall = { x: 22, w: 158 };
  const colFuse = { x: 250, w: 134 };
  const colRerank = { x: 460, w: 134 };
  const W = colRerank.x + colRerank.w + 22;

  const maxFlow = Math.max(
    ...routes.map((r) => Math.max(r.recalled_count, r.aligned_count ?? r.recalled_count)),
    stats.fused_count,
    stats.rerank_count,
    1,
  );
  const sumAligned = routes.reduce(
    (s, r) => s + (r.aligned_count ?? r.recalled_count),
    0,
  );
  const dedupCount = Math.max(0, sumAligned - stats.fused_count);
  const thresholdDropped = stats.dropped_by_threshold ?? 0;
  const extraH = 72;
  const vbH = H + extraH;

  const recallNodes = routes.map((_, i) => ({
    x: colRecall.x,
    y: i * rowH + 12,
    w: colRecall.w,
    h: nodeH,
  }));
  const fuseNode = { x: colFuse.x, y: centerY - nodeH / 2, w: colFuse.w, h: nodeH };
  const rerankNode = { x: colRerank.x, y: centerY - nodeH / 2, w: colRerank.w, h: nodeH };
  const dedupNode = { x: colFuse.x, y: H + 14, w: colFuse.w, h: 36 };
  const dropNode = { x: colRerank.x, y: H + 14, w: colRerank.w, h: 36 };

  const chunkList = selectedChunks(selected, stats);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${vbH}`} className="w-full" role="img" aria-label="召回链路流向图">
        <defs>
          <linearGradient id="rcGrad" x1={0} y1={0} x2={W} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={COLOR_PRIMARY} />
            <stop offset="100%" stopColor={COLOR_CYAN} />
          </linearGradient>
          <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{rcStyle}</style>
        {renderFlows(routes, recallNodes, fuseNode, rerankNode, maxFlow, stats.fused_count, selected)}
        {renderNodes(
          routes, recallNodes, fuseNode, rerankNode, dedupNode, dropNode,
          dedupCount, thresholdDropped, stats.fused_count, stats.rerank_count,
          selected, setSelected, qaPinned,
        )}
      </svg>
      {qaPinned ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-800">
          QA 置顶：qa_dense 高置信命中，已把问答与依据原文钉在结果最前；对齐 / 融合 / rerank 仍已执行，依据 chunk 未进精排。
        </div>
      ) : null}
      <RerankAttributionPanel stats={stats} selected={selected} setSelected={setSelected} />
      <ChunkListPanel selected={selected} chunks={chunkList} stats={stats} magnified={magnified} />
    </div>
  );
}

function RerankAttributionPanel({
  stats,
  selected,
  setSelected,
}: {
  stats: RecallStats;
  selected: string | null;
  setSelected: (s: string | null) => void;
}) {
  const items = stats.routes
    .map((r, i) => ({ route: r.route, count: r.final_count ?? 0, idx: i }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  if (items.length === 0) return null;
  const total = items.reduce((s, x) => s + x.count, 0);
  const overlap = Math.max(0, total - stats.rerank_count);
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">Rerank 归属（各模块对最终结果的贡献）</span>
        <span className="text-[11px] text-muted-foreground">
          合计 {total} · 重复 {overlap} · 实际 {stats.rerank_count} 条
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((x) => {
          const key = `recall-${x.idx}`;
          const isSel = selected === key;
          return (
            <button
              type="button"
              key={x.route}
              onClick={() => setSelected(isSel ? null : key)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 transition-colors ${
                isSel
                  ? "bg-primary/10 text-primary ring-primary/40"
                  : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-100"
              }`}
              title={`${x.route} 贡献 ${x.count} 条`}
            >
              {x.route.length > 16 ? x.route.slice(0, 14) + "…" : x.route}
              <span className="ml-1 font-semibold text-primary">{x.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function selectedChunks(
  selected: string | null,
  stats: RecallStats,
): string[] | null {
  if (!selected) return null;
  if (selected.startsWith("recall-")) {
    const i = Number(selected.slice("recall-".length));
    return stats.routes[i]?.sample_chunk_ids ?? null;
  }
  if (selected === "fuse") return stats.fused_chunk_ids ?? null;
  if (selected === "rerank") return stats.final_chunk_ids ?? null;
  return null;
}

function renderFlows(
  routes: RecallStats["routes"],
  recallNodes: { x: number; y: number; w: number; h: number }[],
  fuseNode: { x: number; y: number; w: number; h: number },
  rerankNode: { x: number; y: number; w: number; h: number },
  maxFlow: number,
  fusedCount: number,
  selected: string | null,
) {
  const dim = (key: string) =>
    selected !== null && selected !== key && !selected.startsWith("recall-")
      ? 0.22
      : 1;
  const flows: ReactNode[] = [];
  // 召回→融合：每路单段流线，标注该路流入 RRF 的数量（aligned_count）
  routes.forEach((r, i) => {
    const ry = recallNodes[i].y + recallNodes[i].h / 2;
    const fy = fuseNode.y + fuseNode.h / 2;
    const w = flowWidth(r.aligned_count ?? r.recalled_count, maxFlow);
    const routeKey = `recall-${i}`;
    const routeDim = selected !== null && selected !== routeKey ? 0.28 : 1;
    flows.push(
      <path
        key={`rf-${i}`}
        d={bezier(recallNodes[i].x + recallNodes[i].w, ry, fuseNode.x, fy)}
        fill="none"
        stroke="url(#rcGrad)"
        strokeWidth={w}
        strokeLinecap="round"
        opacity={dim("fuse") * routeDim}
        strokeDasharray="6 9"
        style={{ animation: "rcFlow 1.1s linear infinite" }}
      />,
    );
    const midX = (recallNodes[i].x + recallNodes[i].w + fuseNode.x) / 2;
    const midY = (ry + fy) / 2 - 4;
    flows.push(
      <text
        key={`rf-lbl-${i}`}
        x={midX}
        y={midY}
        fontSize={11}
        fontWeight={600}
        fill={COLOR_PRIMARY}
        textAnchor="middle"
        opacity={routeDim}
      >
        {r.aligned_count ?? r.recalled_count}
      </text>,
    );
  });
  // 融合→rerank：单线，标注 fused_count
  const fy = fuseNode.y + fuseNode.h / 2;
  const ry = rerankNode.y + rerankNode.h / 2;
  const frDim =
    selected !== null && selected !== "fuse" && selected !== "rerank" ? 0.7 : 1;
  flows.push(
    <path
      key="fr-single"
      d={bezier(fuseNode.x + fuseNode.w, fy, rerankNode.x, ry)}
      fill="none"
      stroke="url(#rcGrad)"
      strokeWidth={flowWidth(fusedCount, maxFlow)}
      strokeLinecap="round"
      opacity={frDim}
      strokeDasharray="6 9"
      style={{ animation: "rcFlow 1.1s linear infinite" }}
    />,
  );
  flows.push(
    <text
      key="fr-lbl"
      x={(fuseNode.x + fuseNode.w + rerankNode.x) / 2}
      y={(fy + ry) / 2 - 4}
      fontSize={11}
      fontWeight={600}
      fill={COLOR_PRIMARY}
      textAnchor="middle"
      opacity={frDim}
    >
      {fusedCount}
    </text>,
  );
  return <>{flows}</>;
}

function renderNodes(
  routes: RecallStats["routes"],
  recallNodes: { x: number; y: number; w: number; h: number }[],
  fuseNode: { x: number; y: number; w: number; h: number },
  rerankNode: { x: number; y: number; w: number; h: number },
  dedupNode: { x: number; y: number; w: number; h: number },
  dropNode: { x: number; y: number; w: number; h: number },
  dedupCount: number,
  thresholdDropped: number,
  fusedCount: number,
  rerankCount: number,
  selected: string | null,
  setSelected: (s: string | null) => void,
  qaPinned: boolean,
) {
  const nodes: ReactNode[] = [];
  const sel = (k: string) => selected === k;

  // 召回节点
  routes.forEach((r, i) => {
    const rk = `recall-${i}`;
    const rn = recallNodes[i];
    const ry = rn.y + rn.h / 2;
    const isSel = sel(rk);
    const isPinnedRoute = qaPinned && r.route === "qa_dense";
    nodes.push(
      <g key={`rn-${i}`} onClick={() => setSelected(isSel ? null : rk)} style={{ cursor: "pointer" }}>
        <rect
          x={rn.x} y={rn.y} width={rn.w} height={rn.h} rx={9}
          fill={isSel ? "#ecfdf5" : "#ffffff"}
          stroke={isSel || isPinnedRoute ? COLOR_PRIMARY : "#e5e7eb"}
          strokeWidth={isSel || isPinnedRoute ? 1.8 : 1}
          filter={isSel ? "url(#nodeGlow)" : undefined}
        />
        <text x={rn.x + 10} y={ry - 7} fontSize={11} fontWeight={600} fill="#1A1A1A" className="font-mono">
          {r.route.length > 18 ? r.route.slice(0, 16) + "…" : r.route}
        </text>
        <text x={rn.x + 10} y={ry + 9} fontSize={10} fill="#6B7280">
          {r.execution_time_ms ? `${Math.round(r.execution_time_ms)}ms · ` : ""}召回 {r.recalled_count}
          {isPinnedRoute ? " · 置顶" : ""}
        </text>
      </g>,
    );
  });

  // 融合节点
  const fy = fuseNode.y + fuseNode.h / 2;
  const fuseSel = sel("fuse");
  nodes.push(
    <g key="fuse" onClick={() => setSelected(fuseSel ? null : "fuse")} style={{ cursor: "pointer" }}>
      <rect
        x={fuseNode.x} y={fuseNode.y} width={fuseNode.w} height={fuseNode.h} rx={10}
        fill={fuseSel ? COLOR_PRIMARY : "#ecfdf5"}
        stroke={COLOR_PRIMARY} strokeWidth={1.8}
        filter={fuseSel ? "url(#nodeGlow)" : undefined}
      />
      <text x={fuseNode.x + fuseNode.w / 2} y={fy - 6} fontSize={11} fontWeight={700} fill={fuseSel ? "#ffffff" : COLOR_PRIMARY} textAnchor="middle">
        RRF 融合
      </text>
      <text x={fuseNode.x + fuseNode.w / 2} y={fy + 12} fontSize={13} fontWeight={700} fill={fuseSel ? "#ffffff" : "#1A1A1A"} textAnchor="middle">
        {fusedCount}
      </text>
    </g>,
  );

  // rerank 节点
  const ry = rerankNode.y + rerankNode.h / 2;
  const rkSel = sel("rerank");
  nodes.push(
    <g key="rerank" onClick={() => setSelected(rkSel ? null : "rerank")} style={{ cursor: "pointer" }}>
      <rect
        x={rerankNode.x} y={rerankNode.y} width={rerankNode.w} height={rerankNode.h} rx={10}
        fill={rkSel ? COLOR_PRIMARY : "#ffffff"}
        stroke={rkSel ? COLOR_PRIMARY : "#e5e7eb"}
        strokeWidth={rkSel ? 1.8 : 1}
        filter={rkSel ? "url(#nodeGlow)" : undefined}
      />
      <text x={rerankNode.x + rerankNode.w / 2} y={ry - 6} fontSize={11} fontWeight={700} fill={rkSel ? "#ffffff" : "#1A1A1A"} textAnchor="middle">
        Rerank
      </text>
      <text x={rerankNode.x + rerankNode.w / 2} y={ry + 12} fontSize={13} fontWeight={700} fill={rkSel ? "#ffffff" : COLOR_PRIMARY} textAnchor="middle">
        {rerankCount}
      </text>
    </g>,
  );

  // 去重虚边 + 虚节点
  if (dedupCount > 0) {
    nodes.push(
      <path
        key="dedup-flow"
        d={bezier(fuseNode.x + fuseNode.w / 2, fuseNode.y + fuseNode.h, dedupNode.x + dedupNode.w / 2, dedupNode.y)}
        fill="none" stroke={COLOR_DEDUP} strokeWidth={Math.max(1.5, Math.min(8, dedupCount / 10))}
        strokeLinecap="round" opacity={0.5} strokeDasharray="3 5"
      />,
    );
    nodes.push(
      <g key="dedup">
        <rect x={dedupNode.x} y={dedupNode.y} width={dedupNode.w} height={dedupNode.h} rx={7}
          fill="none" stroke={COLOR_DEDUP} strokeWidth={1} strokeDasharray="4 3" />
        <text x={dedupNode.x + dedupNode.w / 2} y={dedupNode.y + 22} fontSize={10} fill={COLOR_DEDUP} textAnchor="middle">
          去重 −{dedupCount}
        </text>
      </g>,
    );
  }
  // 阈值过滤虚边 + 虚节点
  if (thresholdDropped > 0) {
    nodes.push(
      <path
        key="drop-flow"
        d={bezier(rerankNode.x + rerankNode.w / 2, rerankNode.y + rerankNode.h, dropNode.x + dropNode.w / 2, dropNode.y)}
        fill="none" stroke={COLOR_DEDUP} strokeWidth={Math.max(1.5, Math.min(8, thresholdDropped / 10))}
        strokeLinecap="round" opacity={0.5} strokeDasharray="3 5"
      />,
    );
    nodes.push(
      <g key="drop">
        <rect x={dropNode.x} y={dropNode.y} width={dropNode.w} height={dropNode.h} rx={7}
          fill="none" stroke={COLOR_DEDUP} strokeWidth={1} strokeDasharray="4 3" />
        <text x={dropNode.x + dropNode.w / 2} y={dropNode.y + 22} fontSize={10} fill={COLOR_DEDUP} textAnchor="middle">
          阈值过滤 −{thresholdDropped}
        </text>
      </g>,
    );
  }
  return <>{nodes}</>;
}

function ChunkListPanel({
  selected,
  chunks,
  stats,
  magnified = false,
}: {
  selected: string | null;
  chunks: string[] | null;
  stats: RecallStats;
  magnified?: boolean;
}) {
  if (!selected) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-[11px] text-muted-foreground">
        点击任意节点查看该阶段 chunk_id 明细
      </div>
    );
  }
  let title = "chunk_id";
  if (selected.startsWith("recall-")) {
    const i = Number(selected.slice("recall-".length));
    title = `${stats.routes[i]?.route ?? ""} · 样本 chunk_id`;
  } else if (selected === "fuse") {
    title = "融合后候选 chunk_id";
  } else if (selected === "rerank") {
    title = "Rerank 最终 chunk_id";
  }
  const list = chunks ?? [];
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">{list.length} 条</span>
      </div>
      {list.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">（无 chunk_id）</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {list.map((id, i) => {
            const display = magnified ? id : id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
            return (
              <span
                key={`${id}-${i}`}
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600 ring-1 ring-gray-200"
                title={magnified ? undefined : id}
              >
                {display}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecallFlowModal({
  stats,
  onClose,
}: {
  stats: RecallStats;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">召回链路</span>
            <span className="text-[11px] text-muted-foreground">
              {recallPathBadge(stats)}
            </span>
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
        <RecallFlowChart stats={stats} magnified />
      </div>
    </div>
  );
}

export function RecallPathSection({ stats }: { stats: RecallStats }) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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
          <Workflow className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-[13px] font-medium text-foreground">召回链路</span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {recallPathBadge(stats)}
          </span>
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
          <RecallFlowChart stats={stats} />
        </div>
      ) : null}
      {modalOpen ? (
        <RecallFlowModal stats={stats} onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  );
}
