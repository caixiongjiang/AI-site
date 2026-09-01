"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FolderInfo, KnowledgeBaseInfo, KnowledgeFile } from "@/lib/knowledge-types";
import { cn, formatBytes } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  Folder,
  FolderPlus,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { FileIcon } from "@/components/knowledge/FileIcon";
import type { UploadTaskItem } from "@/components/knowledge/UploadProgressCard";

/** 缩进步长：知识库 → 子知识库 → 文件夹 → 子文件夹 → 文件 最深五层，用 12px 控制总缩进 */
const INDENT_STEP = 12;
const INDENT_BASE = 10;
/** 缩进层数上限：面板只有 240~420px，再深就该把宽度留给名字 */
const INDENT_MAX_DEPTH = 6;

const indentOf = (depth: number) =>
  INDENT_BASE + Math.min(depth, INDENT_MAX_DEPTH) * INDENT_STEP;

/** 展开状态持久化：刷新后保持用户手动折叠的结果，而不是回到默认全展开 */
const EXPANDED_STORAGE_KEY = "knowledge-tree-expanded-v1";

type ExpandedState = { kbs: Record<string, boolean>; folders: Record<string, boolean> };

function readExpandedState(): ExpandedState {
  if (typeof window === "undefined") return { kbs: {}, folders: {} };
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return { kbs: {}, folders: {} };
    const parsed = JSON.parse(raw) as Partial<ExpandedState>;
    return {
      kbs: parsed.kbs ?? {},
      folders: parsed.folders ?? {},
    };
  } catch {
    return { kbs: {}, folders: {} };
  }
}

/** 只落盘展开项，避免键随折叠操作无限增长 */
function pickExpanded(map: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(map).filter(([, open]) => open));
}

export type KnowledgeBaseNode = KnowledgeBaseInfo & {
  fileCount: number;
  lastUpdated?: string;
};

interface KnowledgeTreeProps {
  /**
   * 全量知识库，由调用方拍平后传入。
   * 仍按 parent_knowledge_base_id 嵌套渲染，以兼容历史上创建的子知识库；
   * 新建子知识库的入口已下线，不再产生新的嵌套。
   */
  knowledgeBases: KnowledgeBaseNode[];
  /** 当前激活的知识库；只有它的文件夹与文件会被展开渲染 */
  selectedKbId?: string;
  /** 当前问答锁定的知识库；与 selectedKbId 解耦，点击知识库行不会改变它 */
  chatKbId?: string | null;
  folders: FolderInfo[];
  files: KnowledgeFile[];
  uploadTasks?: UploadTaskItem[];
  /** 当前问答锁定的文件夹（由文件夹行的对话按钮写入） */
  selectedFolderId?: string | null;
  searchTerm?: string;
  canMoveFiles?: boolean;
  onSelectKb: (id: string) => void;
  /** 围绕整个知识库问答；只由知识库行的「对话」按钮触发 */
  onChatWithKb?: (kb: KnowledgeBaseInfo) => void;
  onCreateKb?: () => void;
  onDeleteKb?: (kb: KnowledgeBaseInfo) => void;
  /** 进入该文件夹的问答会话；点文件夹行本身只展开/折叠，不切会话 */
  onSelectFolder: (id: string | null) => void;
  onOpenFile?: (file: KnowledgeFile) => void;
  onCreateFolder?: (parentFolderId: string | null) => void;
  onUploadFile?: (targetFolderId: string | null) => void;
  onDeleteFolder?: (folder: FolderInfo) => void;
  onDeleteFile?: (file: KnowledgeFile) => void;
  onRetryFile?: (file: KnowledgeFile) => void;
  onMoveFileToFolder?: (file: KnowledgeFile, targetFolderId: string | null) => void;
  onSearchChange?: (term: string) => void;
}

export const KnowledgeTree = ({
  knowledgeBases,
  selectedKbId,
  chatKbId,
  folders,
  files,
  uploadTasks = [],
  selectedFolderId,
  searchTerm = "",
  canMoveFiles = false,
  onSelectKb,
  onChatWithKb,
  onCreateKb,
  onDeleteKb,
  onSelectFolder,
  onOpenFile,
  onCreateFolder,
  onUploadFile,
  onDeleteFolder,
  onDeleteFile,
  onRetryFile,
  onMoveFileToFolder,
  onSearchChange,
}: KnowledgeTreeProps) => {
  const [expandedKbs, setExpandedKbs] = useState<Record<string, boolean>>(
    () => readExpandedState().kbs
  );
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(
    () => readExpandedState().folders
  );
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // 激活的知识库总是展开，否则用户点了知识库却看不到里面的内容
  useEffect(() => {
    if (!selectedKbId) return;
    setExpandedKbs((current) =>
      current[selectedKbId] ? current : { ...current, [selectedKbId]: true }
    );
  }, [selectedKbId]);

  // 文件夹默认折叠：展开与否完全由用户操作决定，并跨刷新保留
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        EXPANDED_STORAGE_KEY,
        JSON.stringify({
          kbs: pickExpanded(expandedKbs),
          folders: pickExpanded(expandedFolders),
        })
      );
    } catch {
      // 隐私模式或配额写满时忽略，展开状态退化为仅本次会话有效
    }
  }, [expandedKbs, expandedFolders]);

  // 当有上传任务分配到某个文件夹时，自动展开该文件夹及其各级父文件夹，便于即时看到占位项
  useEffect(() => {
    if (!uploadTasks || uploadTasks.length === 0) return;
    const folderLookup = new Map(folders.map((f) => [f.folder_id, f]));
    setExpandedFolders((current) => {
      let changed = false;
      const next = { ...current };
      uploadTasks.forEach((task) => {
        let fid = task.folderId;
        while (fid) {
          if (!next[fid]) {
            next[fid] = true;
            changed = true;
          }
          fid = folderLookup.get(fid)?.parent_folder_id ?? null;
        }
      });
      return changed ? next : current;
    });
  }, [uploadTasks, folders]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const kbChildrenByParent = useMemo(() => {
    const next = new Map<string | null, KnowledgeBaseNode[]>();
    knowledgeBases.forEach((kb) => {
      const key = kb.parent_knowledge_base_id ?? null;
      const list = next.get(key) ?? [];
      list.push(kb);
      next.set(key, list);
    });
    next.forEach((list) =>
      list.sort((a, b) => a.knowledge_base_name.localeCompare(b.knowledge_base_name))
    );
    return next;
  }, [knowledgeBases]);

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

  const tasksByFolder = useMemo(() => {
    const next = new Map<string | null, UploadTaskItem[]>();
    const existingFileIds = new Set(files.map((f) => f.file_id));

    (uploadTasks || []).forEach((task) => {
      if (task.knowledgeBaseId !== selectedKbId) return;
      if (task.fileId && existingFileIds.has(task.fileId)) {
        return;
      }
      const key = task.folderId ?? null;
      const list = next.get(key) ?? [];
      list.push(task);
      next.set(key, list);
    });

    return next;
  }, [uploadTasks, selectedKbId, files]);

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

  const matchesFile = useCallback(
    (file: KnowledgeFile) =>
      `${file.file_name} ${file.description ?? ""} ${file.mime_type ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch),
    [normalizedSearch]
  );

  /** 命中的文件夹及其祖先链；null 表示不过滤 */
  const matchedFolderIds = useMemo(() => {
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
      if (!matchesFile(file)) return;
      let folderId = file.folder_id ?? null;
      while (folderId) {
        next.add(folderId);
        folderId = folderLookup.get(folderId)?.parent_folder_id ?? null;
      }
    });

    return next;
  }, [files, folders, matchesFile, normalizedSearch]);

  /** 按名称命中的知识库；命中后其内部内容整体保留，不再逐个过滤文件夹 */
  const nameMatchedKbIds = useMemo(() => {
    if (!normalizedSearch) return null;
    const next = new Set<string>();
    knowledgeBases.forEach((kb) => {
      if (
        `${kb.knowledge_base_name} ${kb.description ?? ""}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        next.add(kb.knowledge_base_id);
      }
    });
    return next;
  }, [knowledgeBases, normalizedSearch]);

  /** 选中知识库整体命中时，其文件夹/文件不参与过滤 */
  const selectedKbNameMatched = Boolean(
    selectedKbId && nameMatchedKbIds?.has(selectedKbId)
  );
  const folderFilter = selectedKbNameMatched ? null : matchedFolderIds;
  const fileFilterActive = Boolean(normalizedSearch) && !selectedKbNameMatched;

  /** 需要显示的知识库：自身命中、子孙命中，或其内部文件夹/文件命中 */
  const visibleKbIds = useMemo(() => {
    if (!normalizedSearch) return null;

    const lookup = new Map(
      knowledgeBases.map((kb) => [kb.knowledge_base_id, kb])
    );
    const next = new Set<string>();
    const addWithAncestors = (kbId: string) => {
      let cursor: string | null = kbId;
      while (cursor) {
        next.add(cursor);
        cursor = lookup.get(cursor)?.parent_knowledge_base_id ?? null;
      }
    };

    nameMatchedKbIds?.forEach((kbId) => addWithAncestors(kbId));

    const hitInsideSelectedKb =
      (matchedFolderIds && matchedFolderIds.size > 0) ||
      files.some((file) => !file.folder_id && matchesFile(file));
    if (selectedKbId && hitInsideSelectedKb) {
      addWithAncestors(selectedKbId);
    }

    return next;
  }, [
    files,
    knowledgeBases,
    matchedFolderIds,
    matchesFile,
    nameMatchedKbIds,
    normalizedSearch,
    selectedKbId,
  ]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !current[folderId],
    }));
  };

  const handleKbRowClick = (kbId: string) => {
    if (kbId !== selectedKbId) {
      // 切换知识库会触发文件夹/文件加载；展开状态由 selectedKbId 的 effect 兜底
      onSelectKb(kbId);
      return;
    }
    setExpandedKbs((current) => ({ ...current, [kbId]: !(current[kbId] ?? true) }));
  };

  const renderUploadingPlaceholder = (task: UploadTaskItem, depth: number) => {
    if (fileFilterActive && !task.fileName.toLowerCase().includes(normalizedSearch)) {
      return null;
    }

    const pct = Math.round(Math.max(0, Math.min(1, task.progress || 0)) * 100);

    return (
      <div
        key={`placeholder-${task.id}`}
        className="group relative mb-0.5 flex h-8 items-center gap-2 overflow-hidden rounded-md border border-dashed border-primary/30 bg-primary/[0.04] px-2 text-sm text-foreground/75 transition-all animate-in fade-in duration-200"
        style={{ paddingLeft: indentOf(depth) }}
      >
        {/* 占位行底部的动态轻量进度条 */}
        {task.status === "uploading" && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 bg-primary/10 transition-all duration-200"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        )}

        <div className="relative flex min-w-0 flex-1 items-center gap-2">
          <FileIcon fileName={task.fileName} className="h-5 w-5 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate font-normal text-foreground/80">
            {task.fileName}
          </span>
        </div>

        {/* 状态徽标与指示 */}
        <div className="relative flex shrink-0 items-center gap-1.5 text-[11px]">
          {task.status === "waiting" && (
            <span className="font-medium text-amber-600/90">排队中</span>
          )}
          {task.status === "uploading" && (
            <span className="flex items-center gap-1 font-medium text-primary">
              <UploadCloud className="h-3 w-3 animate-pulse" />
              {pct}%
            </span>
          )}
          {task.status === "indexing" && (
            <span className="flex items-center gap-1 font-medium text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              解析中
            </span>
          )}
          {task.status === "error" && (
            <span
              className="max-w-[70px] truncate font-medium text-red-500"
              title={task.errorMessage}
            >
              上传失败
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderFile = (file: KnowledgeFile, depth: number) => {
    if (fileFilterActive && !matchesFile(file)) {
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
        style={{ paddingLeft: indentOf(depth) }}
      >
        <FileIcon fileName={file.file_name} className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={file.file_name}>
          {file.file_name}
        </span>

        {isProcessing || isFailed ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 text-[11px] group-hover:hidden",
              isFailed ? "text-red-500" : "text-primary"
            )}
          >
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
    if (folderFilter && !folderFilter.has(folder.folder_id)) {
      return null;
    }

    const childFolders = childrenByParent.get(folder.folder_id) ?? [];
    const childFiles = filesByFolder.get(folder.folder_id) ?? [];
    const childTasks = tasksByFolder.get(folder.folder_id) ?? [];
    const isExpanded = normalizedSearch
      ? true
      : (expandedFolders[folder.folder_id] ?? false);
    const isDragOver = dragOverFolderId === folder.folder_id && !!draggingFileId;
    const isChatTarget = selectedFolderId === folder.folder_id;

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
            isChatTarget
              ? "bg-primary/10 text-foreground"
              : "text-foreground/80 hover:bg-gray-100",
            // 拖拽落点用描边区分，否则与「问答目标」的底色一模一样
            isDragOver && "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/50"
          )}
          style={{ paddingLeft: indentOf(depth) }}
        >
          <button
            type="button"
            onClick={() => toggleFolder(folder.folder_id)}
            className="flex min-w-0 flex-1 items-center gap-2"
            title={folder.folder_name}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
            )}
            <Folder className="h-4 w-4 shrink-0 text-muted/60" />
            <span className="min-w-0 flex-1 truncate text-left">{folder.folder_name}</span>
          </button>
          <div
            className={cn(
              "shrink-0 items-center gap-0.5",
              isChatTarget ? "flex" : "hidden group-hover:flex"
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectFolder(folder.folder_id);
              }}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded",
                isChatTarget ? "text-primary" : "text-muted hover:text-foreground"
              )}
              title="围绕此文件夹问答"
              aria-label="围绕此文件夹问答"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            {onUploadFile ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadFile(folder.folder_id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
                title="上传文件到此文件夹"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onCreateFolder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder(folder.folder_id);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
                title="在此文件夹下新建子文件夹"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onDeleteFolder && folder.is_default !== 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-red-300"
                title="删除文件夹"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        {isExpanded ? (
          <>
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childTasks.map((task) => renderUploadingPlaceholder(task, depth + 1))}
            {childFiles.map((file) => renderFile(file, depth + 1))}
          </>
        ) : null}
      </div>
    );
  };

  const renderKb = (kb: KnowledgeBaseNode, depth: number): ReactNode => {
    if (visibleKbIds && !visibleKbIds.has(kb.knowledge_base_id)) {
      return null;
    }

    const childKbs = kbChildrenByParent.get(kb.knowledge_base_id) ?? [];
    const isSelected = kb.knowledge_base_id === selectedKbId;
    // 问答锁定在该库、且没有进一步锁定到某个文件夹时，整库才是问答目标
    const isChatTarget = kb.knowledge_base_id === chatKbId && !selectedFolderId;
    const isExpanded = normalizedSearch
      ? true
      : (expandedKbs[kb.knowledge_base_id] ?? isSelected);
    // 文件夹与文件只在激活的知识库下渲染：其余知识库的目录数据尚未加载
    const rootFolders = isSelected ? (childrenByParent.get(null) ?? []) : [];
    const rootFiles = isSelected ? (filesByFolder.get(null) ?? []) : [];
    const rootTasks = isSelected ? (tasksByFolder.get(null) ?? []) : [];
    const isDragOver =
      isSelected && dragOverFolderId === kb.knowledge_base_id && !!draggingFileId;
    const hasContent =
      childKbs.length > 0 ||
      rootFolders.length > 0 ||
      rootFiles.length > 0 ||
      rootTasks.length > 0;

    return (
      <div key={kb.knowledge_base_id}>
        <div
          onDragOver={(event) => {
            if (!isSelected || !canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
            event.preventDefault();
            event.stopPropagation();
            setDragOverFolderId(kb.knowledge_base_id);
          }}
          onDragLeave={() => {
            if (dragOverFolderId === kb.knowledge_base_id) setDragOverFolderId(null);
          }}
          onDrop={(event) => {
            if (!isSelected || !canMoveFiles || !onMoveFileToFolder || !draggingFileId) return;
            event.preventDefault();
            event.stopPropagation();
            setDragOverFolderId(null);
            const file = files.find((item) => item.file_id === draggingFileId);
            setDraggingFileId(null);
            if (file) {
              onMoveFileToFolder(file, null);
            }
          }}
          className={cn(
            "group flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors",
            // 主色底＝问答目标，灰底＝当前浏览位置，两者可以不是同一个库
            isChatTarget
              ? "bg-primary/10 text-foreground"
              : isSelected
                ? "bg-gray-100 text-foreground"
                : "text-foreground/80 hover:bg-gray-100",
            isDragOver && "ring-1 ring-inset ring-primary/50"
          )}
          style={{ paddingLeft: indentOf(depth) }}
        >
          <button
            type="button"
            onClick={() => handleKbRowClick(kb.knowledge_base_id)}
            className="flex min-w-0 flex-1 items-center gap-2"
            title={kb.knowledge_base_name}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
            )}
            <Database
              className={cn(
                "h-4 w-4 shrink-0",
                isChatTarget ? "text-primary" : "text-muted/60"
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                (isChatTarget || isSelected) && "font-medium"
              )}
            >
              {kb.knowledge_base_name}
            </span>
          </button>

          {/* 窄面板里只留数字徽标，把宽度让给知识库名；问答目标行常驻按钮，徽标让位 */}
          {kb.fileCount > 0 && !isChatTarget ? (
            <span
              className="shrink-0 text-[11px] text-muted/40 group-hover:hidden"
              title={`${kb.fileCount} 个文件`}
            >
              {kb.fileCount}
            </span>
          ) : null}

          <div
            className={cn(
              "shrink-0 items-center gap-0.5",
              isChatTarget ? "flex" : "hidden group-hover:flex"
            )}
          >
            {onChatWithKb ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChatWithKb(kb);
                }}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded",
                  isChatTarget ? "text-primary" : "text-muted hover:text-foreground"
                )}
                title="围绕此知识库问答"
                aria-label="围绕此知识库问答"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {/* 上传 / 新建文件夹只作用于当前激活的知识库，避免落到别的库里 */}
            {isSelected && onUploadFile ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadFile(null);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
                title="上传文件到此知识库根目录"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {isSelected && onCreateFolder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder(null);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground"
                title="在此知识库下新建文件夹"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onDeleteKb ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteKb(kb);
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-red-300"
                title="删除知识库"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {isExpanded ? (
          <>
            {childKbs.map((child) => renderKb(child, depth + 1))}
            {rootFolders.map((folder) => renderFolder(folder, depth + 1))}
            {rootTasks.map((task) => renderUploadingPlaceholder(task, depth + 1))}
            {rootFiles.map((file) => renderFile(file, depth + 1))}
            {isSelected && !hasContent ? (
              <div
                className="py-2 text-xs text-muted/50"
                style={{ paddingLeft: indentOf(depth + 1) }}
              >
                暂无内容
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  const rootKbs = kbChildrenByParent.get(null) ?? [];
  const visibleRootKbs = rootKbs.filter(
    (kb) => !visibleKbIds || visibleKbIds.has(kb.knowledge_base_id)
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">知识库</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
            title="搜索知识库 / 文件夹 / 文件"
            aria-label="搜索"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          {onCreateKb ? (
            <button
              type="button"
              onClick={onCreateKb}
              className="flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] text-white transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-3 w-3" />
              新建
            </button>
          ) : null}
        </div>
      </div>

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

      {/* overflow-x-hidden：行的 paddingLeft 是内联像素，深层节点不能撑出横向滚动条 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {visibleRootKbs.map((kb) => renderKb(kb, 0))}

        {visibleRootKbs.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted/50">
            {rootKbs.length === 0 ? "还没有知识库，点右上角新建" : "没有匹配的内容"}
          </div>
        ) : null}
      </div>
    </div>
  );
};
