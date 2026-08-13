import { KnowledgeFile } from "@/lib/knowledge-types";

const KNOWLEDGE_FILE_CACHE_KEY = "knowledge_file_view_cache";

export interface CachedKnowledgeFileView {
  file: KnowledgeFile;
  knowledgeBaseName?: string;
}

export function cacheKnowledgeFileView(input: CachedKnowledgeFileView): void {
  if (typeof window === "undefined") return;

  const raw = window.localStorage.getItem(KNOWLEDGE_FILE_CACHE_KEY);
  const current = raw ? (JSON.parse(raw) as Record<string, CachedKnowledgeFileView>) : {};
  current[input.file.file_id] = input;
  window.localStorage.setItem(KNOWLEDGE_FILE_CACHE_KEY, JSON.stringify(current));
}

export function getCachedKnowledgeFileView(
  fileId: string
): CachedKnowledgeFileView | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(KNOWLEDGE_FILE_CACHE_KEY);
  if (!raw) return null;

  try {
    const current = JSON.parse(raw) as Record<string, CachedKnowledgeFileView>;
    return current[fileId] ?? null;
  } catch {
    return null;
  }
}


/** 可用 PDF.js 预览的后缀：原生 PDF + Office（转 PDF 后 bbox 对齐） */
const PDF_PREVIEWABLE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
]);

/**
 * 判断文件是否应按 PDF 视图渲染（react-pdf + bbox 高亮）。
 *
 * Word/PPT 后端会在 /raw 默认返回转换后 PDF；若尚未转换完成，
 * DocumentView 仍进入 PDF 视图，由加载失败态提示。
 */
export function isPdfPreviewableFile(file: {
  file_name?: string | null;
  mime_type?: string | null;
  render_as?: string | null;
  preview_mime_type?: string | null;
}): boolean {
  if (file.render_as === "pdf") return true;
  if (file.preview_mime_type?.includes("pdf")) return true;
  if (file.mime_type?.includes("pdf")) return true;

  const name = (file.file_name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() || "" : "";
  return PDF_PREVIEWABLE_EXTENSIONS.has(ext);
}
