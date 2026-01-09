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
