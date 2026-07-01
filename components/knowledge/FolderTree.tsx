"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FolderInfo, KnowledgeBaseInfo, KnowledgeFile } from "@/lib/knowledge-types";
import { cn, formatBytes } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Folder,
  FolderPlus,
  Loader2,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FileIcon } from "@/components/knowledge/FileIcon";

interface FolderTreeProps {
  knowledgeBase?: KnowledgeBaseInfo | null;
  folders: FolderInfo[];
  files: KnowledgeFile[];
  selectedFolderId?: string | null;
  searchTerm?: string;
  canMoveFiles?: boolean;
  activeView?: "files" | "trash";
  onSelectFolder: (id: string | null) => void;
  onOpenFile?: (file: KnowledgeFile) => void;
  onCreateFolder?: (parentFolderId: string | null) => void;
  onUploadFile?: (targetFolderId: string | null) => void;
  onDeleteFolder?: (folder: FolderInfo) => void;
  onDeleteFile?: (file: KnowledgeFile) => void;
  onRetryFile?: (file: KnowledgeFile) => void;
  onMoveFileToFolder?: (file: KnowledgeFile, targetFolderId: string | null) => void;
  onSearchChange?: (term: string) => void;
  onSelectTrash?: () => void;
  trashContent?: ReactNode;
  /** 知识库列表已折叠时，在文件夹树头部显示展开按钮 */
  kbListCollapsed?: boolean;
  onExpandKbList?: () => void;
}

export const FolderTree = ({
  knowledgeBase,
  folders,
  files,
  selectedFolderId,
  searchTerm = "",
  canMoveFiles = false,
  activeView = "files",
  onSelectFolder,
  onOpenFile,
  onCreateFolder,
  onUploadFile,
  onDeleteFolder,
  onDeleteFile,
  onRetryFile,
  onMoveFileToFolder,
  onSearchChange,
  onSelectTrash,
  trashContent,
  kbListCollapsed = false,
  onExpandKbList,
}: FolderTreeProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setExpandedFolders((current) => {
      const next = { ...current };
      folders.forEach((folder) => {
        if (folder.depth <= 1 && next[folder.folder_id] === undefined) {
          next[folder.folder_id] = true;
        }
      });
      return next;
    });
  }, [folders]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filesByFolder = useMemo(() => {
    const next = new Map<string | null, KnowledgeFile[]>();
    files.forEach((file) => {
      const key = file.folder_id ?? null;
      const list = next.get(key) ?? [];
      list.push(file);
      next.set(key, list);
    });
    next.forEach((list) => list.sort((a, b) => a.file_name.localeCompare(b.file_name)));
    return next;
  }, [files]);

  const childrenByParent = useMemo(() => {
    const next = new Map<string | null, FolderInfo[]>();
    folders.forEach((folder) => {
      const key = folder.parent_folder_id ?? null;
      const list = next.get(key) ?? [];
      list.push(folder);
      next.set(key, list);
    });
    next.forEach((list) => list.sort((a, b) => a.folder_name.localeCompare(b.folder_name)));
    return next;
  }, [folders]);

  const visibleFolderIds = useMemo(() => {
    if (!normalizedSearch) return null;

    const folderLookup = new Map(folders.map((folder) => [folder.folder_id, folder]));
    const next = new Set<string>();

    folders.forEach((folder) => {
      if (folder.folder_name.toLowerCase().includes(normalizedSearch)) {
        next.add(folder.folder_id);
        let parentId = folder.parent_folder_id;
        while (parentId) {
          next.add(parentId);
          parentId = folderLookup.get(parentId)?.parent_folder_id ?? null;
        }
      }
    });

    files.forEach((file) => {
      const matched = `${file.file_name} ${file.description ?? ""} ${file.mime_type ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch);

      if (!matched) return;

      let folderId = file.folder_id ?? null;
      while (folderId) {
        next.add(folderId);
        folderId = folderLookup.get(folderId)?.parent_folder_id ?? null;
      }
    });

    return next;
  }, [files, folders, normalizedSearch]);

  const filteredRootFiles = useMemo(() => {
    const rootFiles = filesByFolder.get(null) ?? [];
    if (!normalizedSearch) return rootFiles;
    return rootFiles.filter((file) =>
      `${file.file_name} ${file.description ?? ""} ${file.mime_type ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [filesByFolder, normalizedSearch]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !current[folderId],
    }));
  };

  const renderFile = (file: KnowledgeFile, depth: number) => {
    if (
      normalizedSearch &&
      !`${file.file_name} ${file.description ?? ""} ${file.mime_type ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch)
    ) {
      return null;
    }

    const status = file.index_status ?? "pending";
    const isProcessing = status !== "success" && status !== "failed";
    const isFailed = status === "failed";
    const isDraggable = canMoveFiles && status === "success";
    const pct = Math.round(Math.max(0, Math.min(1, file.progress ?? 0)) * 100);

    const statusLabels: Record<string, string> = {
      pending: "排队中",
      processing: `${pct}%`,
      failed: "失败",
    };

    return (
      <div
        key={file.file_id}
        draggable={isDraggable}
        onDragStart={() => setDraggingFileId(file.file_id)}
        onDragEnd={() => setDraggingFileId(null)}
        className={cn(
          "group flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted transition-colors hover:bg-gray-100 hover:text-foreground",
          isDraggable && "cursor-grab active:cursor-grabbing",
          draggingFileId === file.file_id && "opacity-40"
        )}
        style={{ paddingLeft: 10 + depth * 20 }}
      >
        <FileIcon fileName={file.file_name} className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{file.file_name}</span>

        {isProcessing || isFailed ? (
          <span className={cn(
            "flex shrink-0 items-center gap-1 text-[11px] group-hover:hidden",
            isFailed ? "text-red-500" : "text-primary"
          )}>
            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {statusLabels[status] ?? status}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-muted/40 group-hover:hidden">
            {formatBytes(file.file_size)}
          </span>
        )}
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {isFailed && onRetryFile ? (
            <button
              type="button"
              onClick={() => onRetryFile(file)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-primary"
              title="重试"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {status === "success" && onOpenFile ? (
            <button
              type="button"
              onClick={() => onOpenFile(file)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
              title="详情"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onDeleteFile ? (
            <button
              type="button"
              onClick={() => onDeleteFile(file)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-red-300"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderFolder = (folder: FolderInfo, depth: number): ReactNode => {
    if (visibleFolderIds && !visibleFolderIds.has(folder.folder_id)) {
      return null;
    }

    const childFolders = childrenByParent.get(folder.folder_id) ?? [];
    const childFiles = filesByFolder.get(folder.folder_id) ?? [];
    const isExpanded = expandedFolders[folder.folder_id] ?? depth < 1;
    const isDragOver = dragOverFolderId === folder.folder_id && !!draggingFileId;

    return (
      <div key={folder.folder_id}>
        <div
          onDragOver={(event) => {
            if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
            event.preventDefault();
            event.stopPropagation();
            setDragOverFolderId(folder.folder_id);
          }}
          onDragLeave={() => {
            if (dragOverFolderId === folder.folder_id) setDragOverFolderId(null);
          }}
          onDrop={(event) => {
            if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
            event.preventDefault();
            event.stopPropagation();
            setDragOverFolderId(null);
            const file = files.find((item) => item.file_id === draggingFileId);
            setDraggingFileId(null);
            if (file) {
              onMoveFileToFolder(file, folder.folder_id);
            }
          }}
          className={cn(
            "group flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors",
            isDragOver
              ? "bg-primary/10 text-foreground"
              : "text-foreground/80 hover:bg-gray-100"
          )}
          style={{ paddingLeft: 10 + depth * 20 }}
        >
          <button
            type="button"
            onClick={() => {
              toggleFolder(folder.folder_id);
              onSelectFolder(folder.folder_id);
            }}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
            )}
            <Folder className="h-4 w-4 shrink-0 text-muted/60" />
            <span className="min-w-0 flex-1 truncate text-left">{folder.folder_name}</span>
          </button>
          <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            {onUploadFile ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUploadFile(folder.folder_id); }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
                title="上传文件到此文件夹"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onCreateFolder ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCreateFolder(folder.folder_id); }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
                title="在此文件夹下新建子文件夹"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onDeleteFolder && folder.is_default !== 1 ? (
              <button
                type="button"
                onClick={() => onDeleteFolder(folder)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        {isExpanded ? (
          <>
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childFiles.map((file) => renderFile(file, depth + 1))}
          </>
        ) : null}
      </div>
    );
  };

  const rootFolders = childrenByParent.get(null) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {kbListCollapsed && onExpandKbList ? (
            <button
              type="button"
              onClick={onExpandKbList}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
              title="展开知识库管理"
              aria-label="展开知识库管理"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          ) : null}
          <span className="truncate text-sm font-medium text-foreground/70">
            {knowledgeBase ? knowledgeBase.knowledge_base_name : "目录"}
          </span>
        </div>
        {activeView !== "trash" ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSearchOpen(!searchOpen);
                if (searchOpen && onSearchChange) onSearchChange("");
              }}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-gray-100 hover:text-foreground",
                searchOpen && "bg-gray-100 text-foreground"
              )}
              aria-label="搜索"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            {onCreateFolder ? (
              <button
                type="button"
                onClick={() => onCreateFolder(null)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
                aria-label="新建文件夹"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onUploadFile ? (
              <button
                type="button"
                onClick={() => onUploadFile(null)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
                aria-label="上传文件"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeView === "trash" && trashContent ? (
        <div className="flex-1 overflow-y-auto">{trashContent}</div>
      ) : (
        <>
          {searchOpen ? (
            <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="搜索..."
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/50"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => onSearchChange?.("")}
                  className="flex h-4 w-4 items-center justify-center rounded text-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            onDragOver={(event) => {
              if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
              event.preventDefault();
              setDragOverFolderId("__root__");
            }}
            onDragLeave={() => {
              if (dragOverFolderId === "__root__") setDragOverFolderId(null);
            }}
            onDrop={(event) => {
              if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
              event.preventDefault();
              setDragOverFolderId(null);
              const file = files.find((item) => item.file_id === draggingFileId);
              setDraggingFileId(null);
              if (file) {
                onMoveFileToFolder(file, null);
              }
            }}
            className="flex-1 overflow-y-auto py-1"
          >
            {rootFolders.map((folder) => renderFolder(folder, 0))}
            {filteredRootFiles.map((file) => renderFile(file, 0))}

            {rootFolders.length === 0 && filteredRootFiles.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted/50">
                暂无内容
              </div>
            ) : null}
          </div>
        </>
      )}

      {onSelectTrash ? (
        <div className="border-t border-gray-200 py-1">
          <button
            type="button"
            onClick={onSelectTrash}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
              activeView === "trash"
                ? "bg-primary/10 text-foreground"
                : "text-muted hover:bg-gray-100 hover:text-foreground"
            )}
            style={{ paddingLeft: 10 }}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>回收站</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};
