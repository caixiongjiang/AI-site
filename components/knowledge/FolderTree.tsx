"use client";

import { FolderInfo } from "@/lib/knowledge-types";
import { cn } from "@/lib/utils";
import { ChevronRight, Folder, FolderPlus, Layers } from "lucide-react";

interface FolderTreeProps {
  folders: FolderInfo[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onCreate?: () => void;
}

export const FolderTree = ({
  folders,
  selectedId,
  onSelect,
  onCreate,
}: FolderTreeProps) => {
  const sorted = [...folders].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.full_path.localeCompare(b.full_path);
  });

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-dark-border bg-[#151718]">
      <div className="border-b border-dark-border p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-foreground">目录结构</div>
            <div className="mt-1 text-xs text-muted">像 ima 一样按主题整理文档</div>
          </div>
          <button
            onClick={onCreate}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition-colors hover:border-primary hover:text-foreground"
            aria-label="新建文件夹"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all",
            selectedId === null
              ? "bg-primary/15 text-foreground"
              : "text-muted hover:bg-dark-card"
          )}
        >
          <Layers className="h-4 w-4" />
          <span className="flex-1 text-left">全部文件</span>
        </button>
        {sorted.map((folder) => (
          <button
            key={folder.folder_id}
            onClick={() => onSelect(folder.folder_id)}
            className={cn(
              "mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all",
              selectedId === folder.folder_id
                ? "bg-primary/15 text-foreground"
                : "text-muted hover:bg-dark-card"
            )}
            style={{ paddingLeft: 12 + folder.depth * 14 }}
          >
            <Folder className="h-4 w-4" />
            <span className="flex-1 truncate text-left">{folder.folder_name}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          </button>
        ))}
      </div>
    </aside>
  );
};
