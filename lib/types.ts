export interface Agent {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  tags: string[];
  stats: {
    users: number;
    rating: number;
  };
  featured?: boolean;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  icon: string;
  fileCount: number;
  lastUpdated: string;
}

export interface FileItem {
  id: string;
  name: string;
  icon: string;
  size: string;
  lastUpdated: string;
  kbId: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  reference?: string;
  timestamp: Date;
}

export interface MountedSource {
  name: string;
  type: "kb" | "file";
  icon: string;
}

export interface Mode {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  placeholder: string;
}

// Document Compliance Agent Types
export interface ValidationResult {
  field: string;
  is_valid: boolean;
  error_msg: string | null;
  original_value: any;
  severity?: "error" | "warning" | "success";
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MeetingRecord {
  meeting_time_start?: string;
  meeting_time_end?: string;
  attendees_expected?: number;
  attendees_actual?: number;
  absent_reason?: string;
  host?: string;
  recorder?: string;
  place?: string;
  content_body?: string;
}

export interface DocumentCheckResponse {
  success: boolean;
  record: MeetingRecord;
  validation_results: ValidationResult[];
  prompt?: string;
  image_url?: string;
  error?: string;
}

export type DocumentCheckStatus = 
  | "idle" 
  | "uploading" 
  | "parsing" 
  | "validating" 
  | "completed" 
  | "error";

// 上传的文件项
export interface UploadedFile {
  id: string;
  file: File;
  preview?: string; // 图片预览 URL
  status: "pending" | "uploading" | "completed" | "error";
  progress?: number;
}

// 检查项中的单个字段
export interface CheckField {
  id: string;
  name: string; // 字段名称，如 "主持人"
  key: string; // 字段键名，如 "host"
  type: "numeric" | "text" | "time" | "semantic";
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    semanticRequirement?: string; // 语义检查要求描述
  };
}

// 自定义检查项（包含多个字段）
export interface CheckRule {
  id: string;
  name: string; // 检查项名称
  description?: string;
  fields: CheckField[]; // 多个字段
}

// 预设检查规则
export const DEFAULT_CHECK_RULES: CheckRule[] = [
  {
    id: "rule-1",
    name: "会议基本信息",
    description: "会议的基本信息字段",
    fields: [
      {
        id: "field-1-1",
        name: "会议主持人",
        key: "host",
        type: "text",
        required: true,
      },
      {
        id: "field-1-2",
        name: "会议记录员",
        key: "recorder",
        type: "text",
        required: true,
      },
      {
        id: "field-1-3",
        name: "会议地点",
        key: "place",
        type: "text",
        required: true,
      },
    ],
  },
  {
    id: "rule-2",
    name: "会议时间检查",
    description: "检查会议时长是否合理",
    fields: [
      {
        id: "field-2-1",
        name: "会议时长",
        key: "meeting_duration",
        type: "numeric",
        required: false,
        validation: { max: 240 },
      },
    ],
  },
  {
    id: "rule-3",
    name: "参会人员信息",
    description: "检查参会人员相关信息",
    fields: [
      {
        id: "field-3-1",
        name: "实到人数",
        key: "attendees_actual",
        type: "numeric",
        required: true,
        validation: { min: 3 },
      },
      {
        id: "field-3-2",
        name: "应到人数",
        key: "attendees_expected",
        type: "numeric",
        required: true,
      },
      {
        id: "field-3-3",
        name: "缺席原因",
        key: "absent_reason",
        type: "text",
        required: false,
      },
    ],
  },
];
