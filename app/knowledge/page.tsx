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
  ChevronDown,
  ChevronRight,
  FileText,
  FileUp,
  Folder,
  LockKeyhole,
  LogIn,
  RefreshCw,
  Sparkles,
  Trash2,
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
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#131617] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {action.dangerNote ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
              className="mt-3 w-full rounded-2xl border border-white/10 bg-dark-card px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-foreground transition-colors hover:border-primary"
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

function KnowledgeGuestView() {
  const { openAuthModal } = useAuthModal();

  return (
    <div className="min-h-screen p-8 md:p-12">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.14),transparent_35%),#111415] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
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
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:-translate-y-0.5"
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
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-foreground transition hover:bg-white/5"
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
    <div className="rounded-[24px] border border-white/5 bg-dark-card">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isFolder ? (
            <button
              type="button"
              onClick={() => onToggleExpand(item.item_id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/10 hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
            {isFolder ? (
              <Folder className="h-4 w-4 text-foreground" />
            ) : (
              <FileText className="h-4 w-4 text-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground">{item.item_name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>{isFolder ? "文件夹" : "文件"}</span>
              {item.full_path ? <span>{item.full_path}</span> : null}
              {item.file_size ? <span>{formatBytes(item.file_size)}</span> : null}
              {item.mime_type ? <span>{item.mime_type}</span> : null}
              {item.deleted_at ? (
                <span>删除于 {formatDate(item.deleted_at)}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRestore}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-foreground transition-colors hover:border-primary"
          >
            恢复
          </button>
          <button
            onClick={onDelete}
            className="rounded-full border border-red-500/20 px-4 py-2 text-xs text-red-200 transition-colors hover:border-red-500/40"
          >
            永久删除
          </button>
        </div>
      </div>

      {isFolder && isExpanded ? (
        <div className="border-t border-white/5 px-5 py-3">
          {!childFolders && !childFiles ? (
            <div className="py-2 text-xs text-muted">加载中...</div>
          ) : (
            <div className="space-y-1">
              {childFolders?.map((folder) => (
                <div
                  key={folder.folder_id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted"
                >
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{folder.folder_name}</span>
                  <span className="ml-auto text-[11px]">{folder.full_path}</span>
                </div>
              ))}
              {childFiles?.map((file) => (
                <div
                  key={file.file_id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{file.file_name}</span>
                  {file.file_size ? (
                    <span className="ml-auto text-[11px]">{formatBytes(file.file_size)}</span>
                  ) : null}
                </div>
              ))}
              {childFolders?.length === 0 && childFiles?.length === 0 ? (
                <div className="py-2 text-xs text-muted">该文件夹内没有内容</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      const filesByFolder = await Promise.all(
        nextFolders.map((folder) => fetchFolderFiles(folder.folder_id))
      );
      const flatFiles = filesByFolder.flat().map((file) => ({
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

  const handleUploadClick = () => {
    if (!selectedKbId) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0 || !selectedKbId) return;

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
        folder_id: selectedFolderId,
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

  const handleCreateKnowledgeBase = async (parentKnowledgeBaseId?: string | null) => {
    const name = window.prompt(
      parentKnowledgeBaseId ? "输入子知识库名称" : "输入新知识库名称"
    );
    if (!name?.trim()) return;

    try {
      setIsBusy("kb");
      const item = await createKnowledgeBase({
        knowledge_base_name: name.trim(),
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
    }
  };

  const handleCreateFolder = async () => {
    if (!selectedKbId) return;

    const name = window.prompt("输入文件夹名称");
    if (!name?.trim()) return;

    try {
      setIsBusy("folder");
      await createFolder({
        knowledge_base_id: selectedKbId,
        folder_name: name.trim(),
        parent_folder_id: selectedFolderId,
      });
      await loadKnowledgeBaseWorkspace(selectedKbId);
      setNotice("文件夹已创建。");
    } catch (error) {
      setNotice(
        error instanceof Error ? `创建文件夹失败：${error.message}` : "创建文件夹失败"
      );
    } finally {
      setIsBusy(null);
    }
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

  const handleDeleteFile = (file: KnowledgeFile) => {
    if (!selectedKbId) return;

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
          setConfirmAction(null);
        } catch (error) {
          setNotice(
            error instanceof Error ? `删除失败：${error.message}` : "删除失败"
          );
        } finally {
          setIsBusy(null);
        }
      },
    });
  };

  const handleDeleteFolder = (folder: FolderInfo) => {
    if (!selectedKbId) return;

    setConfirmAction({
      kind: "danger",
      title: `删除文件夹「${folder.folder_name}」`,
      description:
        "该文件夹及其子文件夹中的文件会一起处理。有文件时会移入回收站；空文件夹会被直接删除。",
      confirmLabel: "删除文件夹",
      onConfirm: async () => {
        try {
          setIsBusy("delete-folder");
          const result = await deleteFolder(folder.folder_id);
          await loadKnowledgeBaseWorkspace(selectedKbId);
          if (selectedFolderId === folder.folder_id) {
            setSelectedFolderId(null);
          }
          setNotice(
            result.deleted_file_count > 0
              ? `文件夹已移入回收站，共处理 ${result.deleted_folder_count} 个文件夹、${result.deleted_file_count} 个文件。`
              : "空文件夹已直接删除，不会进入回收站。"
          );
          setConfirmAction(null);
        } catch (error) {
          setNotice(
            error instanceof Error ? `删除文件夹失败：${error.message}` : "删除文件夹失败"
          );
        } finally {
          setIsBusy(null);
        }
      },
    });
  };

  const handleDeleteKnowledgeBase = (kb: KnowledgeBaseInfo) => {
    setConfirmAction({
      kind: "knowledge-base",
      title: `删除知识库「${kb.knowledge_base_name}」`,
      description:
        "此操作不可撤销。请确保知识库和回收站内已经没有文件，否则后端会拒绝删除。",
      confirmLabel: "删除知识库",
      confirmText: kb.knowledge_base_name,
      dangerNote:
        "删除方式与 GitHub 删除仓库一致，需要手动输入知识库名称确认。",
      onConfirm: async () => {
        try {
          setIsBusy("delete-kb");
          await deleteKnowledgeBase(kb.knowledge_base_id);
          await loadKnowledgeBasesData();
          setActiveView("files");
          setNotice("知识库已删除。");
          setConfirmAction(null);
        } catch (error) {
          setNotice(
            error instanceof Error
              ? `删除知识库失败：${error.message}`
              : "删除知识库失败"
          );
        } finally {
          setIsBusy(null);
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
          setConfirmAction(null);
        } catch (error) {
          setNotice(
            error instanceof Error ? `永久删除失败：${error.message}` : "永久删除失败"
          );
        } finally {
          setIsBusy(null);
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
          setConfirmAction(null);
        } catch (error) {
          setNotice(
            error instanceof Error ? `清空回收站失败：${error.message}` : "清空回收站失败"
          );
        } finally {
          setIsBusy(null);
        }
      },
    });
  };

  const chatContext = useMemo(() => {
    if (selectedFolder) {
      return {
        title: "文件夹问答",
        subtitle: `当前围绕文件夹「${selectedFolder.folder_name}」及其下属文件展开问答。`,
        contextName: selectedFolder.folder_name,
        prompts: [
          "总结这个文件夹下的资料重点",
          "梳理这个文件夹里的主题结构",
          "指出这个文件夹资料里的风险和缺口",
        ],
        placeholder: "直接针对当前文件夹提问...",
      };
    }

    return {
      title: "知识库问答",
      subtitle: selectedKb
        ? `当前围绕「${selectedKb.knowledge_base_name}」下的所有文件展开问答。`
        : "选择一个知识库后，这里会自动切换到对应的问答上下文。",
      contextName: selectedKb?.knowledge_base_name || "知识库工作台",
      prompts: [
        "总结当前知识库里最值得先看的内容",
        "帮我梳理这个知识库适合怎么提问",
        "从当前资料中提炼重点和风险",
      ],
      placeholder: "直接向当前知识库提问...",
    };
  }, [selectedFolder, selectedKb]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.15),transparent_35%),#111314] text-sm text-muted">
        正在加载知识库工作台...
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.12),transparent_28%),linear-gradient(180deg,#121516_0%,#0f1112_100%)]">
        <KnowledgeList
          knowledgeBases={knowledgeBasesView}
          selectedId={selectedKbId}
          activeView={activeView}
          onSelect={(id) => {
            setSelectedKbId(id);
            setSelectedFolderId(null);
            setSearchTerm("");
            setActiveView("files");
          }}
          onSelectTrash={() => setActiveView("trash")}
          onCreate={() => void handleCreateKnowledgeBase(null)}
          onCreateChild={(kb) => void handleCreateKnowledgeBase(kb.knowledge_base_id)}
          onDelete={(kb) => handleDeleteKnowledgeBase(kb)}
        />

        <main className="mr-auto grid w-full max-w-[1520px] flex-1 grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(320px,1.12fr)_minmax(360px,0.82fr)] 2xl:grid-cols-[minmax(340px,1.18fr)_minmax(380px,0.86fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="rounded-[28px] border border-white/5 bg-[#141718] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted">
                    <Sparkles className="h-3.5 w-3.5 text-primary-light" />
                    Knowledge Workspace
                  </div>
                  <h1 className="text-2xl text-foreground">
                    {activeView === "trash"
                      ? "回收站"
                      : selectedKb?.knowledge_base_name || "暂无知识库"}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>{visibleFiles.length} 个相关文件</span>
                    <span>{fileStats.indexedCount} 个可提问</span>
                    <span>{formatBytes(fileStats.totalSize)}</span>
                    {selectedFolder ? <span>目录：{selectedFolder.folder_name}</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void loadKnowledgeBaseWorkspace(selectedKbId)}
                    disabled={!selectedKbId}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-4 w-4", isBusy === "sync" && "animate-spin")} />
                    同步
                  </button>
                  <button
                    onClick={handleUploadClick}
                    disabled={!selectedKbId || activeView === "trash"}
                    className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-black transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileUp className="h-4 w-4" />
                    上传文件
                  </button>
                  {activeView === "trash" ? (
                    <button
                      onClick={handleEmptyTrash}
                      disabled={!selectedKbId || trashItems.length === 0}
                      className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200 transition-colors hover:border-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      清空回收站
                    </button>
                  ) : null}
                </div>
              </div>

              {notice ? (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
                  {notice}
                </div>
              ) : null}

              {activeView === "files" &&
              selectedKbId &&
              ((uploadState?.phase === "uploading" ||
                (uploadState?.phase === "indexing" && indexingSummary.total === 0)) ||
                indexingSummary.total > 0) ? (
                <div className="mt-4 rounded-[24px] border border-white/10 bg-dark-card/80 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-foreground">
                        {uploadState?.phase === "uploading"
                          ? `正在上传 ${uploadState.totalFiles} 个文件`
                          : uploadState?.phase === "indexing" && indexingSummary.total === 0
                            ? `正在初始化 ${uploadState.totalFiles} 个文件的索引`
                            : `正在处理 ${indexingSummary.total || uploadState?.totalFiles || 0} 个文件`}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted">
                        {uploadState?.phase === "uploading"
                          ? `${Math.round(uploadState.progress * 100)}% · 上传完成后会继续构建索引，索引结束后才能问答。`
                          : uploadState?.phase === "indexing" && indexingSummary.total === 0
                            ? "文件已上传成功，正在提交索引任务。"
                            : `待处理 ${indexingSummary.pendingCount} 个，处理中 ${indexingSummary.processingCount} 个。`}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-muted">
                      {uploadState?.phase === "uploading"
                        ? "上传中"
                        : "索引处理中"}
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-black/20">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.round(
                          (uploadState?.phase === "uploading"
                            ? uploadState.progress
                            : uploadState?.phase === "indexing" && indexingSummary.total === 0
                              ? 0.08
                            : indexingSummary.progress) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  {uploadState?.fileNames?.length ? (
                    <div className="mt-3 text-xs text-muted">
                      最近操作：{uploadState.fileNames.slice(0, 2).join("、")}
                      {uploadState.fileNames.length > 2
                        ? ` 等 ${uploadState.fileNames.length} 个文件`
                        : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeView === "files" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="搜索文件夹、文件名、描述或类型..."
                    className="min-w-[260px] flex-1 rounded-2xl border border-white/10 bg-dark-card px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  />
                  <div className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-muted">
                    点击文件会打开独立的文件工作区
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1">
              {!selectedKbId ? (
                <div className="flex h-full items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-dark-card/70 p-10 text-center text-sm text-muted">
                  当前没有知识库数据，你可以先创建一个知识库。
                </div>
              ) : activeView === "trash" ? (
                <section className="flex min-h-[calc(100vh-220px)] flex-col rounded-[32px] border border-white/5 bg-[#141718] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                  <div className="mb-4 text-sm text-muted">
                    回收站仅显示直接删除的顶层条目。文件夹可以展开预览内部结构，但恢复和永久删除只能对顶层条目操作。
                  </div>
                  <div className="space-y-3 overflow-y-auto">
                    {trashItems.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-white/10 bg-dark-card p-10 text-center text-sm text-muted">
                        回收站暂无内容
                      </div>
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
                                const [children, files] = await Promise.all([
                                  fetchTrashFolderChildren(folderId),
                                  fetchTrashFolderFiles(folderId),
                                ]);
                                setTrashFolderChildren((prev) => ({ ...prev, [folderId]: children }));
                                setTrashFolderFiles((prev) => ({ ...prev, [folderId]: files }));
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
                </section>
              ) : (
                <FolderTree
                  knowledgeBase={selectedKb}
                  folders={folders}
                  files={files}
                  selectedFolderId={selectedFolderId}
                  searchTerm={searchTerm}
                  canMoveFiles={canMoveFiles}
                  onSelectFolder={(id) => {
                    setSelectedFolderId(id);
                  }}
                  onOpenFile={handleOpenFile}
                  onCreateFolder={handleCreateFolder}
                  onUploadFile={handleUploadClick}
                  onDeleteFolder={handleDeleteFolder}
                  onDeleteFile={handleDeleteFile}
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
                />
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-hidden">
            <KnowledgeChatPanel
              title={chatContext.title}
              subtitle={chatContext.subtitle}
              contextName={chatContext.contextName}
              starterPrompts={chatContext.prompts}
              placeholder={chatContext.placeholder}
              disabled={Boolean(chatDisabledReason)}
              disabledReason={chatDisabledReason ?? undefined}
              className="min-h-[calc(100vh-32px)]"
            />
          </div>
        </main>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <ConfirmModal
        action={confirmAction}
        busy={Boolean(isBusy && confirmAction)}
        onCancel={() => {
          if (isBusy) return;
          setConfirmAction(null);
        }}
      />
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
