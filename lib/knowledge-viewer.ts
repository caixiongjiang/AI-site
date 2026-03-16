import { API_CONFIG } from "@/lib/config";
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

export function buildKnowledgePreviewUrl(fileId: string): string {
  const customTemplate = process.env.NEXT_PUBLIC_KNOWLEDGE_FILE_PREVIEW_URL_TEMPLATE;

  if (customTemplate) {
    return customTemplate.replace("{file_id}", encodeURIComponent(fileId));
  }

  return `${API_CONFIG.BASE_URL}/api/knowledge/file/${encodeURIComponent(fileId)}/preview`;
}
