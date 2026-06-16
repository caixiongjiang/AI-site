export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface KnowledgeBaseInfo {
  knowledge_base_id: string;
  knowledge_base_name: string;
  parent_knowledge_base_id?: string | null;
  knowledge_type?: string;
  description?: string | null;
}

export interface FolderInfo {
  folder_id: string;
  folder_name: string;
  full_path: string;
  parent_folder_id?: string | null;
  depth: number;
  is_default?: number;
  knowledge_base_id?: string;
  description?: string | null;
}

export interface FileInfo {
  file_id: string;
  file_name: string;
  folder_id?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  status?: number | null;
  knowledge_base_id?: string;
  description?: string | null;
}

export type FileIndexStatus = "pending" | "processing" | "success" | "failed";

export interface FileProgress {
  file_id: string;
  file_name: string;
  progress: number;
  status: FileIndexStatus;
  stage?: string | null;
  message?: string | null;
}

export interface FileDeleteResponse {
  file_id: string;
  success: boolean;
}

export interface FolderDeleteResponse {
  folder_id: string;
  deleted_folder_count: number;
  deleted_file_count: number;
}

export interface KnowledgeFile extends FileInfo {
  updated_at?: string;
  index_status?: FileIndexStatus;
  progress?: number;
}

export interface TrashItem {
  item_type: "folder" | "file";
  item_id: string;
  item_name: string;
  full_path?: string | null;
  folder_id?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  knowledge_base_id?: string;
  deleted_at?: string | null;
}

export interface TrashFolderChildItem {
  folder_id: string;
  folder_name: string;
  full_path: string;
  parent_folder_id?: string | null;
  depth?: number;
  knowledge_base_id?: string;
}

export interface TrashFolderFileItem {
  file_id: string;
  file_name: string;
  folder_id?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  knowledge_base_id?: string;
}

export interface FilePreviewResponse {
  file_id: string;
  file_name: string;
  mime_type?: string | null;
  file_size?: number | null;
  preview_url: string;
  expires_in: number;
}

export interface ChunkImagePreviewResponse {
  chunk_id: string;
  preview_url: string;
  expires_in: number;
  file_name?: string | null;
}

export interface ElementPosition {
  element_id: string;
  element_type: string;
  page_position?: number[] | null;
}

/** MinerU pipeline bbox 坐标空间：各轴 0~coord_range，左上角原点 */
export type ChunkCoordSpace = "mineru-normalized-1000";

export interface ChunkPositionResponse {
  chunk_id: string;
  chunk_type?: string | null;
  page_index?: number | null;
  /** page_position 使用的坐标空间，默认 mineru-normalized-1000 */
  coord_space?: ChunkCoordSpace | string | null;
  /** 归一化坐标轴最大值，默认 1000 */
  coord_range?: number | null;
  elements: ElementPosition[];
}
