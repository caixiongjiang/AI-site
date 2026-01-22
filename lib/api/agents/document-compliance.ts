/**
 * Document Compliance Agent API
 * 文稿检查助手 API 封装
 */

import { DocumentCheckResponse, CheckRule, MeetingRecord } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Mock 数据存储的 key
const STORAGE_KEY = "document_compliance_check_rules";

// 默认的 Mock 数据
const DEFAULT_MOCK_RULES: CheckRule[] = [
  {
    id: "mock-rule-1",
    name: "会议基本信息",
    description: "会议的基本信息字段",
    fields: [
      {
        id: "mock-field-1-1",
        name: "会议主持人",
        key: "host",
        type: "text",
        required: true,
      },
      {
        id: "mock-field-1-2",
        name: "会议记录员",
        key: "recorder",
        type: "text",
        required: true,
      },
      {
        id: "mock-field-1-3",
        name: "会议地点",
        key: "place",
        type: "text",
        required: true,
      },
    ],
  },
  {
    id: "mock-rule-2",
    name: "会议时间检查",
    description: "检查会议时长是否合理",
    fields: [
      {
        id: "mock-field-2-1",
        name: "会议时长",
        key: "meeting_duration",
        type: "numeric",
        required: false,
        validation: { max: 240 },
      },
    ],
  },
  {
    id: "mock-rule-3",
    name: "参会人员信息",
    description: "检查参会人员相关信息",
    fields: [
      {
        id: "mock-field-3-1",
        name: "实到人数",
        key: "attendees_actual",
        type: "numeric",
        required: true,
        validation: { min: 3 },
      },
      {
        id: "mock-field-3-2",
        name: "应到人数",
        key: "attendees_expected",
        type: "numeric",
        required: true,
      },
      {
        id: "mock-field-3-3",
        name: "缺席原因",
        key: "absent_reason",
        type: "text",
        required: false,
      },
    ],
  },
];

/**
 * 从 localStorage 获取检查规则（Mock 实现）
 */
function getStoredRules(): CheckRule[] {
  if (typeof window === "undefined") return DEFAULT_MOCK_RULES;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // 首次访问，存储默认数据
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_RULES));
    return DEFAULT_MOCK_RULES;
  } catch (error) {
    console.error("Failed to read from localStorage:", error);
    return DEFAULT_MOCK_RULES;
  }
}

/**
 * 保存检查规则到 localStorage（Mock 实现）
 */
function saveRulesToStorage(rules: CheckRule[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

/**
 * 获取用户的检查规则配置（Mock 实现）
 * @returns 用户的检查规则列表
 */
export async function fetchUserCheckRules(): Promise<CheckRule[]> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  try {
    const rules = getStoredRules();
    return rules;
  } catch (error) {
    console.error("Fetch check rules failed:", error);
    return DEFAULT_MOCK_RULES;
  }
}

/**
 * 创建新的检查规则（Mock 实现）
 * @param rule 检查规则
 * @returns 创建的检查规则（包含生成的ID）
 */
export async function createCheckRule(rule: Omit<CheckRule, "id">): Promise<CheckRule> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  try {
    const rules = getStoredRules();
    
    // 生成新 ID
    const newRule: CheckRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    // 保存到 localStorage
    rules.push(newRule);
    saveRulesToStorage(rules);
    
    return newRule;
  } catch (error) {
    console.error("Create check rule failed:", error);
    throw new Error("创建检查规则失败");
  }
}

/**
 * 更新检查规则（Mock 实现）
 * @param rule 检查规则
 * @returns 更新后的检查规则
 */
export async function updateCheckRule(rule: CheckRule): Promise<CheckRule> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  try {
    const rules = getStoredRules();
    const index = rules.findIndex((r) => r.id === rule.id);
    
    if (index === -1) {
      throw new Error("检查规则不存在");
    }
    
    // 更新规则
    rules[index] = rule;
    saveRulesToStorage(rules);
    
    return rule;
  } catch (error) {
    console.error("Update check rule failed:", error);
    throw new Error(error instanceof Error ? error.message : "更新检查规则失败");
  }
}

/**
 * 删除检查规则（Mock 实现）
 * @param ruleId 规则ID
 */
export async function deleteCheckRule(ruleId: string): Promise<void> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  try {
    const rules = getStoredRules();
    const filteredRules = rules.filter((r) => r.id !== ruleId);
    
    if (filteredRules.length === rules.length) {
      throw new Error("检查规则不存在");
    }
    
    saveRulesToStorage(filteredRules);
  } catch (error) {
    console.error("Delete check rule failed:", error);
    throw new Error(error instanceof Error ? error.message : "删除检查规则失败");
  }
}

export interface CheckDocumentParams {
  files: File[]; // 支持多文件
  save_to_kb?: boolean;
  mode?: "auto_check" | "export_prompt";
  check_rules?: CheckRule[]; // 自定义检查规则
}

/**
 * 检查文档合规性（支持多文件）
 * @param params 检查参数
 * @returns 检查结果
 */
export async function checkDocument(
  params: CheckDocumentParams
): Promise<DocumentCheckResponse> {
  const formData = new FormData();
  
  // 添加多个文件
  params.files.forEach((file) => {
    formData.append("files", file);
  });
  
  formData.append("save_to_kb", String(params.save_to_kb ?? false));
  formData.append("mode", params.mode ?? "auto_check");
  
  // 添加自定义检查规则
  if (params.check_rules) {
    formData.append("check_rules", JSON.stringify(params.check_rules));
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/agents/document-compliance/check`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "服务器响应错误",
      }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Document check failed:", error);
    throw error;
  }
}

/**
 * 导出 AI 提示词
 * @param record 会议记录
 * @returns 生成的提示词
 */
export async function exportPrompt(
  record: MeetingRecord
): Promise<string> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/agents/document-compliance/export-prompt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(record),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.prompt;
  } catch (error) {
    console.error("Export prompt failed:", error);
    throw error;
  }
}
