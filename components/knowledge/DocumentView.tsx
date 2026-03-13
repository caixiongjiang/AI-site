"use client";

import { KnowledgeFile } from "@/lib/knowledge-types";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  Bot,
  Clock3,
  FileText,
  Library,
  ScanSearch,
  Sparkles,
} from "lucide-react";

interface DocumentViewProps {
  file: KnowledgeFile;
  kbName: string;
  onAskClick: () => void;
}

const insightPrompts = [
  "帮我提炼这份材料的 3 个核心观点",
  "按决策者视角总结文档里的关键风险",
  "列出适合继续追问的事实、结论和缺口",
];

const statusLabelMap: Record<string, string> = {
  pending: "等待索引",
  processing: "正在解析",
  success: "可用于问答",
  failed: "索引失败",
};

export const DocumentView = ({
  file,
  kbName,
  onAskClick,
}: DocumentViewProps) => {
  const progress = Math.round((file.progress ?? 0) * 100);
  const statusLabel = statusLabelMap[file.index_status || "pending"];

  return (
    <div className="mx-auto max-w-[980px]">
      <div className="rounded-[32px] border border-white/5 bg-[linear-gradient(135deg,rgba(0,179,107,0.16),rgba(21,24,25,0.96))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary-light" />
              ima 式文档理解
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <FileText className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-3xl text-foreground">{file.file_name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Library className="h-3.5 w-3.5" />
                    {kbName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {file.updated_at ? `${formatDate(file.updated_at)} 更新` : "等待同步"}
                  </span>
                  <span>{formatBytes(file.file_size)}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onAskClick}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Bot className="h-4 w-4" />
            进入问答
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/5 bg-dark-card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">索引状态</div>
          <div className="mt-3 text-lg text-foreground">{statusLabel}</div>
          <div className="mt-2 h-2 rounded-full bg-black/20">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(progress, file.index_status === "success" ? 100 : 8)}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-muted">{progress}%</div>
        </div>
        <div className="rounded-[24px] border border-white/5 bg-dark-card p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">文档说明</div>
          <div className="mt-3 text-sm leading-6 text-foreground">
            {file.description || "暂无结构化描述，建议通过右侧问答生成摘要与重点。"}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/5 bg-dark-card p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
            <ScanSearch className="h-3.5 w-3.5" />
            建议提问
          </div>
          <div className="mt-3 space-y-2">
            {insightPrompts.map((prompt) => (
              <div
                key={prompt}
                className="rounded-2xl border border-white/5 bg-black/10 px-3 py-2 text-sm text-foreground"
              >
                {prompt}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
