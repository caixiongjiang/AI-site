"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  ChevronRight,
  Database,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { KnowledgeBaseInfo } from "@/lib/knowledge-types";
import { cn } from "@/lib/utils";

interface KnowledgeListProps {
  knowledgeBases: Array<
    KnowledgeBaseInfo & { fileCount: number; lastUpdated?: string }
  >;
  selectedId?: string;
  activeView?: "files" | "trash";
  onSelect: (id: string) => void;
  onSelectTrash?: () => void;
  onCreate?: () => void;
  onCreateChild?: (knowledgeBase: KnowledgeBaseInfo) => void;
  onDelete?: (knowledgeBase: KnowledgeBaseInfo) => void;
}

export const KnowledgeList = ({
  knowledgeBases,
  selectedId,
  activeView = "files",
  onSelect,
  onSelectTrash,
  onCreate,
  onCreateChild,
  onDelete,
}: KnowledgeListProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredIds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return null;

    const lookup = new Map(
      knowledgeBases.map((item) => [item.knowledge_base_id, item])
    );
    const next = new Set<string>();

    knowledgeBases.forEach((kb) => {
      const matched = `${kb.knowledge_base_name} ${kb.description ?? ""}`
        .toLowerCase()
        .includes(term);

      if (!matched) return;

      next.add(kb.knowledge_base_id);
      let parentId = kb.parent_knowledge_base_id;
      while (parentId) {
        next.add(parentId);
        parentId = lookup.get(parentId)?.parent_knowledge_base_id ?? null;
      }
    });

    return next;
  }, [knowledgeBases, searchTerm]);

  const childrenByParent = useMemo(() => {
    const next = new Map<string | null, typeof knowledgeBases>();
    knowledgeBases.forEach((kb) => {
      const parentId = kb.parent_knowledge_base_id ?? null;
      const list = next.get(parentId) ?? [];
      list.push(kb);
      next.set(parentId, list);
    });

    next.forEach((list) =>
      list.sort((a, b) => a.knowledge_base_name.localeCompare(b.knowledge_base_name))
    );

    return next;
  }, [knowledgeBases]);

  const renderNode = (
    kb: KnowledgeBaseInfo & { fileCount: number; lastUpdated?: string },
    depth = 0
  ): ReactNode => {
    if (filteredIds && !filteredIds.has(kb.knowledge_base_id)) {
      return null;
    }

    const isActive = kb.knowledge_base_id === selectedId && activeView === "files";
    const children = childrenByParent.get(kb.knowledge_base_id) ?? [];

    return (
      <div key={kb.knowledge_base_id} className="space-y-1">
        <button
          onClick={() => onSelect(kb.knowledge_base_id)}
          className={cn(
            "group w-full rounded-2xl border px-3 py-3 text-left transition-all",
            isActive
              ? "border-primary/50 bg-primary/10 shadow-[0_12px_30px_rgba(0,179,107,0.08)]"
              : "border-white/5 bg-dark-card hover:border-primary/30 hover:bg-dark-card/80"
          )}
          style={{ marginLeft: depth * 12 }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5">
              <Database className="h-4.5 w-4.5 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {kb.knowledge_base_name}
                </span>
                {children.length > 0 ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted" />
                ) : null}
              </div>
              {kb.description ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                  {kb.description}
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted">
                <span>{kb.fileCount} 个文件</span>
                <span>{kb.lastUpdated ? `更新于 ${kb.lastUpdated}` : "待同步"}</span>
              </div>
              {(onCreateChild || onDelete) && isActive ? (
                <div className="mt-3 flex items-center gap-2">
                  {onCreateChild ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCreateChild(kb);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onCreateChild(kb);
                        }
                      }}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary"
                    >
                      子知识库
                    </span>
                  ) : null}
                  {onDelete ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(kb);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onDelete(kb);
                        }
                      }}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-red-300 transition-colors hover:border-red-500/40"
                    >
                      删除
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </button>
        {children.length > 0 ? (
          <div className="space-y-1">{children.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  const roots = childrenByParent.get(null) ?? [];

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-dark-border bg-[#161819]">
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

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {roots.map((kb) => renderNode(kb))}
        </div>
      </div>

      <div className="border-t border-dark-border p-3">
        <button
          onClick={onSelectTrash}
          disabled={!selectedId}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
            activeView === "trash"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-white/5 bg-dark-card text-muted hover:border-primary/30 hover:text-foreground"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
            <Trash2 className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-foreground">回收站</div>
            <div className="mt-1 text-[11px] text-muted">
              {selectedId ? "当前知识库已删除内容" : "先选择一个知识库"}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};
