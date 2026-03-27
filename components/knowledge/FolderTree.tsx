"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FolderInfo, KnowledgeBaseInfo, KnowledgeFile } from "@/lib/knowledge-types";
import { cn, formatBytes } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";

interface FolderTreeProps {
  knowledgeBase?: KnowledgeBaseInfo | null;
  folders: FolderInfo[];
  files: KnowledgeFile[];
  selectedFolderId?: string | null;
  searchTerm?: string;
  canMoveFiles?: boolean;
  onSelectFolder: (id: string | null) => void;
  onOpenFile?: (file: KnowledgeFile) => void;
  onCreateFolder?: () => void;
  onUploadFile?: () => void;
  onDeleteFolder?: (folder: FolderInfo) => void;
  onDeleteFile?: (file: KnowledgeFile) => void;
  onMoveFileToFolder?: (file: KnowledgeFile, targetFolderId: string | null) => void;
}

const fileStatusMap: Record<
  string,
  { label: string; className: string; barClassName: string }
> = {
  pending: {
    label: "排队中",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    barClassName: "bg-amber-500",
  },
  processing: {
    label: "处理中",
    className: "border-sky-500/20 bg-sky-500/10 text-sky-200",
    barClassName: "bg-sky-500",
  },
  success: {
    label: "可提问",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    barClassName: "bg-emerald-500",
  },
  failed: {
    label: "失败",
    className: "border-red-500/20 bg-red-500/10 text-red-200",
    barClassName: "bg-red-500",
  },
};

export const FolderTree = ({
  knowledgeBase,
  folders,
  files,
  selectedFolderId,
  searchTerm = "",
  canMoveFiles = false,
  onSelectFolder,
  onOpenFile,
  onCreateFolder,
  onUploadFile,
  onDeleteFolder,
  onDeleteFile,
  onMoveFileToFolder,
}: FolderTreeProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);

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
    const progress = Math.max(0, Math.min(1, file.progress ?? 0));
    const statusUi = fileStatusMap[status] ?? fileStatusMap.pending;

    return (
      <div
        key={file.file_id}
        draggable={canMoveFiles}
        onDragStart={() => setDraggingFileId(file.file_id)}
        onDragEnd={() => setDraggingFileId(null)}
        className={cn(
          "group mb-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
          "border-transparent text-muted hover:bg-dark-card hover:text-foreground",
          canMoveFiles && "cursor-grab active:cursor-grabbing",
          draggingFileId === file.file_id && "opacity-50"
        )}
        style={{ marginLeft: depth * 14 }}
      >
        <button
          type="button"
          onClick={() => onOpenFile?.(file)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm">{file.file_name}</div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                  statusUi.className
                )}
              >
                {statusUi.label}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span>{formatBytes(file.file_size)}</span>
              {file.mime_type ? <span>{file.mime_type}</span> : null}
            </div>
            {status !== "success" ? (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-black/20">
                  <div
                    className={cn("h-1.5 rounded-full transition-all", statusUi.barClassName)}
                    style={{
                      width: `${Math.max(Math.round(progress * 100), status === "failed" ? 12 : 6)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {status === "failed"
                    ? "处理失败，请重新上传或稍后重试"
                    : `${Math.round(progress * 100)}% · 文档处理中`}
                </div>
              </div>
            ) : null}
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        {onDeleteFile ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(file);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
            aria-label={`删除 ${file.file_name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
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
    const isSelected = selectedFolderId === folder.folder_id;

    return (
      <div key={folder.folder_id}>
        <div
          onDragOver={(event) => {
            if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
            event.preventDefault();
            const file = files.find((item) => item.file_id === draggingFileId);
            setDraggingFileId(null);
            if (file) {
              onMoveFileToFolder(file, folder.folder_id);
            }
          }}
          className={cn(
            "mb-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
            isSelected
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-transparent text-muted hover:bg-dark-card hover:text-foreground",
            draggingFileId && canMoveFiles && "data-[drop=true]:border-primary/40"
          )}
          style={{ marginLeft: depth * 14 }}
        >
          <button
            type="button"
            onClick={() => {
              toggleFolder(folder.folder_id);
              onSelectFolder(folder.folder_id);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <Folder className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{folder.folder_name}</div>
              <div className="mt-0.5 text-[11px] text-muted">{folder.full_path}</div>
            </div>
          </button>
          {onDeleteFolder && folder.is_default !== 1 ? (
            <button
              type="button"
              onClick={() => onDeleteFolder(folder)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
              aria-label={`删除 ${folder.folder_name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {isExpanded ? (
          <div>
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childFiles.map((file) => renderFile(file, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const rootFolders = childrenByParent.get(null) ?? [];

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/5 bg-[#141718] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="border-b border-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Layers className="h-4 w-4 text-primary-light" />
              目录结构
            </div>
            <div className="mt-2 text-xs leading-5 text-muted">
              {knowledgeBase
                ? `当前知识库：${knowledgeBase.knowledge_base_name}`
                : "选择知识库后，这里会展开文件夹和文件。"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onUploadFile ? (
              <button
                type="button"
                onClick={onUploadFile}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition-colors hover:border-primary hover:text-foreground"
                aria-label="上传文件"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : null}
            {onCreateFolder ? (
              <button
                type="button"
                onClick={onCreateFolder}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted transition-colors hover:border-primary hover:text-foreground"
                aria-label="新建文件夹"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-b border-white/5 px-5 py-3 text-[11px] text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span>{folders.length} 个文件夹</span>
          <span>{files.length} 个文件</span>
          <span>{canMoveFiles ? "支持拖动文件到目录" : "缺少文件移动接口，暂不可拖动落库"}</span>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          if (!canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
          event.preventDefault();
          const file = files.find((item) => item.file_id === draggingFileId);
          setDraggingFileId(null);
          if (file) {
            onMoveFileToFolder(file, null);
          }
        }}
        className="flex-1 overflow-y-auto p-4"
      >
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={cn(
            "mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all",
            selectedFolderId === null
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-transparent text-muted hover:bg-dark-card hover:text-foreground"
          )}
        >
          <Layers className="h-4 w-4" />
          <span className="flex-1 text-left">全部文件</span>
        </button>

        {rootFolders.map((folder) => renderFolder(folder, 0))}
        {filteredRootFiles.map((file) => renderFile(file, 0))}

        {rootFolders.length === 0 && filteredRootFiles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-dark-card/70 p-6 text-sm text-muted">
            当前目录还没有内容。
          </div>
        ) : null}
      </div>
    </section>
  );
};
