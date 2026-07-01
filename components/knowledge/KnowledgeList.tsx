"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  ChevronRight,
  Database,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { KnowledgeBaseInfo } from "@/lib/knowledge-types";
import { cn } from "@/lib/utils";

interface KnowledgeListProps {
  knowledgeBases: Array<
    KnowledgeBaseInfo & { fileCount: number; lastUpdated?: string }
  >;
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  onCreateChild?: (knowledgeBase: KnowledgeBaseInfo) => void;
  onDelete?: (knowledgeBase: KnowledgeBaseInfo) => void;
  /** 仅折叠知识库列表栏，不影响右侧文件夹/文件树 */
  collapsed?: boolean;
  onCollapse?: () => void;
}

export const KnowledgeList = ({
  knowledgeBases,
  selectedId,
  onSelect,
  onCreate,
  onCreateChild,
  onDelete,
  collapsed = false,
  onCollapse,
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

    const isActive = kb.knowledge_base_id === selectedId;
    const children = childrenByParent.get(kb.knowledge_base_id) ?? [];

    const indent = Math.min(depth * 12, 36);

    return (
      <div key={kb.knowledge_base_id} className="space-y-1">
        <button
          onClick={() => onSelect(kb.knowledge_base_id)}
          className={cn(
            "group w-full overflow-hidden rounded-xl border py-2 pr-3 text-left transition-all",
            isActive
              ? "border-primary/50 bg-primary/5"
              : "border-gray-200 bg-white hover:border-primary/30"
          )}
          style={{ paddingLeft: 12 + indent }}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <Database className="h-3.5 w-3.5 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-medium text-foreground">
                  {kb.knowledge_base_name}
                </span>
                {children.length > 0 ? (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted" />
                ) : null}
              </div>
              <div className="text-[11px] text-muted">
                {kb.fileCount} 个文件
              </div>
            </div>
          </div>
          {(onCreateChild || onDelete) && isActive ? (
            <div className="mt-1.5 flex items-center gap-1.5" style={{ paddingLeft: 36 - indent }}>
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
                  className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:border-primary"
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
                  className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-red-500 transition-colors hover:border-red-400"
                >
                  删除
                </span>
              ) : null}
            </div>
          ) : null}
        </button>
        {children.length > 0 ? (
          <div className="space-y-1">{children.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  const roots = childrenByParent.get(null) ?? [];

  if (collapsed) {
    return null;
  }

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-gray-200/70 hover:text-foreground"
                title="收起知识库管理"
                aria-label="收起知识库管理"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              </button>
            ) : null}
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">知识库</span>
            </div>
          </div>
          <button
            onClick={onCreate}
            className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-3 w-3" />
            新建
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 transition-all focus-within:border-primary">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索..."
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {roots.map((kb) => renderNode(kb))}
        </div>
      </div>

    </aside>
  );
};
