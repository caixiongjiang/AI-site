"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildKnowledgeIndex,
  createFolder,
  createKnowledgeBase,
  fetchFolderFiles,
  fetchFolders,
  fetchIndexProgress,
  fetchKnowledgeBases,
  fetchTrashItems,
  restoreTrashItem,
  softDeleteFile,
  uploadKnowledgeFiles,
} from "@/lib/api/knowledge";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import { FileGrid } from "@/components/knowledge/FileGrid";
import { DocumentView } from "@/components/knowledge/DocumentView";
import { ChatSidebar } from "@/components/knowledge/ChatSidebar";
import { FolderTree } from "@/components/knowledge/FolderTree";
import {
  FolderInfo,
  KnowledgeBaseInfo,
  KnowledgeFile,
  TrashItem,
} from "@/lib/knowledge-types";
import {
  ArrowLeft,
  Bot,
  FileUp,
  FolderPlus,
  LockKeyhole,
  LogIn,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

type ActiveView = "files" | "trash";

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
    return {
      ...file,
      file_name: progress.file_name || file.file_name,
      index_status: progress.status,
      progress: progress.progress,
    };
  });
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
              这里不是冷冰冰的文件仓库，而是你和资料之间的长期工作界面。上传后自动索引、按文件夹管理、围绕单篇文档继续追问，适合合同、会议纪要、方案库和 SOP 等高频知识场景。
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                openAuthModal({
                  title: "登录以创建你的专属知识库",
                  description:
                    "登录后你可以上传文档、建立索引、保存文件夹结构，并把这些私有内容长期沉淀到你的个人工作区。",
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
                  title: "登录以上传文档并开始索引",
                  description:
                    "上传、索引和文档级问答都会消耗私有资源。登录后系统才能为你安全保存文件与后续问答记录。",
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

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "1. 上传资料",
              description: "支持按知识库与文件夹组织文档，让资料沉淀为清晰的工作资产。",
            },
            {
              title: "2. 自动索引",
              description: "系统会自动处理文档内容，帮助你更快建立稳定、可检索的知识上下文。",
            },
            {
              title: "3. 继续追问",
              description: "从文件级查看到侧边问答，围绕同一份资料持续深入，而不是每次重新开始。",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[28px] border border-white/10 bg-dark-card p-6"
            >
              <div className="text-sm text-primary-light">{item.title}</div>
              <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
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
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("files");
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  const selectedKb = knowledgeBases.find(
    (kb) => kb.knowledge_base_id === selectedKbId
  );

  const visibleFiles = useMemo(() => {
    return files.filter((file) => {
      if (selectedFolderId && file.folder_id !== selectedFolderId) return false;
      if (
        searchTerm &&
        !`${file.file_name} ${file.description ?? ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [files, searchTerm, selectedFolderId]);

  const fileStats = useMemo(() => {
    const totalSize = visibleFiles.reduce(
      (sum, file) => sum + (file.file_size ?? 0),
      0
    );
    const indexedCount = visibleFiles.filter(
      (file) => file.index_status === "success"
    ).length;
    const processingCount = visibleFiles.filter(
      (file) => file.index_status === "processing"
    ).length;

    return {
      totalSize,
      indexedCount,
      processingCount,
    };
  }, [visibleFiles]);

  const knowledgeBasesView = useMemo(() => {
    return knowledgeBases.map((kb) => ({
      ...kb,
      fileCount: knowledgeMetrics[kb.knowledge_base_id]?.fileCount ?? 0,
      lastUpdated: knowledgeMetrics[kb.knowledge_base_id]?.lastUpdated,
    }));
  }, [knowledgeBases, knowledgeMetrics]);

  const selectedFolderName = folders.find(
    (folder) => folder.folder_id === selectedFolderId
  )?.folder_name;

  const loadKnowledgeBasesData = async () => {
    try {
      const list = await fetchKnowledgeBases();
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
      setSelectedFile(null);
      setShowChat(false);
      setFolders([]);
      setFiles([]);
      setTrashItems([]);
      return;
    }

    setSelectedFolderId(null);
    setSelectedFile(null);
    setShowChat(false);
    void loadKnowledgeBaseWorkspace(selectedKbId);
  }, [selectedKbId]);

  useEffect(() => {
    setSelectedFile((current) => {
      if (!current) return null;
      return files.find((file) => file.file_id === current.file_id) ?? null;
    });
  }, [files]);

  useEffect(() => {
    if (!selectedKbId) return;

    const processingIds = files
      .filter((file) => file.index_status === "processing")
      .map((file) => file.file_id);
    if (processingIds.length === 0) return;

    const timer = window.setInterval(async () => {
      try {
        const progress = await fetchIndexProgress(processingIds);
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

  const handleBackToList = () => {
    setSelectedFile(null);
    setShowChat(false);
  };

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
      const uploaded = await uploadKnowledgeFiles({
        files: fileList,
        knowledge_base_id: selectedKbId,
        folder_id: selectedFolderId,
      });

      if (uploaded.length > 0) {
        await buildKnowledgeIndex({
          knowledge_base_id: selectedKbId,
          file_ids: uploaded.map((file) => file.file_id),
        });
      }

      await loadKnowledgeBaseWorkspace(selectedKbId);
      setNotice(`已上传 ${uploaded.length} 个文件，并开始构建索引。`);
    } catch (error) {
      setNotice(
        error instanceof Error ? `上传失败：${error.message}` : "上传失败"
      );
    } finally {
      setIsBusy(null);
      event.target.value = "";
    }
  };

  const handleBuildIndex = async () => {
    if (!selectedKbId) return;

    const targetFiles = visibleFiles.filter(
      (file) =>
        file.index_status !== "success" && file.index_status !== "processing"
    );

    if (targetFiles.length === 0) {
      setNotice("当前视图没有可重新构建索引的文件。");
      return;
    }

    try {
      setIsBusy("index");
      await buildKnowledgeIndex({
        knowledge_base_id: selectedKbId,
        file_ids: targetFiles.map((file) => file.file_id),
      });
      await loadKnowledgeBaseWorkspace(selectedKbId);
      setNotice(`已提交 ${targetFiles.length} 个文件的索引任务。`);
    } catch (error) {
      setNotice(
        error instanceof Error ? `触发索引失败：${error.message}` : "触发索引失败"
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleCreateKnowledgeBase = async () => {
    const name = window.prompt("输入新知识库名称");
    if (!name?.trim()) return;

    try {
      setIsBusy("kb");
      const item = await createKnowledgeBase({
        knowledge_base_name: name.trim(),
      });
      setKnowledgeBases((prev) => [item, ...prev]);
      setKnowledgeMetrics((prev) => ({
        ...prev,
        [item.knowledge_base_id]: { fileCount: 0 },
      }));
      setSelectedKbId(item.knowledge_base_id);
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
      const item = await createFolder({
        knowledge_base_id: selectedKbId,
        folder_name: name.trim(),
        parent_folder_id: selectedFolderId,
      });
      setFolders((prev) => [...prev, item]);
    } catch (error) {
      setNotice(
        error instanceof Error ? `创建文件夹失败：${error.message}` : "创建文件夹失败"
      );
    } finally {
      setIsBusy(null);
    }
  };

  const handleDeleteFile = async (file: KnowledgeFile) => {
    const confirmed = window.confirm(`确认将「${file.file_name}」移入回收站？`);
    if (!confirmed || !selectedKbId) return;

    try {
      setIsBusy("delete");
      await softDeleteFile(file.file_id);
      await loadKnowledgeBaseWorkspace(selectedKbId);
      setNotice("文件已移入回收站。");
    } catch (error) {
      setNotice(
        error instanceof Error ? `删除失败：${error.message}` : "删除失败"
      );
    } finally {
      setIsBusy(null);
    }
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.15),transparent_35%),#111314] text-sm text-muted">
        正在加载知识库工作台...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.12),transparent_28%),linear-gradient(180deg,#121516_0%,#0f1112_100%)]">
      <KnowledgeList
        knowledgeBases={knowledgeBasesView}
        selectedId={selectedKbId}
        onSelect={(id) => {
          setSelectedKbId(id);
          setSearchTerm("");
          setActiveView("files");
        }}
        onCreate={handleCreateKnowledgeBase}
      />

      <FolderTree
        folders={folders}
        selectedId={selectedFolderId}
        onSelect={(id) => {
          setSelectedFolderId(id);
          setSelectedFile(null);
          setActiveView("files");
        }}
        onCreate={handleCreateFolder}
      />

      <main
        className={cn(
          "flex flex-1 flex-col overflow-y-auto transition-all",
          showChat && "mr-[440px]"
        )}
      >
        <div className="border-b border-white/5 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted">
                <Sparkles className="h-3.5 w-3.5 text-primary-light" />
                Knowledge Workspace
              </div>
              <h1 className="text-3xl text-foreground">
                {selectedFile
                  ? selectedFile.file_name
                  : activeView === "trash"
                    ? "回收站"
                    : selectedKb?.knowledge_base_name || "暂无知识库"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setActiveView("files");
                  }}
                  className="text-primary-light transition-colors hover:text-white"
                >
                  知识库
                </button>
                <span>›</span>
                <span>{selectedKb?.knowledge_base_name || "未选择"}</span>
                {selectedFolderName && (
                  <>
                    <span>›</span>
                    <span>{selectedFolderName}</span>
                  </>
                )}
                {selectedFile && (
                  <>
                    <span>›</span>
                    <span>{selectedFile.file_name}</span>
                  </>
                )}
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
                onClick={() => setActiveView("trash")}
                disabled={!selectedKbId}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  activeView === "trash"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-white/10 bg-white/5 text-muted hover:border-primary"
                )}
              >
                <Trash2 className="h-4 w-4" />
                回收站
              </button>
              <button
                onClick={() => setActiveView("files")}
                disabled={!selectedKbId}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  activeView === "files"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-white/10 bg-white/5 text-muted hover:border-primary"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                文件列表
              </button>
            </div>
          </div>

          {notice && (
            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
              {notice}
            </div>
          )}

          {!selectedFile && activeView === "files" && (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                <div className="rounded-[24px] border border-white/5 bg-dark-card p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted">
                    当前文件
                  </div>
                  <div className="mt-3 text-2xl text-foreground">{visibleFiles.length}</div>
                  <div className="mt-1 text-xs text-muted">
                    {selectedFolderName ? `目录：${selectedFolderName}` : "全部目录"}
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/5 bg-dark-card p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted">
                    已完成索引
                  </div>
                  <div className="mt-3 text-2xl text-foreground">{fileStats.indexedCount}</div>
                  <div className="mt-1 text-xs text-muted">
                    处理中 {fileStats.processingCount} 个
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/5 bg-dark-card p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted">
                    文件体量
                  </div>
                  <div className="mt-3 text-2xl text-foreground">
                    {formatBytes(fileStats.totalSize)}
                  </div>
                  <div className="mt-1 text-xs text-muted">当前筛选结果总大小</div>
                </div>
                <div className="rounded-[24px] border border-white/5 bg-[linear-gradient(160deg,rgba(0,179,107,0.18),rgba(37,37,38,0.95))] p-5">
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted">
                    <Bot className="h-3.5 w-3.5" />
                    智能问答入口
                  </div>
                  <div className="mt-3 text-sm leading-6 text-foreground">
                    上传并索引后，进入文档即可像 ima 一样围绕单篇资料快速追问。
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex min-w-[280px] flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-dark-card px-3.5 py-3 transition-all focus-within:border-primary">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="搜索文件名、描述..."
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
                  />
                </div>
                <button
                  onClick={handleUploadClick}
                  disabled={!selectedKbId}
                  className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileUp className="h-4 w-4" />
                  上传并索引
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!selectedKbId}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FolderPlus className="h-4 w-4" />
                  新建文件夹
                </button>
                <button
                  onClick={handleBuildIndex}
                  disabled={!selectedKbId}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" />
                  重新构建索引
                </button>
              </div>
            </>
          )}

          {selectedFile && (
            <button
              onClick={handleBackToList}
              className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground transition-all hover:border-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              返回文件列表
            </button>
          )}
        </div>

        <div className="flex-1 p-6">
          {!selectedKbId ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-dark-card/70 p-10 text-center">
              <div className="text-base text-foreground">当前没有知识库数据</div>
              <div className="mt-2 text-sm text-muted">
                如果接口返回为空，这里会保持为空；你也可以直接新建知识库。
              </div>
            </div>
          ) : selectedFile ? (
            <DocumentView
              file={selectedFile}
              kbName={selectedKb?.knowledge_base_name || ""}
              onAskClick={() => setShowChat(true)}
            />
          ) : activeView === "trash" ? (
            <div className="space-y-3">
              {trashItems.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-dark-card p-10 text-center text-sm text-muted">
                  回收站暂无内容
                </div>
              ) : (
                trashItems.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/5 bg-dark-card px-5 py-4"
                  >
                    <div>
                      <div className="text-sm text-foreground">{item.item_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span>{item.item_type === "folder" ? "文件夹" : "文件"}</span>
                        {item.file_size ? <span>{formatBytes(item.file_size)}</span> : null}
                        {item.deleted_at ? <span>删除于 {formatDate(item.deleted_at)}</span> : null}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleRestoreTrash(item)}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs text-foreground transition-colors hover:border-primary"
                    >
                      恢复
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <FileGrid
              files={visibleFiles}
              onFileClick={setSelectedFile}
              onDeleteFile={(file) => void handleDeleteFile(file)}
            />
          )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {selectedFile && (
        <ChatSidebar
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          documentName={selectedFile.file_name}
        />
      )}
    </div>
  );
}

export default function KnowledgePage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <KnowledgeGuestView />;
  }

  return <KnowledgeWorkspace />;
}
