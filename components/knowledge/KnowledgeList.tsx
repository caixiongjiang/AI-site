"use client";

import { useState } from "react";
import { Database, Plus, Search, Sparkles } from "lucide-react";
import { KnowledgeBaseInfo } from "@/lib/knowledge-types";
import { cn } from "@/lib/utils";

interface KnowledgeListProps {
  knowledgeBases: Array<
    KnowledgeBaseInfo & { fileCount: number; lastUpdated?: string }
  >;
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
}

export const KnowledgeList = ({
  knowledgeBases,
  selectedId,
  onSelect,
  onCreate,
}: KnowledgeListProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = knowledgeBases.filter((kb) =>
    `${kb.knowledge_base_name} ${kb.description ?? ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-dark-border bg-[#161819]">
      <div className="border-b border-dark-border px-5 py-6">
        <div className="rounded-2xl border border-white/5 bg-[linear-gradient(145deg,rgba(0,179,107,0.22),rgba(20,24,26,0.95))] p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-primary-light" />
                ima 风格知识库
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                管理资料、自动处理文件、快速进入文档问答。
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-foreground">
              {knowledgeBases.length} 个库
            </span>
          </div>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-black transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-3.5 w-3.5" />
            新建知识库
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/5 bg-dark-card px-3.5 py-3 transition-all focus-within:border-primary">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索知识库..."
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.map((kb) => {
          const isActive = kb.knowledge_base_id === selectedId;

          return (
            <button
              key={kb.knowledge_base_id}
              onClick={() => onSelect(kb.knowledge_base_id)}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all",
                isActive
                  ? "border-primary/50 bg-primary/10 shadow-[0_12px_30px_rgba(0,179,107,0.08)]"
                  : "border-white/5 bg-dark-card hover:border-primary/30 hover:bg-dark-card/80"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5">
                  <Database className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {kb.knowledge_base_name}
                  </div>
                  {kb.description && (
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                      {kb.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted">
                <span>{kb.fileCount} 个文件</span>
                <span>{kb.lastUpdated ? `更新于 ${kb.lastUpdated}` : "待同步"}</span>
              </div>
              {isActive && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-primary-light">
                  <Sparkles className="h-3.5 w-3.5" />
                  当前工作台
                </div>
              )}
              <div className="sr-only">
                {kb.knowledge_base_name}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
