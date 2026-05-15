"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildKnowledgeIndex,
  createFolder,
  createKnowledgeBase,
  deleteFolder,
  deleteKnowledgeBase,
  emptyTrash,
  fetchFolderFiles,
  fetchFolders,
  fetchIndexProgress,
  fetchRootFiles,
  fetchKnowledgeBaseChildren,
  fetchKnowledgeBases,
  fetchTrashFolderChildren,
  fetchTrashFolderFiles,
  fetchTrashItems,
  moveFile,
  permanentlyDeleteTrashItem,
  restoreTrashItem,
  softDeleteFile,
  uploadKnowledgeFiles,
} from "@/lib/api/knowledge";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import { KnowledgeChatPanel } from "@/components/knowledge/KnowledgeChatPanel";
import { FolderTree } from "@/components/knowledge/FolderTree";
import { FileIcon } from "@/components/knowledge/FileIcon";
import {
  FolderInfo,
  KnowledgeBaseInfo,
  KnowledgeFile,
  TrashFolderChildItem,
  TrashFolderFileItem,
  TrashItem,
} from "@/lib/knowledge-types";
import { cacheKnowledgeFileView } from "@/lib/knowledge-viewer";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Loader2,
  LockKeyhole,
  LogIn,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

type ActiveView = "files" | "trash";
type ConfirmAction =
  | {
      kind: "knowledge-base";
      title: string;
      description: string;
      confirmLabel: string;
      confirmText: string;
      dangerNote?: string;
      onConfirm: () => Promise<void>;
    }
  | {
      kind: "danger";
      title: string;
      description: string;
      confirmLabel: string;
      dangerNote?: string;
      onConfirm: () => Promise<void>;
    };

interface KnowledgeMetric {
  fileCount: number;
  lastUpdated?: string;
}

interface UploadState {
  totalFiles: number;
  fileNames: string[];
  progress: number;
  phase: "uploading" | "indexing";
}

function buildMetrics(files: KnowledgeFile[]): KnowledgeMetric {
  const latest = files
    .map((file) => file.updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    fileCount: files.length,
    lastUpdated: latest ? formatDate(latest) : undefined,
  };
}

function mergeProgress(
  baseFiles: KnowledgeFile[],
  progressFiles: Array<{
    file_id: string;
    file_name: string;
    progress: number;
    status: "pending" | "processing" | "success" | "failed";
  }>
): KnowledgeFile[] {
  const progressMap = new Map(progressFiles.map((item) => [item.file_id, item]));

  return baseFiles.map((file) => {
    const progress = progressMap.get(file.file_id);
    if (!progress) return file;
    const normalizedStatus =
      progress.progress >= 1 && progress.status === "processing"
        ? "success"
        : progress.status;
    return {
      ...file,
      file_name: progress.file_name || file.file_name,
      index_status: normalizedStatus,
      progress: normalizedStatus === "success" ? 1 : progress.progress,
    };
  });
}

function isFileIndexing(file: KnowledgeFile): boolean {
  return file.index_status === "pending" || file.index_status === "processing";
}

function getAverageProgress(files: KnowledgeFile[]): number {
  if (files.length === 0) return 1;

  return files.reduce((sum, file) => sum + Math.max(0, Math.min(1, file.progress ?? 0)), 0) / files.length;
}

async function fetchKnowledgeBaseTree(): Promise<KnowledgeBaseInfo[]> {
  const roots = await fetchKnowledgeBases();
  const visited = new Set<string>();
  const queue = [...roots];
  const all = [...roots];

  roots.forEach((item) => visited.add(item.knowledge_base_id));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const children = await fetchKnowledgeBaseChildren(current.knowledge_base_id).catch(
      () => []
    );

    children.forEach((child) => {
      if (visited.has(child.knowledge_base_id)) return;
      visited.add(child.knowledge_base_id);
      all.push(child);
      queue.push(child);
    });
  }

  return all;
}

function ConfirmModal({
  action,
  busy,
  onCancel,
}: {
  action: ConfirmAction | null;
  busy: boolean;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");

  useEffect(() => {
    setInput("");
  }, [action]);

  if (!action) return null;

  const requiresTypedConfirm = action.kind === "knowledge-base";
  const canConfirm = requiresTypedConfirm
    ? input.trim() === action.confirmText
    : true;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg text-foreground">{action.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{action.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {action.dangerNote ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {action.dangerNote}
          </div>
        ) : null}

        {requiresTypedConfirm ? (
          <div className="mt-5">
            <div className="text-xs text-muted">
              请输入 <span className="font-medium text-foreground">{action.confirmText}</span>{" "}
              以确认删除。
            </div>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={action.confirmText}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => void action.onConfirm()}
            className="rounded-full bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-500/40"
          >
            {busy ? "处理中..." : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputPromptAction {
  title: string;
  placeholder: string;
  confirmLabel: string;
  onConfirm: (value: string) => Promise<void>;
}

function InputModal({
  action,
  busy,
  onCancel,
}: {
  action: InputPromptAction | null;
  busy: boolean;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    setValue("");
  }, [action]);

  if (!action) return null;

  const canConfirm = value.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">{action.title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={action.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canConfirm && !busy) {
              void action.onConfirm(value.trim());
            }
          }}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50 focus:border-primary focus:bg-white"
        />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => void action.onConfirm(value.trim())}
            className="rounded-full bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40"
          >
            {busy ? "处理中..." : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function KnowledgeGuestView() {
  const { openAuthModal } = useAuthModal();

  return (
    <div className="min-h-screen p-8 md:p-12">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-muted">
            <LockKeyhole className="h-3.5 w-3.5 text-primary-light" />
            登录后可创建私有知识库
          </div>

          <div className="mt-6 max-w-3xl">
            <h1 className="text-4xl font-light text-foreground md:text-5xl">
              把你的文档、制度与项目资料，整理成可持续追问的知识空间
            </h1>
            <p className="mt-4 text-base leading-7 text-muted">
              这里不是冷冰冰的文件仓库，而是你和资料之间的长期工作界面。上传后自动处理、按文件夹管理、围绕单篇文档继续追问，适合合同、会议纪要、方案库和 SOP 等高频知识场景。
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                openAuthModal({
                  title: "登录以创建你的专属知识库",
                  description:
                    "登录后你可以上传文档、保存文件夹结构，并把这些私有内容长期沉淀到你的个人工作区。",
                  nextPath: "/knowledge",
                  featureLabel: "创建我的知识库",
                })
              }
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              <LogIn className="h-4 w-4" />
              创建我的知识库
            </button>

            <button
              type="button"
              onClick={() =>
                openAuthModal({
                  title: "登录以上传文档并开始使用",
                  description:
                    "上传、文档处理和文档级问答都会消耗私有资源。登录后系统才能为你安全保存文件与后续问答记录。",
                  nextPath: "/knowledge",
                  featureLabel: "上传文档",
                })
              }
              className="rounded-2xl border border-gray-200 px-5 py-3 text-sm text-foreground transition hover:bg-gray-50"
            >
              上传文档并开始问答
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashItemRow({
  item,
  isExpanded,
  childFolders,
  childFiles,
  onToggleExpand,
  onRestore,
  onDelete,
}: {
  item: TrashItem;
  isExpanded: boolean;
  childFolders?: TrashFolderChildItem[];
  childFiles?: TrashFolderFileItem[];
  onToggleExpand: (folderId: string) => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const isFolder = item.item_type === "folder";

  return (
    <div>
      <div
        className="group flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
        style={{ paddingLeft: 10 }}
      >
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggleExpand(item.item_id)}
            className="flex shrink-0 items-center"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted" />
            )}
          </button>
        ) : null}
        {isFolder ? (
          <Folder className="h-4 w-4 shrink-0 text-muted/60" />
        ) : (
          <FileIcon fileName={item.item_name} className="h-5 w-5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{item.item_name}</span>

        <span className="shrink-0 text-[11px] text-muted/40 group-hover:hidden">
          {item.file_size ? formatBytes(item.file_size) : ""}
        </span>
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={onRestore}
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-primary"
            title="恢复"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-red-500"
            title="永久删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isFolder && isExpanded ? (
        <div>
          {!childFolders && !childFiles ? (
            <div className="px-3 py-2 text-xs text-muted/50" style={{ paddingLeft: 30 }}>
              加载中...
            </div>
          ) : (
            <>
              {childFolders?.map((folder) => (
                <div
                  key={folder.folder_id}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted"
                  style={{ paddingLeft: 30 }}
                >
                  <Folder className="h-4 w-4 shrink-0 text-muted/60" />
                  <span className="truncate">{folder.folder_name}</span>
                </div>
              ))}
              {childFiles?.map((file) => (
                <div
                  key={file.file_id}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted"
                  style={{ paddingLeft: 30 }}
                >
                  <FileIcon fileName={file.file_name} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{file.file_name}</span>
                  {file.file_size ? (
                    <span className="shrink-0 text-[11px] text-muted/40">{formatBytes(file.file_size)}</span>
                  ) : null}
                </div>
              ))}
              {childFolders?.length === 0 && childFiles?.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted/50" style={{ paddingLeft: 30 }}>
                  该文件夹内没有内容
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---- 左侧栏可拖拽分割条 ----
// 写入 localStorage 并在双击时回到 DEFAULT；min/max 是为了避免拖到无法操作。
const SPLIT_STORAGE_KEY = "knowledge-workspace-left-width";
/** 默认更宽，便于文件名与列表可读（仍可拖拽 / 双击分割条恢复此默认） */
const SPLIT_DEFAULT = 460;
const SPLIT_MIN = 260;
const SPLIT_MAX = 800;

function KnowledgeWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetFolderRef = useRef<string | null>(null);
  const [leftWidth, setLeftWidth] = useState<number>(SPLIT_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inputPrompt, setInputPrompt] = useState<InputPromptAction | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseInfo[]>([]);
  const [knowledgeMetrics, setKnowledgeMetrics] = useState<Record<string, KnowledgeMetric>>({});
  const [selectedKbId, setSelectedKbId] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("files");
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [expandedTrashFolders, setExpandedTrashFolders] = useState<Record<string, boolean>>({});
  const [trashFolderChildren, setTrashFolderChildren] = useState<Record<string, TrashFolderChildItem[]>>({});
  const [trashFolderFiles, setTrashFolderFiles] = useState<Record<string, TrashFolderFileItem[]>>({});

  const selectedKb = knowledgeBases.find(
    (kb) => kb.knowledge_base_id === selectedKbId
  );
  const selectedFolder = folders.find((folder) => folder.folder_id === selectedFolderId);
  const canMoveFiles = true;

  const visibleFiles = useMemo(() => {
    if (!selectedFolderId) return files;

    const folderIds = new Set<string>([selectedFolderId]);
    const queue = [selectedFolderId];

    while (queue.length > 0) {
      const current = queue.shift();
      folders.forEach((folder) => {
        if (folder.parent_folder_id === current && !folderIds.has(folder.folder_id)) {
          folderIds.add(folder.folder_id);
          queue.push(folder.folder_id);
        }
      });
    }

    return files.filter((file) => {
      if (!file.folder_id) return false;
      return folderIds.has(file.folder_id);
    });
  }, [files, folders, selectedFolderId]);

  const fileStats = useMemo(() => {
    const totalSize = visibleFiles.reduce(
      (sum, file) => sum + (file.file_size ?? 0),
      0
    );
    const indexedCount = visibleFiles.filter(
      (file) => file.index_status === "success"
    ).length;

    return {
      totalSize,
      indexedCount,
    };
  }, [visibleFiles]);

  const indexingFiles = useMemo(
    () => visibleFiles.filter(isFileIndexing),
    [visibleFiles]
  );

  const indexingSummary = useMemo(() => {
    const pendingCount = indexingFiles.filter(
      (file) => file.index_status === "pending"
    ).length;
    const processingCount = indexingFiles.filter(
      (file) => file.index_status === "processing"
    ).length;

    return {
      total: indexingFiles.length,
      pendingCount,
      processingCount,
      progress: getAverageProgress(indexingFiles),
    };
  }, [indexingFiles]);

  const chatDisabledReason = useMemo(() => {
    if (!selectedKbId) {
      return "先选择一个知识库，再围绕文件内容开始问答。";
    }

    if (activeView === "trash") {
      return "回收站内容不可直接问答，请先恢复文件或文件夹。";
    }

    if (uploadState?.phase === "uploading") {
      return `正在上传 ${uploadState.totalFiles} 个文件，上传完成并进入处理后才能开始问答。`;
    }

    if (uploadState?.phase === "indexing" && indexingSummary.total === 0) {
      return `文件已上传，正在初始化 ${uploadState.totalFiles} 个文件的索引，请稍等再开始问答。`;
    }

    if (indexingSummary.total > 0) {
      return `当前有 ${indexingSummary.total} 个文件仍在处理中，等进度结束后再开始问答，结果会更完整。`;
    }

    if (visibleFiles.length === 0) {
      return selectedFolder
        ? "当前文件夹下还没有可问答文件，请先上传资料。"
        : "当前知识库还没有可问答文件，请先上传资料。";
    }

    if (fileStats.indexedCount === 0) {
      return "当前范围内还没有处理完成的文件，请等待处理结束或重新上传失败文件。";
    }

    return null;
  }, [
    activeView,
    fileStats.indexedCount,
    indexingSummary.total,
    selectedFolder,
    selectedKbId,
    uploadState,
    visibleFiles.length,
  ]);

  const knowledgeBasesView = useMemo(() => {
    return knowledgeBases.map((kb) => ({
      ...kb,
      fileCount: knowledgeMetrics[kb.knowledge_base_id]?.fileCount ?? 0,
      lastUpdated: knowledgeMetrics[kb.knowledge_base_id]?.lastUpdated,
    }));
  }, [knowledgeBases, knowledgeMetrics]);

  const loadKnowledgeBasesData = async () => {
    try {
      const list = await fetchKnowledgeBaseTree();
      setKnowledgeBases(list);
      setSelectedKbId((current) =>
        list.some((kb) => kb.knowledge_base_id === current)
          ? current
          : list[0]?.knowledge_base_id ?? ""
      );
      setKnowledgeMetrics((current) =>
        Object.fromEntries(
          list.map((kb) => [
            kb.knowledge_base_id,
            current[kb.knowledge_base_id] ?? { fileCount: 0 },
          ])
        )
      );
      setNotice(null);
    } catch (error) {
      setKnowledgeBases([]);
      setKnowledgeMetrics({});
      setSelectedKbId("");
      setFolders([]);
      setFiles([]);
      setTrashItems([]);
      setNotice(
        error instanceof Error
          ? `加载知识库失败：${error.message}`
          : "加载知识库失败"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadKnowledgeBaseWorkspace = async (knowledgeBaseId: string) => {
    if (!knowledgeBaseId) return;

    try {
      setIsBusy("sync");
      setFolders([]);
      setFiles([]);
      setTrashItems([]);
      setExpandedTrashFolders({});
      setTrashFolderChildren({});
      setTrashFolderFiles({});

      const nextFolders = await fetchFolders(knowledgeBaseId);
      const [rootFiles, ...filesByFolder] = await Promise.all([
        fetchRootFiles(knowledgeBaseId),
        ...nextFolders.map((folder) => fetchFolderFiles(folder.folder_id)),
      ]);
      const flatFiles = [...rootFiles, ...filesByFolder.flat()].map((file) => ({
        ...file,
        knowledge_base_id: file.knowledge_base_id || knowledgeBaseId,
      }));
      const progress = flatFiles.length
        ? await fetchIndexProgress(flatFiles.map((file) => file.file_id)).catch(
            () => []
          )
        : [];
      const nextFiles = mergeProgress(flatFiles, progress);
      const nextTrash = await fetchTrashItems(knowledgeBaseId);

      setFolders(nextFolders);
      setFiles(nextFiles);
      setTrashItems(nextTrash);
      setKnowledgeMetrics((prev) => ({
        ...prev,
        [knowledgeBaseId]: buildMetrics(nextFiles),
      }));
      setNotice(null);
    } catch (error) {
      setFolders([]);
      setFiles([]);
      setTrashItems([]);
      setKnowledgeMetrics((prev) => ({
        ...prev,
        [knowledgeBaseId]: { fileCount: 0 },
      }));
      setNotice(
        error instanceof Error
          ? `同步知识库失败：${error.message}`
          : "同步知识库失败"
      );
    } finally {
      setIsBusy(null);
    }
  };

  useEffect(() => {
    void loadKnowledgeBasesData();
  }, []);

  // 启动时从 localStorage 还原左侧栏宽度（SSR 阶段保留默认值，避免 hydration warning）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
      if (!raw) return;
      const value = Number(raw);
      if (Number.isFinite(value)) {
        setLeftWidth(Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, value)));
      }
    } catch {
      // localStorage 不可用（隐私模式 / 配额满）→ 用默认值即可
    }
  }, []);

  // 拖拽期间监听全局 mousemove / mouseup；同步给 body 加 col-resize 光标 + 禁选中。
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => {
      const next = Math.max(
        SPLIT_MIN,
        Math.min(SPLIT_MAX, event.clientX),
      );
      setLeftWidth(next);
    };
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [dragging]);

  // 宽度变化即时持久化（debounce 没必要，写入很快）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SPLIT_STORAGE_KEY, String(leftWidth));
    } catch {
      // ignore quota / private-mode 错误
    }
  }, [leftWidth]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!selectedKbId) {
      setSelectedFolderId(null);
      setUploadState(null);
      setFolders([]);
      setFiles([]);
      setTrashItems([]);
      return;
    }

    setUploadState(null);
    setSelectedFolderId(null);
    void loadKnowledgeBaseWorkspace(selectedKbId);
  }, [selectedKbId]);

  useEffect(() => {
    if (!selectedKbId) return;

    const progressIds = files.filter(isFileIndexing).map((file) => file.file_id);
    if (progressIds.length === 0) return;

    const timer = window.setInterval(async () => {
      try {
        const progress = await fetchIndexProgress(progressIds);
        setFiles((current) => {
          const nextFiles = mergeProgress(current, progress);
          setKnowledgeMetrics((prev) => ({
            ...prev,
            [selectedKbId]: buildMetrics(nextFiles),
          }));
          return nextFiles;
        });
      } catch {
        // Ignore transient polling failures.
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [files, selectedKbId]);

  useEffect(() => {
    if (!uploadState || uploadState.phase !== "indexing") return;
    if (files.length === 0) return;
    if (files.some(isFileIndexing)) return;
    setUploadState(null);
  }, [files, uploadState]);

  const handleUploadClick = (targetFolderId: string | null = null) => {
    if (!selectedKbId) return;
    uploadTargetFolderRef.current = targetFolderId;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0 || !selectedKbId) return;

    const targetFolderId = uploadTargetFolderRef.current;
    uploadTargetFolderRef.current = null;

    try {
      setIsBusy("upload");
      setUploadState({
        totalFiles: fileList.length,
        fileNames: fileList.map((file) => file.name),
        progress: 0,
        phase: "uploading",
      });
      const uploaded = await uploadKnowledgeFiles({
        files: fileList,
        knowledge_base_id: selectedKbId,
        folder_id: targetFolderId,
        onUploadProgress: (progress) => {
          setUploadState((current) =>
            current
              ? {
                  ...current,
                  progress,
                  phase: "uploading",
                }
              : current
          );
        },
      });

      if (uploaded.length > 0) {
        setUploadState({
          totalFiles: uploaded.length,
          fileNames: uploaded.map((file) => file.file_name),
          progress: 1,
          phase: "indexing",
        });
        await buildKnowledgeIndex({
          knowledge_base_id: selectedKbId,
          file_ids: uploaded.map((file) => file.file_id),
        });
      } else {
        setUploadState(null);
      }

      await loadKnowledgeBaseWorkspace(selectedKbId);
      setNotice(`已上传 ${uploaded.length} 个文件，系统正在处理。`);
    } catch (error) {
      setUploadState(null);
      setNotice(
        error instanceof Error ? `上传失败：${error.message}` : "上传失败"
      );
    } finally {
      setIsBusy(null);
      event.target.value = "";
    }
  };

  const handleCreateKnowledgeBase = (parentKnowledgeBaseId?: string | null) => {
    setInputPrompt({
      title: parentKnowledgeBaseId ? "新建子知识库" : "新建知识库",
      placeholder: "请输入知识库名称",
      confirmLabel: "创建",
      onConfirm: async (name) => {
        try {
          setIsBusy("kb");
          const item = await createKnowledgeBase({
            knowledge_base_name: name,
            parent_knowledge_base_id: parentKnowledgeBaseId ?? null,
          });
          await loadKnowledgeBasesData();
          setSelectedKbId(item.knowledge_base_id);
          setActiveView("files");
          setNotice(parentKnowledgeBaseId ? "子知识库已创建。" : "知识库已创建。");
        } catch (error) {
          setNotice(
            error instanceof Error ? `创建知识库失败：${error.message}` : "创建知识库失败"
          );
        } finally {
          setIsBusy(null);
          setInputPrompt(null);
        }
      },
    });
  };

  const handleCreateFolder = (parentFolderId: string | null = null) => {
    if (!selectedKbId) return;

    setInputPrompt({
      title: "新建文件夹",
      placeholder: "请输入文件夹名称",
      confirmLabel: "创建",
      onConfirm: async (name) => {
        try {
          setIsBusy("folder");
          await createFolder({
            knowledge_base_id: selectedKbId,
            folder_name: name,
            parent_folder_id: parentFolderId,
          });
          await loadKnowledgeBaseWorkspace(selectedKbId);
          setNotice("文件夹已创建。");
        } catch (error) {
          setNotice(
            error instanceof Error ? `创建文件夹失败：${error.message}` : "创建文件夹失败"
          );
        } finally {
          setIsBusy(null);
          setInputPrompt(null);
        }
      },
    });
  };

  const handleOpenFile = (file: KnowledgeFile) => {
    cacheKnowledgeFileView({
      file,
      knowledgeBaseName: selectedKb?.knowledge_base_name,
    });
    window.open(
      `/knowledge/file/${encodeURIComponent(file.file_id)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleRetryFile = async (file: KnowledgeFile) => {
    if (!selectedKbId) return;
    try {
      setIsBusy("retry");
      await buildKnowledgeIndex({
        knowledge_base_id: selectedKbId,
        file_ids: [file.file_id],
      });
      setFiles((current) =>
        current.map((f) =>
          f.file_id === file.file_id
            ? { ...f, index_status: "pending" as const, progress: 0 }
            : f
        )
      );
      setNotice(`文件「${file.file_name}」已重新提交处理。`);
    } catch (error) {
      setNotice(
        error instanceof Error ? `重试失败：${error.message}` : "重试失败"
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleDeleteFile = async (file: KnowledgeFile) => {
    if (!selectedKbId) return;

    const isFailed = file.index_status === "failed";

    if (isFailed) {
      try {
        setIsBusy("delete-file");
        await softDeleteFile(file.file_id);
        await permanentlyDeleteTrashItem({
          item_type: "file",
          item_id: file.file_id,
          item_name: file.file_name,
          knowledge_base_id: file.knowledge_base_id ?? selectedKbId,
        });
        await loadKnowledgeBaseWorkspace(selectedKbId);
      } catch (error) {
        setNotice(
          error instanceof Error ? `删除失败：${error.message}` : "删除失败"
        );
      } finally {
        setIsBusy(null);
      }
      return;
    }

    setConfirmAction({
      kind: "danger",
      title: `删除文件「${file.file_name}」`,
      description: "文件会被移入回收站，你可以稍后恢复。",
      confirmLabel: "移入回收站",
      onConfirm: async () => {
        try {
          setIsBusy("delete-file");
          await softDeleteFile(file.file_id);
          await loadKnowledgeBaseWorkspace(selectedKbId);
          setNotice("文件已移入回收站，可在回收站恢复。");
        } catch (error) {
          setNotice(
            error instanceof Error ? `删除失败：${error.message}` : "删除失败"
          );
        } finally {
          setIsBusy(null);
          setConfirmAction(null);
        }
      },
    });
  };

  const handleDeleteFolder = async (folder: FolderInfo) => {
    if (!selectedKbId) return;

    const childFolders = folders.filter((f) => f.parent_folder_id === folder.folder_id);
    const childFiles = files.filter((f) => f.folder_id === folder.folder_id);
    const isEmpty = childFolders.length === 0 && childFiles.length === 0;

    if (isEmpty) {
      try {
        setIsBusy("delete-folder");
        await deleteFolder(folder.folder_id);
        await loadKnowledgeBaseWorkspace(selectedKbId);
        if (selectedFolderId === folder.folder_id) {
          setSelectedFolderId(null);
        }
      } catch (error) {
        setNotice(
          error instanceof Error ? `删除文件夹失败：${error.message}` : "删除文件夹失败"
        );
      } finally {
        setIsBusy(null);
      }
      return;
    }

    setConfirmAction({
      kind: "danger",
      title: `删除文件夹「${folder.folder_name}」`,
      description:
        "该文件夹及其子文件夹中的文件会一起移入回收站。",
      confirmLabel: "移入回收站",
      onConfirm: async () => {
        try {
          setIsBusy("delete-folder");
          const result = await deleteFolder(folder.folder_id);
          await loadKnowledgeBaseWorkspace(selectedKbId);
          if (selectedFolderId === folder.folder_id) {
            setSelectedFolderId(null);
          }
          setNotice(
            `文件夹已移入回收站，共处理 ${result.deleted_folder_count} 个文件夹、${result.deleted_file_count} 个文件。`
          );
        } catch (error) {
          setNotice(
            error instanceof Error ? `删除文件夹失败：${error.message}` : "删除文件夹失败"
          );
        } finally {
          setIsBusy(null);
          setConfirmAction(null);
        }
      },
    });
  };

  const handleDeleteKnowledgeBase = (kb: KnowledgeBaseInfo) => {
    const collectDescendantIds = (parentId: string): string[] => {
      const children = knowledgeBases.filter(
        (item) => item.parent_knowledge_base_id === parentId
      );
      return children.flatMap((child) => [
        child.knowledge_base_id,
        ...collectDescendantIds(child.knowledge_base_id),
      ]);
    };
    const descendantIds = collectDescendantIds(kb.knowledge_base_id);
    const allAffectedIds = new Set([kb.knowledge_base_id, ...descendantIds]);

    const description =
      descendantIds.length > 0
        ? `此操作不可撤销，将同时删除 ${descendantIds.length} 个子知识库。请确保所有知识库及回收站内已无文件，否则无法删除。`
        : "此操作不可撤销。请确保知识库及回收站内已无文件，否则无法删除。";

    setConfirmAction({
      kind: "knowledge-base",
      title: `删除知识库「${kb.knowledge_base_name}」`,
      description,
      confirmLabel: "删除知识库",
      confirmText: kb.knowledge_base_name,
      dangerNote:
        "删除方式与 GitHub 删除仓库一致，需要手动输入知识库名称确认。",
      onConfirm: async () => {
        try {
          setIsBusy("delete-kb");
          await deleteKnowledgeBase(kb.knowledge_base_id);
          await loadKnowledgeBasesData();
          if (allAffectedIds.has(selectedKbId)) {
            setSelectedKbId("");
            setFolders([]);
            setFiles([]);
          }
          setActiveView("files");
          setNotice("知识库已删除。");
        } catch (error) {
          setNotice(
            error instanceof Error
              ? `删除知识库失败：${error.message}`
              : "删除知识库失败"
          );
        } finally {
          setIsBusy(null);
          setConfirmAction(null);
        }
      },
    });
  };

  const handleRestoreTrash = async (item: TrashItem) => {
    if (!selectedKbId) return;

    try {
      setIsBusy("restore");
      await restoreTrashItem(item);
      setNotice(`已恢复「${item.item_name}」。`);
      await loadKnowledgeBaseWorkspace(selectedKbId);
    } catch (error) {
      setNotice(
        error instanceof Error ? `恢复失败：${error.message}` : "恢复失败"
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleDeleteTrashItem = (item: TrashItem) => {
    if (!selectedKbId) return;

    setConfirmAction({
      kind: "danger",
      title: `彻底删除「${item.item_name}」`,
      description: "该内容会从回收站永久移除，之后无法恢复。",
      confirmLabel: "永久删除",
      dangerNote: "请确认这个文件或文件夹已经不再需要。",
      onConfirm: async () => {
        try {
          setIsBusy("delete-trash-item");
          await permanentlyDeleteTrashItem(item);
          await loadKnowledgeBaseWorkspace(selectedKbId);
          setNotice(`已永久删除「${item.item_name}」。`);
        } catch (error) {
          setNotice(
            error instanceof Error ? `永久删除失败：${error.message}` : "永久删除失败"
          );
        } finally {
          setIsBusy(null);
          setConfirmAction(null);
        }
      },
    });
  };

  const handleEmptyTrash = () => {
    if (!selectedKbId) return;

    setConfirmAction({
      kind: "danger",
      title: "清空回收站",
      description: "回收站中的所有内容都会被永久删除，之后无法恢复。",
      confirmLabel: "清空回收站",
      dangerNote: "建议确认没有需要恢复的文件后再执行。",
      onConfirm: async () => {
        try {
          setIsBusy("empty-trash");
          await emptyTrash();
          await loadKnowledgeBaseWorkspace(selectedKbId);
          setNotice("回收站已清空。");
        } catch (error) {
          setNotice(
            error instanceof Error ? `清空回收站失败：${error.message}` : "清空回收站失败"
          );
        } finally {
          setIsBusy(null);
          setConfirmAction(null);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.15),transparent_35%),#111314] text-sm text-muted">
        正在加载知识库工作台...
      </div>
    );
  }

  return (
    <>
      <div
        className="grid h-screen grid-cols-1 bg-white xl:grid-cols-[var(--knowledge-left-width)_6px_minmax(0,1fr)]"
        style={
          {
            "--knowledge-left-width": `${leftWidth}px`,
          } as React.CSSProperties
        }
      >
        <div className="flex min-w-0 overflow-hidden">
          <KnowledgeList
            knowledgeBases={knowledgeBasesView}
            selectedId={selectedKbId}
            onSelect={(id) => {
              setSelectedKbId(id);
              setSelectedFolderId(null);
              setSearchTerm("");
              setActiveView("files");
            }}
            onCreate={() => void handleCreateKnowledgeBase(null)}
            onCreateChild={(kb) => void handleCreateKnowledgeBase(kb.knowledge_base_id)}
            onDelete={(kb) => handleDeleteKnowledgeBase(kb)}
          />

          <div className="min-w-0 flex-1 overflow-hidden">
            {!selectedKbId ? (
              <div className="flex h-full items-center justify-center bg-white text-sm text-muted">
                选择一个知识库
              </div>
            ) : (
              <FolderTree
                knowledgeBase={selectedKb}
                folders={folders}
                files={files}
                selectedFolderId={selectedFolderId}
                searchTerm={searchTerm}
                canMoveFiles={canMoveFiles}
                activeView={activeView}
                onSelectFolder={(id) => {
                  setSelectedFolderId(id);
                }}
                onOpenFile={handleOpenFile}
                onCreateFolder={handleCreateFolder}
                onUploadFile={handleUploadClick}
                onDeleteFolder={handleDeleteFolder}
                onDeleteFile={handleDeleteFile}
                onRetryFile={handleRetryFile}
                onSearchChange={setSearchTerm}
                onMoveFileToFolder={async (file, targetFolderId) => {
                  try {
                    setIsBusy("move");
                    await moveFile(file.file_id, targetFolderId);
                    await loadKnowledgeBaseWorkspace(selectedKbId);
                    setNotice(`文件「${file.file_name}」已移动。`);
                  } catch (error) {
                    setNotice(
                      error instanceof Error ? `移动失败：${error.message}` : "移动失败"
                    );
                  } finally {
                    setIsBusy(null);
                  }
                }}
                onSelectTrash={() => setActiveView("trash")}
                trashContent={
                  <>
                    <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveView("files")}
                          className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          返回
                        </button>
                        <span className="text-xs font-medium text-foreground/70">回收站</span>
                      </div>
                      <button
                        onClick={handleEmptyTrash}
                        disabled={trashItems.length === 0}
                        className="text-xs text-red-500 transition-colors hover:text-red-600 disabled:opacity-40"
                      >
                        清空
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      <div>
                        {trashItems.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-muted/50">暂无内容</div>
                        ) : (
                          trashItems.map((item) => (
                            <TrashItemRow
                              key={item.item_id}
                              item={item}
                              isExpanded={expandedTrashFolders[item.item_id] ?? false}
                              childFolders={trashFolderChildren[item.item_id]}
                              childFiles={trashFolderFiles[item.item_id]}
                              onToggleExpand={async (folderId) => {
                                const wasExpanded = expandedTrashFolders[folderId];
                                setExpandedTrashFolders((prev) => ({
                                  ...prev,
                                  [folderId]: !wasExpanded,
                                }));
                                if (!wasExpanded && !trashFolderChildren[folderId]) {
                                  try {
                                    const [children, filesData] = await Promise.all([
                                      fetchTrashFolderChildren(folderId),
                                      fetchTrashFolderFiles(folderId),
                                    ]);
                                    setTrashFolderChildren((prev) => ({ ...prev, [folderId]: children }));
                                    setTrashFolderFiles((prev) => ({ ...prev, [folderId]: filesData }));
                                  } catch {
                                    setNotice("加载回收站文件夹内容失败。");
                                  }
                                }
                              }}
                              onRestore={() => void handleRestoreTrash(item)}
                              onDelete={() => handleDeleteTrashItem(item)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </>
                }
              />
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* 可拖拽分割条：仅在 xl 及以上展示。
            - 单击拖拽即可调整左右宽度（min 240 / max 720 / default 360）
            - 双击可一键回到默认值
            - 宽度记到 localStorage，下次进入保持。
            div 本身留 6px 宽度给鼠标更容易抓到，里面再画一根 1.5px 视觉细线。 */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整左侧宽度"
          onMouseDown={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => setLeftWidth(SPLIT_DEFAULT)}
          className={cn(
            "group hidden h-full w-full cursor-col-resize items-center justify-center xl:flex",
            dragging && "bg-primary/10"
          )}
          title="拖动调整宽度（双击恢复默认）"
        >
          <div
            className={cn(
              "h-full w-px transition-colors",
              dragging
                ? "bg-primary/60"
                : "bg-gray-200 group-hover:bg-primary/40"
            )}
          />
        </div>

        <div className="flex min-h-0 min-w-0 overflow-hidden p-4">
          <KnowledgeChatPanel
            knowledgeBaseId={selectedKbId || null}
            knowledgeBaseName={selectedKb?.knowledge_base_name}
            selectedFolderName={selectedFolder?.folder_name ?? null}
            disabled={Boolean(chatDisabledReason)}
            disabledReason={chatDisabledReason ?? undefined}
            enabled
            className="h-full w-full"
          />
        </div>
      </div>

      <ConfirmModal
        action={confirmAction}
        busy={Boolean(isBusy && confirmAction)}
        onCancel={() => {
          if (isBusy) return;
          setConfirmAction(null);
        }}
      />
      <InputModal
        action={inputPrompt}
        busy={Boolean(isBusy)}
        onCancel={() => {
          if (isBusy) return;
          setInputPrompt(null);
        }}
      />

      {isBusy ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-foreground">
              {isBusy === "delete-file" && "正在删除文件…"}
              {isBusy === "delete-folder" && "正在删除文件夹…"}
              {isBusy === "delete-kb" && "正在删除知识库…"}
              {isBusy === "delete-trash-item" && "正在永久删除，清理关联数据…"}
              {isBusy === "empty-trash" && "正在清空回收站，清理关联数据…"}
              {!["delete-file", "delete-folder", "delete-kb", "delete-trash-item", "empty-trash"].includes(isBusy) && "处理中…"}
            </span>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm",
              notice.includes("失败") || notice.includes("错误")
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            )}
          >
            {notice.includes("失败") || notice.includes("错误") ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="ml-2 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function KnowledgePage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <KnowledgeGuestView />;
  }

  return <KnowledgeWorkspace />;
}
