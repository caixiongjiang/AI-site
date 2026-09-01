"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildKnowledgeIndex,
  createFolder,
  createKnowledgeBase,
  deleteFile,
  deleteFolder,
  deleteKnowledgeBase,
  fetchFolderFiles,
  fetchFolders,
  fetchIndexProgress,
  fetchRootFiles,
  fetchKnowledgeBaseChildren,
  fetchKnowledgeBases,
  moveFile,
  uploadSingleKnowledgeFile,
  uploadKnowledgeFiles,
} from "@/lib/api/knowledge";
import {
  ConfirmModal,
  type ConfirmAction,
} from "@/components/knowledge/ConfirmModal";
import { KnowledgeChatPanel } from "@/components/knowledge/KnowledgeChatPanel";
import { KnowledgeTree } from "@/components/knowledge/KnowledgeTree";
import {
  UploadProgressCard,
  type UploadTaskItem,
} from "@/components/knowledge/UploadProgressCard";
import {
  FolderInfo,
  KnowledgeBaseInfo,
  KnowledgeFile,
} from "@/lib/knowledge-types";
import { cacheKnowledgeFileView } from "@/lib/knowledge-viewer";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  LogIn,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

/** 问答作用域：锁定到某个知识库，或该知识库下的某个文件夹 */
interface ChatScope {
  kbId: string;
  kbName?: string;
  folderId: string | null;
  folderName?: string | null;
}

interface KnowledgeMetric {
  fileCount: number;
  lastUpdated?: string;
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

/** 文件夹自身 + 全部后代文件夹的 id */
function collectFolderSubtreeIds(
  folders: FolderInfo[],
  rootFolderId: string
): Set<string> {
  const ids = new Set<string>([rootFolderId]);
  const queue = [rootFolderId];

  while (queue.length > 0) {
    const current = queue.shift();
    folders.forEach((folder) => {
      if (folder.parent_folder_id === current && !ids.has(folder.folder_id)) {
        ids.add(folder.folder_id);
        queue.push(folder.folder_id);
      }
    });
  }

  return ids;
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
            if (
              e.key === "Enter" &&
              canConfirm &&
              !busy &&
              !e.nativeEvent.isComposing
            ) {
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

// ---- 左侧栏可拖拽分割条 ----
// 宽度按视口比例存储：固定像素在 1280 与 2560 上的占屏差一倍，比例才稳定。
// 未自定义时走 DEFAULT_RATIO 并封顶 DEFAULT_MAX；拖过一次后放开到 SPLIT_MAX。
// 双击分割条清除自定义值，回到默认比例。
const SPLIT_RATIO_STORAGE_KEY = "knowledge-workspace-left-ratio";
/** 默认占屏 1/4 */
const SPLIT_RATIO_DEFAULT = 0.25;
const SPLIT_MIN = 240;
const SPLIT_MAX = 560;
/** 默认宽度封顶：25vw 在大屏上过宽，超过即压住，多出的宽度留给对话区 */
const SPLIT_DEFAULT_MAX = 420;
/** SSR / 首帧拿不到 window.innerWidth 时的兜底宽度 */
const SPLIT_FALLBACK_WIDTH = 360;
/** 当前选中的知识库 ID 持久化 key（刷新后保持在原知识库，而非跳回第一个） */
const SELECTED_KB_STORAGE_KEY = "knowledge-workspace-selected-kb";

function KnowledgeWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetFolderRef = useRef<string | null>(null);
  /** null = 未自定义，按 SPLIT_RATIO_DEFAULT 计算 */
  const [leftRatio, setLeftRatio] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inputPrompt, setInputPrompt] = useState<InputPromptAction | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseInfo[]>([]);
  const [knowledgeMetrics, setKnowledgeMetrics] = useState<Record<string, KnowledgeMetric>>({});
  const [selectedKbId, setSelectedKbId] = useState("");
  /**
   * 问答作用域，与左侧浏览位置解耦：只有知识库/文件夹行上的「对话」按钮会改变它，
   * 点击行本身仅展开或切换浏览目标，不会打断当前会话。
   * 自带名称，这样浏览到别的知识库后作用域标题依然正确。
   */
  const [chatScope, setChatScope] = useState<ChatScope | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTaskItem[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const selectedKb = knowledgeBases.find(
    (kb) => kb.knowledge_base_id === selectedKbId
  );
  /** 问答锁定的知识库与当前浏览的是同一个时，才能用已加载的文件夹/文件推导统计与禁用态 */
  const chatScopeIsBrowsed = Boolean(chatScope) && chatScope?.kbId === selectedKbId;
  /** 树上的「问答目标」高亮只在浏览其所属知识库时出现 */
  const selectedFolderId = chatScopeIsBrowsed ? (chatScope?.folderId ?? null) : null;
  const selectedFolder = folders.find((folder) => folder.folder_id === selectedFolderId);
  const canMoveFiles = true;

  /** 把问答锁定到某个知识库（由知识库行的「对话」按钮触发） */
  const startKbChat = useCallback((kb: KnowledgeBaseInfo) => {
    setChatScope({
      kbId: kb.knowledge_base_id,
      kbName: kb.knowledge_base_name,
      folderId: null,
      folderName: null,
    });
  }, []);

  /** 把问答锁定到当前浏览知识库下的某个文件夹（null 表示回到整库） */
  const startFolderChat = useCallback(
    (folderId: string | null) => {
      if (!selectedKb) return;
      const folder = folderId
        ? folders.find((item) => item.folder_id === folderId)
        : undefined;
      setChatScope({
        kbId: selectedKb.knowledge_base_id,
        kbName: selectedKb.knowledge_base_name,
        folderId,
        folderName: folder?.folder_name ?? null,
      });
    },
    [folders, selectedKb]
  );

  /**
   * 删除文件夹后若问答正锁定在它（或其子孙）上，回退到整库问答。
   * 子树在删除前算好，避免依赖删除后异步重载的 folders 造成误清。
   */
  const clearChatFolderIfRemoved = useCallback((removedFolderIds: Set<string>) => {
    setChatScope((current) =>
      current && current.folderId && removedFolderIds.has(current.folderId)
        ? { ...current, folderId: null, folderName: null }
        : current
    );
  }, []);

  /** 左侧宽度：默认占屏 1/4 并封顶，用户拖过之后按其比例（上限放宽） */
  const effectiveLeftWidth = useMemo(() => {
    const vw = viewportWidth || 0;
    if (!vw) return SPLIT_FALLBACK_WIDTH;
    const cap = leftRatio === null ? SPLIT_DEFAULT_MAX : SPLIT_MAX;
    const raw = vw * (leftRatio ?? SPLIT_RATIO_DEFAULT);
    return Math.round(Math.min(cap, Math.max(SPLIT_MIN, raw)));
  }, [leftRatio, viewportWidth]);

  const visibleFiles = useMemo(() => {
    if (!selectedFolderId) return files;

    const folderIds = collectFolderSubtreeIds(folders, selectedFolderId);
    return files.filter(
      (file) => file.folder_id && folderIds.has(file.folder_id)
    );
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
    if (!chatScope) {
      return "先选择一个知识库，再围绕文件内容开始问答。";
    }

    // 问答锁定在别的知识库时，其文件列表尚未加载，无法判断是否为空，不做拦截
    if (chatScopeIsBrowsed && visibleFiles.length === 0) {
      return selectedFolder
        ? "当前文件夹下还没有文件，请先上传资料。"
        : "当前知识库还没有文件，请先上传资料。";
    }

    return null;
  }, [
    chatScope,
    chatScopeIsBrowsed,
    selectedFolder,
    visibleFiles.length,
  ]);

  const chatNoticeBanner = useMemo(() => {
    if (chatDisabledReason) return null;

    const hasUploadingTasks = uploadTasks.some(
      (t) => t.status === "uploading" || t.status === "waiting"
    );
    const hasIndexingTasks = uploadTasks.some((t) => t.status === "indexing");

    if (hasUploadingTasks) {
      return "部分文件正在上传中，你仍可基于现有已索引文件提问；上传并索引完成后问答将更完整。";
    }

    if (hasIndexingTasks && indexingSummary.total === 0) {
      return "新文件已上传，正在初始化索引，你仍可基于已有文件提问。";
    }

    if (indexingSummary.total > 0) {
      return `当前有 ${indexingSummary.total} 个文件正在构建索引中，你可正常提问，处理完成后问答将更准确完整。`;
    }

    if (fileStats.indexedCount === 0 && visibleFiles.length > 0) {
      return "文件正在解析中，你可先提问，索引构建完成后结果会更丰富。";
    }

    return null;
  }, [
    chatDisabledReason,
    fileStats.indexedCount,
    indexingSummary.total,
    uploadTasks,
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
      setSelectedKbId((current) => {
        if (current && list.some((kb) => kb.knowledge_base_id === current)) {
          return current;
        }
        // 刷新后 current 为空 → 优先恢复上次选中的知识库，避免跳回第一个
        try {
          const persisted = window.localStorage.getItem(SELECTED_KB_STORAGE_KEY);
          if (persisted && list.some((kb) => kb.knowledge_base_id === persisted)) {
            return persisted;
          }
        } catch {
          // localStorage 不可用 → 回退到首个
        }
        return list[0]?.knowledge_base_id ?? "";
      });
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

      setFolders(nextFolders);
      setFiles(nextFiles);
      setKnowledgeMetrics((prev) => ({
        ...prev,
        [knowledgeBaseId]: buildMetrics(nextFiles),
      }));
      setNotice(null);
    } catch (error) {
      setFolders([]);
      setFiles([]);
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

  // 视口宽度用于把比例换算成像素；SSR 阶段不读，避免 hydration warning
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setViewportWidth(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // 启动时还原用户自定义的左栏占比（没有则保持 null，走默认比例）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SPLIT_RATIO_STORAGE_KEY);
      if (!raw) return;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0 && value < 1) {
        setLeftRatio(value);
      }
    } catch {
      // localStorage 不可用（隐私模式 / 配额满）→ 用默认比例即可
    }
  }, []);

  // 当前选中知识库持久化（刷新后保持在原知识库，而非跳回第一个）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedKbId) return;
    try {
      window.localStorage.setItem(SELECTED_KB_STORAGE_KEY, selectedKbId);
    } catch {
      // ignore
    }
  }, [selectedKbId]);


  // 拖拽期间监听全局 mousemove / mouseup；同步给 body 加 col-resize 光标 + 禁选中。
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => {
      const vw = window.innerWidth || 1;
      const next = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, event.clientX));
      setLeftRatio(next / vw);
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

  // 占比变化即时持久化；回到默认（null）时清掉记录
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (leftRatio === null) {
        window.localStorage.removeItem(SPLIT_RATIO_STORAGE_KEY);
      } else {
        window.localStorage.setItem(SPLIT_RATIO_STORAGE_KEY, String(leftRatio));
      }
    } catch {
      // ignore quota / private-mode 错误
    }
  }, [leftRatio]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 切换浏览的知识库只重新加载目录，不动问答作用域（否则又会打断当前会话）
  useEffect(() => {
    if (!selectedKbId) {
      setFolders([]);
      setFiles([]);
      return;
    }

    void loadKnowledgeBaseWorkspace(selectedKbId);
  }, [selectedKbId]);

  // 首次进入时问答默认锁定当前知识库；知识库被删除后丢弃失效的作用域
  useEffect(() => {
    if (knowledgeBases.length === 0) {
      setChatScope(null);
      return;
    }
    setChatScope((current) => {
      if (
        current &&
        knowledgeBases.some((kb) => kb.knowledge_base_id === current.kbId)
      ) {
        return current;
      }
      if (!selectedKb) return null;
      return {
        kbId: selectedKb.knowledge_base_id,
        kbName: selectedKb.knowledge_base_name,
        folderId: null,
        folderName: null,
      };
    });
  }, [knowledgeBases, selectedKb]);


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

  const processingTaskIdsRef = useRef<Set<string>>(new Set());

  // 多文件并发调度：最多允许 2 个文件同时进行数据上传传输
  useEffect(() => {
    const MAX_CONCURRENT = 2;
    const currentUploadingCount = uploadTasks.filter(
      (t) => t.status === "uploading"
    ).length;

    const availableSlots = MAX_CONCURRENT - currentUploadingCount;
    if (availableSlots <= 0) return;

    const waitingTasks = uploadTasks.filter(
      (t) => t.status === "waiting" && !processingTaskIdsRef.current.has(t.id)
    );

    const tasksToStart = waitingTasks.slice(0, availableSlots);
    tasksToStart.forEach((task) => {
      void runSingleUploadTask(task);
    });
  }, [uploadTasks]);

  const runSingleUploadTask = async (task: UploadTaskItem) => {
    processingTaskIdsRef.current.add(task.id);
    const controller = new AbortController();

    // 更新任务为 uploading 状态并挂载 abortController
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: "uploading", abortController: controller }
          : t
      )
    );

    try {
      const uploaded = await uploadSingleKnowledgeFile({
        file: task.file,
        knowledge_base_id: task.knowledgeBaseId,
        folder_id: task.folderId,
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          setUploadTasks((prev) =>
            prev.map((t) => {
              if (t.id !== task.id) return t;
              return {
                ...t,
                progress: progressEvent.progress,
                loaded: progressEvent.loaded,
                speed: progressEvent.speed,
                estimatedSeconds: progressEvent.estimatedSeconds,
              };
            })
          );
        },
      });

      // 上传成功 -> 标记为 indexing 状态
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: "indexing",
                progress: 1,
                loaded: task.fileSize,
                speed: 0,
                estimatedSeconds: 0,
                fileId: uploaded.file_id,
              }
            : t
        )
      );

      // 立即触发后台索引构建
      await buildKnowledgeIndex({
        knowledge_base_id: task.knowledgeBaseId,
        file_ids: [uploaded.file_id],
      });

      // 刷新工作台文件列表，让左侧列表立刻看到新文件
      await loadKnowledgeBaseWorkspace(task.knowledgeBaseId);
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        // 用户主动取消 -> 移除该任务
        setUploadTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setUploadTasks((prev) =>
          prev.map((t) => {
            if (t.id !== task.id) return t;
            return {
              ...t,
              status: "error",
              speed: 0,
              estimatedSeconds: 0,
              errorMessage:
                error instanceof Error ? error.message : "上传失败",
            };
          })
        );
      }
    } finally {
      processingTaskIdsRef.current.delete(task.id);
    }
  };

  // 同步左侧轮询到的解析完成状态到悬浮上传卡片中
  useEffect(() => {
    if (files.length === 0 || uploadTasks.length === 0) return;

    setUploadTasks((prev) => {
      let changed = false;
      const next = prev.map((task) => {
        if (task.status !== "indexing" || !task.fileId) return task;
        const matchedFile = files.find((f) => f.file_id === task.fileId);
        if (!matchedFile) return task;

        if (matchedFile.index_status === "success") {
          changed = true;
          return { ...task, status: "completed" as const, progress: 1 };
        } else if (matchedFile.index_status === "failed") {
          changed = true;
          return {
            ...task,
            status: "error" as const,
            errorMessage: "文件解析或索引构建失败",
          };
        }
        return task;
      });
      return changed ? next : prev;
    });
  }, [files, uploadTasks.length]);

  // 防误触刷新拦截：只要有处于上传、排队或索引中的任务，就弹窗保护
  useEffect(() => {
    const hasActiveTask = uploadTasks.some(
      (t) =>
        t.status === "uploading" ||
        t.status === "waiting" ||
        t.status === "indexing"
    );
    if (!hasActiveTask) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue =
        "文件正在上传或构建中，离开页面将导致传输中断。确认离开吗？";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploadTasks]);

  const handleUploadClick = (targetFolderId: string | null = null) => {
    if (!selectedKbId) return;
    uploadTargetFolderRef.current = targetFolderId;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0 || !selectedKbId) return;

    const targetFolderId = uploadTargetFolderRef.current;
    uploadTargetFolderRef.current = null;

    const newTasks: UploadTaskItem[] = fileList.map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      fileName: file.name,
      fileSize: file.size,
      knowledgeBaseId: selectedKbId,
      folderId: targetFolderId,
      status: "waiting",
      progress: 0,
      loaded: 0,
      speed: 0,
      estimatedSeconds: 0,
    }));

    setUploadTasks((prev) => [...prev, ...newTasks]);
    setNotice(`已添加 ${fileList.length} 个文件到上传队列。`);
    event.target.value = "";
  };

  const handleCancelTask = (taskId: string) => {
    const target = uploadTasks.find((t) => t.id === taskId);
    if (target?.abortController) {
      target.abortController.abort();
    } else {
      setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const handleRetryTask = (taskId: string) => {
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "waiting",
              progress: 0,
              loaded: 0,
              speed: 0,
              estimatedSeconds: 0,
              errorMessage: undefined,
            }
          : t
      )
    );
  };

  const handleRemoveTask = (taskId: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleClearCompletedTasks = () => {
    setUploadTasks((prev) => prev.filter((t) => t.status !== "completed"));
  };

  const handleCloseAllTasks = () => {
    const isRunning = uploadTasks.some(
      (t) =>
        t.status === "uploading" ||
        t.status === "indexing" ||
        t.status === "waiting"
    );
    if (!isRunning) {
      setUploadTasks([]);
    }
  };

  /** 只创建顶层知识库：子知识库入口已下线，层级改由文件夹表达 */
  const handleCreateKnowledgeBase = () => {
    setInputPrompt({
      title: "新建知识库",
      placeholder: "请输入知识库名称",
      confirmLabel: "创建",
      onConfirm: async (name) => {
        try {
          setIsBusy("kb");
          const item = await createKnowledgeBase({
            knowledge_base_name: name,
            parent_knowledge_base_id: null,
          });
          await loadKnowledgeBasesData();
          setSelectedKbId(item.knowledge_base_id);
          setNotice("知识库已创建。");
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

    // 索引失败的文件没有可用内容，不值得再拦一次确认
    if (file.index_status === "failed") {
      try {
        setIsBusy("delete-file");
        await deleteFile(file.file_id);
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
      title: `永久删除文件「${file.file_name}」`,
      description:
        "文件及其索引数据会被永久删除，无法恢复，问答将不再引用该文件的内容。",
      confirmLabel: "永久删除",
      onConfirm: async () => {
        try {
          setIsBusy("delete-file");
          await deleteFile(file.file_id);
          await loadKnowledgeBaseWorkspace(selectedKbId);
          setNotice(`文件「${file.file_name}」已永久删除。`);
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
    // 删除前算好子树，删除后据此判断是否要撤掉问答锁定
    const removedFolderIds = collectFolderSubtreeIds(folders, folder.folder_id);

    if (isEmpty) {
      try {
        setIsBusy("delete-folder");
        await deleteFolder(folder.folder_id);
        await loadKnowledgeBaseWorkspace(selectedKbId);
        clearChatFolderIfRemoved(removedFolderIds);
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
      title: `永久删除文件夹「${folder.folder_name}」`,
      description:
        "该文件夹及其子文件夹中的文件会被永久删除，无法恢复，问答将不再引用这些文件的内容。",
      confirmLabel: "永久删除",
      onConfirm: async () => {
        try {
          setIsBusy("delete-folder");
          const result = await deleteFolder(folder.folder_id);
          await loadKnowledgeBaseWorkspace(selectedKbId);
          clearChatFolderIfRemoved(removedFolderIds);
          setNotice(
            `已永久删除 ${result.deleted_folder_count} 个文件夹、${result.deleted_file_count} 个文件。`
          );
        } catch (error) {
          setNotice(
            error instanceof Error
              ? `删除文件夹失败：${error.message}`
              : "删除文件夹失败"
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
        ? `此操作不可撤销，将同时删除 ${descendantIds.length} 个子知识库。请确保所有知识库内已无文件，否则无法删除。`
        : "此操作不可撤销。请确保知识库内已无文件，否则无法删除。";

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
            "--knowledge-left-width": `${effectiveLeftWidth}px`,
          } as React.CSSProperties
        }
      >
        <div className="flex min-w-0 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <KnowledgeTree
              knowledgeBases={knowledgeBasesView}
              selectedKbId={selectedKbId}
              folders={folders}
              files={files}
              uploadTasks={uploadTasks}
              selectedFolderId={selectedFolderId}
              searchTerm={searchTerm}
              canMoveFiles={canMoveFiles}
              onSelectKb={(id) => {
                // 只切换浏览目标，问答会话保持不变
                setSelectedKbId(id);
              }}
              chatKbId={chatScope?.kbId ?? null}
              onChatWithKb={(kb) => {
                setSelectedKbId(kb.knowledge_base_id);
                startKbChat(kb);
              }}
              onCreateKb={handleCreateKnowledgeBase}
              onDeleteKb={(kb) => handleDeleteKnowledgeBase(kb)}
              onSelectFolder={(id) => {
                // 仅由文件夹行上的「对话」按钮触发，展开/折叠不会切会话
                startFolderChat(id);
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
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.markdown,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* 可拖拽分割条：仅在 xl 及以上可用 */}
        <div
          className={cn(
            "group relative hidden h-full w-full xl:flex xl:items-center xl:justify-center",
            dragging && "bg-primary/10"
          )}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调整左侧宽度"
            onMouseDown={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDoubleClick={() => setLeftRatio(null)}
            className="h-full w-full cursor-col-resize"
            title="拖动调整宽度（双击恢复默认 1/4 屏宽）"
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
        </div>

        <div className="relative flex min-h-0 min-w-0 overflow-hidden">
          <KnowledgeChatPanel
            knowledgeBaseId={chatScope?.kbId ?? null}
            knowledgeBaseName={chatScope?.kbName}
            selectedFolderId={chatScope?.folderId ?? null}
            selectedFolderName={chatScope?.folderName ?? null}
            disabled={Boolean(chatDisabledReason)}
            disabledReason={chatDisabledReason ?? undefined}
            noticeBanner={chatNoticeBanner ?? undefined}
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
              {isBusy === "delete-file" && "正在删除文件，清理关联数据…"}
              {isBusy === "delete-folder" && "正在删除文件夹，清理关联数据…"}
              {isBusy === "delete-kb" && "正在删除知识库…"}
              {!["delete-file", "delete-folder", "delete-kb"].includes(isBusy) && "处理中…"}
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

      <UploadProgressCard
        tasks={uploadTasks}
        onCancelTask={handleCancelTask}
        onRetryTask={handleRetryTask}
        onRemoveTask={handleRemoveTask}
        onClearCompleted={handleClearCompletedTasks}
        onCloseAll={handleCloseAllTasks}
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
