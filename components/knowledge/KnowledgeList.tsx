"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { KnowledgeBase } from "@/lib/types";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeListProps {
  knowledgeBases: KnowledgeBase[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export const KnowledgeList = ({
  knowledgeBases,
  selectedId,
  onSelect,
}: KnowledgeListProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = knowledgeBases.filter((kb) =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-dark-border bg-[#1E1E1E]">
      {/* Header */}
      <div className="border-b border-dark-border p-5">
        <h2 className="mb-4 text-lg text-foreground">知识库</h2>
        <div className="flex items-center gap-2.5 rounded-lg border-2 border-transparent bg-dark-card px-3.5 py-2.5 transition-all focus-within:border-primary">
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

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.map((kb) => {
          const IconComponent = (Icons as any)[kb.icon] || Icons.Library;
          const isActive = kb.id === selectedId;

          return (
            <button
              key={kb.id}
              onClick={() => onSelect(kb.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-3.5 transition-all",
                isActive
                  ? "border-l-2 border-primary bg-primary/15"
                  : "bg-dark-card hover:bg-dark-card/80"
              )}
            >
              <IconComponent className="h-6 w-6 shrink-0 text-foreground" />
              <div className="flex-1 text-left min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {kb.name}
                </div>
                <div className="truncate text-xs text-muted">
                  {kb.fileCount}个文件 · {kb.lastUpdated}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
