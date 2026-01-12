/**
 * Document Compliance Agent API
 * 文稿检查助手 API 封装
 */

import { DocumentCheckResponse, CheckRule, MeetingRecord } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
