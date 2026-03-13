import { API_CONFIG, getCommonHeaders } from "@/lib/config";
import {
  ApiResponse,
  FileProgress,
  FolderInfo,
  KnowledgeBaseInfo,
  KnowledgeFile,
  TrashItem,
} from "@/lib/knowledge-types";

interface KnowledgeBaseListResponse {
  knowledge_bases: KnowledgeBaseInfo[];
  total: number;
}

interface FolderListResponse {
  folders: FolderInfo[];
  total: number;
}

interface FileListResponse {
  files: KnowledgeFile[];
  total: number;
}

interface TrashListResponse {
  items: TrashItem[];
  total: number;
}

interface FileUploadResponse {
  file_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

interface BatchFileUploadResponse {
  uploaded_files?: FileUploadResponse[];
}

interface BatchProgressResponse {
  files: FileProgress[];
}

const KNOWLEDGE_API_PREFIX = process.env.NEXT_PUBLIC_KNOWLEDGE_API_PREFIX ?? "";

function buildKnowledgeUrl(path: string): string {
  return `${API_CONFIG.BASE_URL}${KNOWLEDGE_API_PREFIX}${path}`;
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const defaultHeaders = getCommonHeaders();
  const nextHeaders: Record<string, string> = {};

  if (defaultHeaders["X-User-Id"]) {
    nextHeaders["X-User-Id"] = defaultHeaders["X-User-Id"];
  }

  if (defaultHeaders.Authorization) {
    nextHeaders.Authorization = defaultHeaders.Authorization;
  }

  if (!(init?.body instanceof FormData)) {
    nextHeaders["Content-Type"] = defaultHeaders["Content-Type"];
  }

  return {
    ...nextHeaders,
    ...(init?.headers ?? {}),
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildKnowledgeUrl(path), {
    ...init,
    headers: buildHeaders(init),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "知识库接口请求失败",
    }));
    throw new Error(error.detail || error.message || `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

export async function fetchKnowledgeBases(): Promise<KnowledgeBaseInfo[]> {
  const data = await requestJson<KnowledgeBaseListResponse>("/api/knowledge/base/list", {
    method: "GET",
  });
  return data.knowledge_bases ?? [];
}

export async function createKnowledgeBase(input: {
  knowledge_base_name: string;
  description?: string;
}): Promise<KnowledgeBaseInfo> {
  return requestJson<KnowledgeBaseInfo>("/api/knowledge/base/create", {
    method: "POST",
    body: JSON.stringify({
      knowledge_type: "common_file",
      ...input,
    }),
  });
}

export async function fetchFolders(
  knowledgeBaseId: string
): Promise<FolderInfo[]> {
  const data = await requestJson<FolderListResponse>(
    `/api/knowledge/folder/list?knowledge_base_id=${encodeURIComponent(knowledgeBaseId)}`,
    {
      method: "GET",
    }
  );
  return data.folders ?? [];
}

export async function createFolder(input: {
  knowledge_base_id: string;
  folder_name: string;
  parent_folder_id?: string | null;
  description?: string;
}): Promise<FolderInfo> {
  return requestJson<FolderInfo>("/api/knowledge/folder/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchFolderFiles(folderId: string): Promise<KnowledgeFile[]> {
  const data = await requestJson<FileListResponse>(
    `/api/knowledge/folder/${encodeURIComponent(folderId)}/files`,
    {
      method: "GET",
    }
  );
  return (data.files ?? []).map((file) => ({
    ...file,
    index_status: "pending",
    progress: 0,
  }));
}

export async function uploadKnowledgeFiles(input: {
  files: File[];
  knowledge_base_id: string;
  folder_id?: string | null;
}): Promise<FileUploadResponse[]> {
  if (input.files.length === 1) {
    const formData = new FormData();
    formData.append("file", input.files[0]);
    formData.append("knowledge_base_id", input.knowledge_base_id);
    if (input.folder_id) {
      formData.append("folder_id", input.folder_id);
    }

    const file = await requestJson<FileUploadResponse>("/api/knowledge/index/upload", {
      method: "POST",
      body: formData,
      headers: buildHeaders({ body: formData }),
    });

    return [file];
  }

  const formData = new FormData();
  input.files.forEach((file) => formData.append("files", file));
  formData.append("knowledge_base_id", input.knowledge_base_id);
  if (input.folder_id) {
    formData.append("folder_id", input.folder_id);
  }

  const data = await requestJson<BatchFileUploadResponse>(
    "/api/knowledge/index/upload/batch",
    {
      method: "POST",
      body: formData,
      headers: buildHeaders({ body: formData }),
    }
  );

  return data.uploaded_files ?? [];
}

export async function buildKnowledgeIndex(input: {
  file_ids: string[];
  knowledge_base_id: string;
}): Promise<void> {
  await requestJson<void>("/api/knowledge/index/build", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchIndexProgress(fileIds: string[]): Promise<FileProgress[]> {
  const data = await requestJson<BatchProgressResponse>(
    "/api/knowledge/index/progress/batch",
    {
      method: "POST",
      body: JSON.stringify(fileIds),
    }
  );
  return data.files ?? [];
}

export async function fetchTrashItems(
  knowledgeBaseId?: string
): Promise<TrashItem[]> {
  const suffix = knowledgeBaseId
    ? `?knowledge_base_id=${encodeURIComponent(knowledgeBaseId)}`
    : "";
  const data = await requestJson<TrashListResponse>(
    `/api/knowledge/trash/list${suffix}`,
    {
      method: "GET",
    }
  );
  return data.items ?? [];
}

export async function restoreTrashItem(item: TrashItem): Promise<void> {
  const path =
    item.item_type === "folder"
      ? `/api/knowledge/trash/restore/folder/${encodeURIComponent(item.item_id)}`
      : `/api/knowledge/trash/restore/file/${encodeURIComponent(item.item_id)}`;
  await requestJson<void>(path, { method: "POST" });
}

export async function softDeleteFile(fileId: string): Promise<void> {
  await requestJson<void>(`/api/knowledge/folder/file/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}
