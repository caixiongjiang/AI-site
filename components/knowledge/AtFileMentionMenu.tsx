"use client";

/**
 * AtFileMentionMenu — 输入框 `@` 文件/目录选择浮层（query 驱动）
 *
 * 与旧版区别：
 * - 不再自行从 inputValue 检测触发，也不再渲染前置 chip / 改写输入文本；
 * - 改为由富文本编辑器（MentionComposer）根据光标位置算出 `@` 后的 query
 *   传进来，本组件只负责「下拉列表 + 选中」；
 * - 选中后只把 AtMention 透出给编辑器，由编辑器在光标处插入原子 pill。
 *
 * 使用方式（Cursor 式 @）：
 * - query === null → 未触发，浮层关闭
 * - query === ""   → 浏览模式（逐层浏览目录树 + 当前层级文件）
 * - query !== ""   → 搜索模式（按文件名搜索 + 按名过滤目录）
 *
 * 作用域：仅限当前知识库（knowledgeBaseId）。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  CornerUpLeft,
  File as FileIcon,
  Folder as FolderIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchFolders,
  fetchFolderFiles,
  fetchRootFiles,
  searchFiles,
} from "@/lib/api/knowledge";
import type { FolderInfo, KnowledgeFile } from "@/lib/knowledge-types";

const RESULT_LIMIT = 8;

/** @ 选中的对象：文件或目录 */
export interface AtMention {
  kind: "file" | "folder";
  id: string;
  label: string;
  /** 文件是否已完成索引；目录恒为 true。用于 UI 未索引提示。 */
  indexed: boolean;
}

interface AtFileMentionMenuProps {
  /** 当前知识库 ID；为空时不启用 */
  knowledgeBaseId: string | null;
  /** 由编辑器算出的 `@` query：null=未触发；""=浏览；非空=搜索 */
  query: string | null;
  /** 选中回调：把 AtMention 透出给编辑器插入 pill */
  onSelect: (mention: AtMention) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 菜单里一行的抽象（含特殊的「返回上级」行） */
type Row =
  | { kind: "back"; parentId: string | null }
  | { kind: "folder"; data: FolderInfo }
  | { kind: "file"; data: KnowledgeFile };

function isIndexed(file: KnowledgeFile): boolean {
  return file.index_status === "success" || file.status === 2;
}

export function AtFileMentionMenu({
  knowledgeBaseId,
  query,
  onSelect,
  disabled,
}: AtFileMentionMenuProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [allFolders, setAllFolders] = useState<FolderInfo[]>([]);
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [browseFiles, setBrowseFiles] = useState<KnowledgeFile[]>([]);
  const [searchResults, setSearchResults] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Escape / 点击外部后，抑制同一 query 再次自动打开，直到 query 变化
  const dismissedQueryRef = useRef<string | null>(null);

  const searching = query !== null && query.trim().length > 0;

  // 浮层显隐：query 非空且未禁用、有 KB 即打开（除非被主动关闭过同一 query）
  useEffect(() => {
    const enabled = query !== null && !disabled && Boolean(knowledgeBaseId);
    if (!enabled) {
      setOpen(false);
      setBrowseFolderId(null);
      return;
    }
    if (dismissedQueryRef.current === query) {
      setOpen(false);
      return;
    }
    dismissedQueryRef.current = null;
    setOpen(true);
    setHighlightIndex(0);
  }, [query, disabled, knowledgeBaseId]);

  // 打开时加载该 KB 的全部目录（一次）
  useEffect(() => {
    if (!open || !knowledgeBaseId) return;
    let cancelled = false;
    fetchFolders(knowledgeBaseId)
      .then((folders) => {
        if (!cancelled) setAllFolders(folders);
      })
      .catch(() => {
        if (!cancelled) setAllFolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, knowledgeBaseId]);

  // 浏览模式：加载当前层级的文件（根目录 or 指定目录）
  useEffect(() => {
    if (!open || searching || !knowledgeBaseId) return;
    let cancelled = false;
    setLoading(true);
    const loader = browseFolderId
      ? fetchFolderFiles(browseFolderId)
      : fetchRootFiles(knowledgeBaseId);
    loader
      .then((files) => {
        if (!cancelled) setBrowseFiles(files);
      })
      .catch(() => {
        if (!cancelled) setBrowseFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, searching, browseFolderId, knowledgeBaseId]);

  // 搜索模式：按文件名搜索（300ms 防抖）
  useEffect(() => {
    if (!open || !searching || !knowledgeBaseId || query === null) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      searchFiles({ knowledgeBaseId, q: query, limit: RESULT_LIMIT })
        .then((files) => {
          if (!cancelled) setSearchResults(files);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, searching, query, knowledgeBaseId]);

  // 当前层级直接子目录（浏览模式用）
  const currentFolders = useMemo<FolderInfo[]>(() => {
    if (searching) return [];
    return allFolders.filter(
      (f) => (f.parent_folder_id ?? null) === browseFolderId
    );
  }, [allFolders, browseFolderId, searching]);

  // 搜索模式下按名过滤的目录
  const matchedFolders = useMemo<FolderInfo[]>(() => {
    if (!searching || query === null) return [];
    const q = query.toLowerCase();
    return allFolders
      .filter((f) => f.folder_name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [allFolders, searching, query]);

  // 组装扁平行列表（供键盘导航 / 渲染）
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (searching) {
      for (const f of matchedFolders) list.push({ kind: "folder", data: f });
      for (const f of searchResults) list.push({ kind: "file", data: f });
    } else {
      if (browseFolderId !== null) {
        const current = allFolders.find((f) => f.folder_id === browseFolderId);
        list.push({
          kind: "back",
          parentId: current?.parent_folder_id ?? null,
        });
      }
      for (const f of currentFolders) list.push({ kind: "folder", data: f });
      for (const f of browseFiles) list.push({ kind: "file", data: f });
    }
    return list;
  }, [
    searching,
    matchedFolders,
    searchResults,
    browseFolderId,
    allFolders,
    currentFolders,
    browseFiles,
  ]);

  useEffect(() => {
    setHighlightIndex((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const selectFolder = useCallback(
    (folder: FolderInfo) => {
      onSelect({
        kind: "folder",
        id: folder.folder_id,
        label: folder.folder_name,
        indexed: true,
      });
      setOpen(false);
    },
    [onSelect]
  );

  const selectFile = useCallback(
    (file: KnowledgeFile) => {
      onSelect({
        kind: "file",
        id: file.file_id,
        label: file.file_name,
        indexed: isIndexed(file),
      });
      setOpen(false);
    },
    [onSelect]
  );

  const drillInto = useCallback((folderId: string) => {
    setBrowseFolderId(folderId);
    setHighlightIndex(0);
  }, []);

  const activateRow = useCallback(
    (row: Row) => {
      if (row.kind === "back") {
        setBrowseFolderId(row.parentId);
        setHighlightIndex(0);
      } else if (row.kind === "folder") {
        // 浏览模式默认进入目录；搜索模式默认选中目录
        if (searching) selectFolder(row.data);
        else drillInto(row.data.folder_id);
      } else {
        selectFile(row.data);
      }
    },
    [searching, selectFolder, drillInto, selectFile]
  );

  // 点击外部关闭（并抑制同一 query 自动重开）
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismissedQueryRef.current = query;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!open) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, rows.length - 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if ((e.key === "Enter" || e.key === "Tab") && rows[highlightIndex]) {
        e.preventDefault();
        activateRow(rows[highlightIndex]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismissedQueryRef.current = query;
        setOpen(false);
        return true;
      }
      return false;
    },
    [open, rows, highlightIndex, activateRow, query]
  );

  useEffect(() => {
    const el = itemRefs.current[highlightIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const renderRow = (row: Row, index: number) => {
    const isActive = index === highlightIndex;
    const baseCls = cn(
      "flex w-full items-center gap-2 px-3 py-[7px] text-left text-[13px] text-neutral-800",
      isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
    );

    if (row.kind === "back") {
      return (
        <button
          key="__back__"
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          onMouseEnter={() => setHighlightIndex(index)}
          onMouseDown={(e) => {
            e.preventDefault();
            activateRow(row);
          }}
          className={cn(baseCls, "text-neutral-500")}
        >
          <CornerUpLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">返回上级</span>
        </button>
      );
    }

    if (row.kind === "folder") {
      const folder = row.data;
      return (
        <div
          key={`folder:${folder.folder_id}`}
          className={cn(baseCls, "group gap-1 pr-1.5")}
          onMouseEnter={() => setHighlightIndex(index)}
        >
          <button
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              selectFolder(folder);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title={`选择目录 ${folder.folder_name}`}
          >
            <FolderIcon
              className="h-3.5 w-3.5 shrink-0 text-blue-500"
              strokeWidth={1.75}
            />
            <span className="truncate">{folder.folder_name}</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              drillInto(folder.folder_id);
            }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-200/70 hover:text-neutral-700"
            title="进入目录"
            aria-label={`进入目录 ${folder.folder_name}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    const file = row.data;
    const indexed = isIndexed(file);
    return (
      <button
        key={`file:${file.file_id}`}
        ref={(el) => {
          itemRefs.current[index] = el;
        }}
        type="button"
        onMouseEnter={() => setHighlightIndex(index)}
        onMouseDown={(e) => {
          e.preventDefault();
          selectFile(file);
        }}
        className={baseCls}
        title={file.file_name}
      >
        <FileIcon
          className="h-3.5 w-3.5 shrink-0 text-neutral-500"
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 truncate">{file.file_name}</span>
        {!indexed ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
            未索引
          </span>
        ) : null}
      </button>
    );
  };

  return {
    open,
    handleKeyDown,
    menuRef,
    renderMenu: () =>
      open ? (
        <div ref={menuRef} className="absolute bottom-full left-0 z-50 mb-2">
          <div
            className="relative max-h-[320px] w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
            role="listbox"
            aria-label="@ 文件 / 目录选择"
          >
            <div className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[11px] font-medium tracking-wide text-neutral-400">
              <span>{searching ? "搜索结果" : "浏览知识库"}</span>
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
              ) : null}
            </div>
            {rows.length > 0 ? (
              <div className="pb-1">
                {rows.map((row, i) => renderRow(row, i))}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-[12px] text-neutral-400">
                {loading
                  ? "加载中…"
                  : searching
                    ? "没有匹配的文件或目录"
                    : "该位置暂无文件或目录"}
              </div>
            )}
          </div>
        </div>
      ) : null,
  };
}
