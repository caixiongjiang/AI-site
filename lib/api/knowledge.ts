import { API_CONFIG, getCommonHeaders, getCurrentUserId } from "@/lib/config";
import {
  ApiResponse,
  ChunkImagePreviewResponse,
  ChunkPositionResponse,
  FileDeleteResponse,
  FileIndexStatus,
  FilePreviewResponse,
  FileProgress,
  FolderDeleteResponse,
  FolderInfo,
  KnowledgeBaseInfo,
  KnowledgeFile,
  TrashFolderChildItem,
  TrashFolderFileItem,
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

export interface UploadProgressEvent {
  progress: number;
  loaded: number;
  total: number;
  speed: number;
  estimatedSeconds: number;
}

async function requestJsonWithUploadProgress<T>(
  path: string,
  init: {
    method: string;
    body: FormData;
    headers?: HeadersInit;
    onUploadProgress?: (event: UploadProgressEvent) => void;
  }
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, buildKnowledgeUrl(path));

    const headers = buildHeaders({
      method: init.method,
      body: init.body,
      headers: init.headers,
    });

    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        xhr.setRequestHeader(key, value);
      }
    });

    let startTime = 0;
    let lastTime = 0;
    let lastLoaded = 0;
    let smoothedSpeed = 0;
    let totalBytes = 0;

    xhr.upload.onloadstart = () => {
      startTime = performance.now();
      lastTime = startTime;
      lastLoaded = 0;
      smoothedSpeed = 0;
    };

    xhr.upload.onprogress = (event) => {
      if (!init.onUploadProgress) return;

      const now = performance.now();
      if (!startTime) {
        startTime = now;
        lastTime = now;
      }

      const loaded = event.loaded;
      const total = event.lengthComputable ? event.total : loaded;
      totalBytes = total;
      const progress = total > 0 ? Math.min(1, loaded / total) : 0;

      const timeDelta = (now - lastTime) / 1000;
      if (timeDelta >= 0.25) {
        const loadedDelta = loaded - lastLoaded;
        const currentSpeed = timeDelta > 0 ? loadedDelta / timeDelta : 0;
        smoothedSpeed = smoothedSpeed === 0 ? currentSpeed : smoothedSpeed * 0.7 + currentSpeed * 0.3;
        lastTime = now;
        lastLoaded = loaded;
      }

      const totalElapsed = (now - startTime) / 1000;
      const effectiveSpeed = smoothedSpeed > 0 ? smoothedSpeed : (totalElapsed > 0 ? loaded / totalElapsed : 0);
      const remainingBytes = Math.max(0, total - loaded);
      const estimatedSeconds = effectiveSpeed > 0 ? Math.round(remainingBytes / effectiveSpeed) : 0;

      init.onUploadProgress({
        progress,
        loaded,
        total,
        speed: effectiveSpeed,
        estimatedSeconds,
      });
    };

    xhr.onerror = () => {
      reject(new Error("知识库上传失败，请检查网络连接"));
    };

    xhr.onload = () => {
      try {
        const payload = xhr.responseText
          ? (JSON.parse(xhr.responseText) as ApiResponse<T>)
          : null;

        if (xhr.status < 200 || xhr.status >= 300) {
          const error = payload as
            | {
                detail?: string;
                message?: string;
              }
            | null;
          reject(
            new Error(error?.detail || error?.message || `HTTP ${xhr.status}`)
          );
          return;
        }

        init.onUploadProgress?.({
          progress: 1,
          loaded: totalBytes || 1,
          total: totalBytes || 1,
          speed: 0,
          estimatedSeconds: 0,
        });
        resolve(payload?.data as T);
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("解析上传响应失败")
        );
      }
    };

    xhr.send(init.body);
  });
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
  parent_knowledge_base_id?: string | null;
}): Promise<KnowledgeBaseInfo> {
  return requestJson<KnowledgeBaseInfo>("/api/knowledge/base/create", {
    method: "POST",
    body: JSON.stringify({
      knowledge_type: "common_file",
      ...input,
    }),
  });
}

export async function fetchKnowledgeBaseChildren(
  parentKnowledgeBaseId?: string | null
): Promise<KnowledgeBaseInfo[]> {
  const suffix = parentKnowledgeBaseId
    ? `?parent_knowledge_base_id=${encodeURIComponent(parentKnowledgeBaseId)}`
    : "";
  const data = await requestJson<KnowledgeBaseListResponse>(
    `/api/knowledge/base/children${suffix}`,
    {
      method: "GET",
    }
  );
  return data.knowledge_bases ?? [];
}

export async function deleteKnowledgeBase(knowledgeBaseId: string): Promise<void> {
  await requestJson<void>(
    `/api/knowledge/base/${encodeURIComponent(knowledgeBaseId)}`,
    {
      method: "DELETE",
    }
  );
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

export async function deleteFolder(
  folderId: string
): Promise<FolderDeleteResponse> {
  return requestJson<FolderDeleteResponse>(
    `/api/knowledge/folder/${encodeURIComponent(folderId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function moveFolder(
  folderId: string,
  input: { target_parent_folder_id?: string | null }
): Promise<FolderInfo> {
  return requestJson<FolderInfo>(
    `/api/knowledge/folder/${encodeURIComponent(folderId)}/move`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

function mapFileStatus(status?: number | null): { index_status: FileIndexStatus; progress: number } {
  switch (status) {
    case 2:
      return { index_status: "success", progress: 1 };
    case 3:
      return { index_status: "failed", progress: 0 };
    case 1:
      return { index_status: "processing", progress: 0 };
    default:
      return { index_status: "pending", progress: 0 };
  }
}

export async function fetchRootFiles(knowledgeBaseId: string): Promise<KnowledgeFile[]> {
  const data = await requestJson<FileListResponse>(
    `/api/knowledge/folder/root-files?knowledge_base_id=${encodeURIComponent(knowledgeBaseId)}`,
    {
      method: "GET",
    }
  );
  return (data.files ?? []).map((file) => ({
    ...file,
    ...mapFileStatus(file.status),
  }));
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
    ...mapFileStatus(file.status),
  }));
}

/**
 * 按文件名在指定知识库内模糊搜索文件（供 @ 文件选择器使用）。
 * q 为空时返回该知识库下的前 limit 个文件，便于无输入时直接展示候选。
 */
export async function searchFiles(input: {
  knowledgeBaseId: string;
  q?: string;
  limit?: number;
}): Promise<KnowledgeFile[]> {
  const params = new URLSearchParams({
    knowledge_base_id: input.knowledgeBaseId,
  });
  if (input.q) params.set("q", input.q);
  if (input.limit) params.set("limit", String(input.limit));
  const data = await requestJson<FileListResponse>(
    `/api/knowledge/file/search?${params.toString()}`,
    { method: "GET" }
  );
  return (data.files ?? []).map((file) => ({
    ...file,
    ...mapFileStatus(file.status),
  }));
}

export async function uploadKnowledgeFiles(input: {
  files: File[];
  knowledge_base_id: string;
  folder_id?: string | null;
  onUploadProgress?: (progress: UploadProgressEvent) => void;
}): Promise<FileUploadResponse[]> {
  if (input.files.length === 1) {
    const formData = new FormData();
    formData.append("file", input.files[0]);
    formData.append("knowledge_base_id", input.knowledge_base_id);
    if (input.folder_id) {
      formData.append("folder_id", input.folder_id);
    }

    const file = await requestJsonWithUploadProgress<FileUploadResponse>(
      "/api/knowledge/index/upload",
      {
        method: "POST",
        body: formData,
        onUploadProgress: input.onUploadProgress,
      }
    );

    return [file];
  }

  const formData = new FormData();
  input.files.forEach((file) => formData.append("files", file));
  formData.append("knowledge_base_id", input.knowledge_base_id);
  if (input.folder_id) {
    formData.append("folder_id", input.folder_id);
  }

  const data = await requestJsonWithUploadProgress<BatchFileUploadResponse>(
    "/api/knowledge/index/upload/batch",
    {
      method: "POST",
      body: formData,
      onUploadProgress: input.onUploadProgress,
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

export async function permanentlyDeleteTrashItem(item: TrashItem): Promise<void> {
  const path =
    item.item_type === "folder"
      ? `/api/knowledge/trash/folder/${encodeURIComponent(item.item_id)}`
      : `/api/knowledge/trash/file/${encodeURIComponent(item.item_id)}`;
  await requestJson<void>(path, { method: "DELETE" });
}

export async function emptyTrash(): Promise<void> {
  await requestJson<void>("/api/knowledge/trash/empty", {
    method: "DELETE",
  });
}

export async function softDeleteFile(fileId: string): Promise<FileDeleteResponse> {
  return requestJson<FileDeleteResponse>(
    `/api/knowledge/file/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function fetchFilePreview(
  fileId: string,
  expires?: number
): Promise<FilePreviewResponse> {
  const suffix = expires ? `?expires=${expires}` : "";
  return requestJson<FilePreviewResponse>(
    `/api/knowledge/file/${encodeURIComponent(fileId)}/preview${suffix}`,
    { method: "GET" }
  );
}

/**
 * 构造文件原始内容的直读 URL（走后端 /raw 流式端点）。
 *
 * 不再使用 MinIO 预签名 URL 作为 react-pdf 的数据源 —— 预签名 URL 内嵌
 * 内网域名（如 milvus-minio:9000）且为 http，浏览器既无法解析又会被
 * https 站点的混合内容策略拦截。改为由后端服务端读取对象存储并以内联
 * 方式返回，URL 落在公网 API 域名上、同协议、且通过 query token 鉴权
 * （react-pdf 无法自定义请求头）。
 */
export function buildFileRawUrl(fileId: string): string {
  const base = buildKnowledgeUrl(`/api/knowledge/file/${encodeURIComponent(fileId)}/raw`);
  const token = encodeURIComponent(getCurrentUserId());
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${token}`;
}

export async function fetchChunkImagePreview(
  chunkId: string,
  expires?: number
): Promise<ChunkImagePreviewResponse> {
  const suffix = expires ? `?expires=${expires}` : "";
  return requestJson<ChunkImagePreviewResponse>(
    `/api/knowledge/chunk/${encodeURIComponent(chunkId)}/image-preview${suffix}`,
    { method: "GET" }
  );
}

/**
 * 构造图片 chunk 原始内容的直读 URL（走后端 /raw-image 流式端点）。
 *
 * 不再使用 MinIO 预签名 URL 作为 <img> 数据源 —— 预签名 URL 内嵌
 * 内网域名（如 milvus-minio:9000）且为 http，浏览器既无法解析又会被
 * https 站点的混合内容策略拦截。改为由后端服务端读取对象存储并以内联
 * 方式返回，URL 落在公网 API 域名上、同协议、且通过 query token 鉴权
 * （<img> 无法自定义请求头）。
 */
export function buildChunkImageRawUrl(chunkId: string): string {
  const base = buildKnowledgeUrl(
    `/api/knowledge/chunk/${encodeURIComponent(chunkId)}/raw-image`
  );
  const token = encodeURIComponent(getCurrentUserId());
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${token}`;
}

export async function fetchChunkPosition(
  chunkId: string
): Promise<ChunkPositionResponse> {
  return requestJson<ChunkPositionResponse>(
    `/api/knowledge/chunk/${encodeURIComponent(chunkId)}/position`,
    { method: "GET" }
  );
}

export async function moveFile(
  fileId: string,
  targetFolderId: string | null
): Promise<void> {
  await requestJson<void>(
    `/api/knowledge/file/${encodeURIComponent(fileId)}/move`,
    {
      method: "PUT",
      body: JSON.stringify({ target_folder_id: targetFolderId }),
    }
  );
}

export async function renameFolder(
  folderId: string,
  folderName: string
): Promise<FolderInfo> {
  return requestJson<FolderInfo>(
    `/api/knowledge/folder/${encodeURIComponent(folderId)}/rename`,
    {
      method: "PUT",
      body: JSON.stringify({ folder_name: folderName }),
    }
  );
}

interface TrashFolderChildrenResponse {
  folder_id: string;
  children: TrashFolderChildItem[];
  total: number;
}

interface TrashFolderFilesResponse {
  folder_id: string;
  files: TrashFolderFileItem[];
  total: number;
}

export async function fetchTrashFolderChildren(
  folderId: string
): Promise<TrashFolderChildItem[]> {
  const data = await requestJson<TrashFolderChildrenResponse>(
    `/api/knowledge/trash/folder/${encodeURIComponent(folderId)}/children`,
    { method: "GET" }
  );
  return data.children ?? [];
}

export async function fetchTrashFolderFiles(
  folderId: string
): Promise<TrashFolderFileItem[]> {
  const data = await requestJson<TrashFolderFilesResponse>(
    `/api/knowledge/trash/folder/${encodeURIComponent(folderId)}/files`,
    { method: "GET" }
  );
  return data.files ?? [];
}
