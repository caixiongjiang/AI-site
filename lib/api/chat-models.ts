/**
 * 知识库对话 — 模型选择器 API
 *
 * 后端契约：`GET /api/chat/models` → ApiResponse<{ models: ChatModelItem[] }>
 *
 * 关键点：
 * - 前端只关心 `id / label / provider`；后端不会下发能力 / 价格 / preset 等字段
 * - 返回结果按 (provider asc, label asc) 已在后端排好序
 * - 失败时调用方应当回退到本地兜底（fallbackChatModels），保证下拉不会空
 */

import { useEffect, useRef, useState } from "react";

import { API_CONFIG, getCommonHeaders } from "@/lib/config";
import type { ApiResponse } from "@/lib/knowledge-types";

const CHAT_API_PREFIX = process.env.NEXT_PUBLIC_CHAT_API_PREFIX ?? "";

/** 与后端 `ChatModelItem` 对齐 */
export interface ChatModelItem {
  /** LiteLLM 模型字符串（同时是 chat WebSocket `model` 字段的入参） */
  id: string;
  /** UI 友好名（去掉 provider 前缀） */
  label: string;
  /** Provider 名（用于按 provider 分组） */
  provider: string;
  /** 模型是否支持思考链 / reasoning（前端据此控制 ThinkingChip 显隐） */
  supports_thinking?: boolean;
  /** 模型是否支持多模态读图（前端据此控制多模态 Chip 显隐） */
  supports_multimodal?: boolean;
}

export interface ChatModelListPayload {
  models: ChatModelItem[];
}

function buildHeaders(): HeadersInit {
  const defaults = getCommonHeaders();
  const next: Record<string, string> = {
    "Content-Type": defaults["Content-Type"],
  };
  if (defaults["X-User-Id"]) next["X-User-Id"] = defaults["X-User-Id"];
  if (defaults.Authorization) next.Authorization = defaults.Authorization;
  return next;
}

function buildUrl(path: string): string {
  return `${API_CONFIG.BASE_URL}${CHAT_API_PREFIX}${path}`;
}

/**
 * 拉取当前 LiteLLM Proxy 路由的全部 chat 模型。
 *
 * @param signal AbortSignal - 调用方组件卸载时取消请求
 * @returns 排序后的模型列表（provider 升序、同 provider 内 label 升序）
 * @throws 请求非 2xx / 解析失败时抛错；调用方应自行兜底
 */
export async function fetchChatModels(
  signal?: AbortSignal,
): Promise<ChatModelItem[]> {
  const response = await fetch(buildUrl("/api/chat/models"), {
    method: "GET",
    headers: buildHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`fetchChatModels HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text) {
    return [];
  }
  let payload: ApiResponse<ChatModelListPayload> | ChatModelListPayload;
  try {
    payload = JSON.parse(text) as
      | ApiResponse<ChatModelListPayload>
      | ChatModelListPayload;
  } catch {
    throw new Error("fetchChatModels 响应解析失败");
  }
  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as ApiResponse<ChatModelListPayload>).data
      : (payload as ChatModelListPayload);
  return data?.models ?? [];
}

/**
 * 离线兜底：当 `/api/chat/models` 不可达时使用。
 *
 * 这份列表与后端 `[llm.presets.*]` 的常见模型保持一致；不要求精确，
 * 仅保证用户在断网 / 接口失败时仍能选到一个常用模型继续对话。
 */
export const fallbackChatModels: ChatModelItem[] = [
  { id: "openai/gpt-4o-mini", label: "gpt-4o-mini", provider: "openai" },
  { id: "openai/gpt-4o", label: "gpt-4o", provider: "openai" },
  { id: "deepseek/deepseek-chat", label: "deepseek-chat", provider: "deepseek" },
  {
    id: "deepseek/deepseek-reasoner",
    label: "deepseek-reasoner",
    provider: "deepseek",
    supports_thinking: true,
  },
  { id: "anthropic/claude-3-5-sonnet", label: "claude-3-5-sonnet", provider: "anthropic" },
  { id: "qwen/qwen-plus", label: "qwen-plus", provider: "qwen" },
  {
    id: "litellm_proxy/qwen3.6-flash",
    label: "qwen3.6-flash",
    provider: "litellm_proxy",
    supports_multimodal: true,
  },
];

/** 按 provider 分组（保持后端给出的排序） */
export function groupChatModelsByProvider(
  items: ChatModelItem[],
): Array<{ provider: string; items: ChatModelItem[] }> {
  const map = new Map<string, ChatModelItem[]>();
  for (const it of items) {
    const list = map.get(it.provider) ?? [];
    list.push(it);
    map.set(it.provider, list);
  }
  return Array.from(map.entries()).map(([provider, items]) => ({
    provider,
    items,
  }));
}

// ---------------------------------------------------------------------------
// React 共享 Hook：模型清单
// ---------------------------------------------------------------------------

export interface UseChatModelsResult {
  models: ChatModelItem[];
  loading: boolean;
  /** 是否走了离线兜底（接口失败 / 返回空时为 true） */
  errored: boolean;
}

/**
 * 拉取并缓存 chat 模型清单（页面级单例）。
 *
 * - 进程内只发一次请求；多个 Hook 调用方共用同一份 promise。
 * - 接口未返回前先以 `fallbackChatModels` 占位，保证 UI 有可选项 / 第一项可作默认。
 * - 拉取失败时降级为兜底列表，UI 可继续工作。
 */
let _modelsPromise: Promise<ChatModelItem[]> | null = null;

function ensureChatModelsPromise(): Promise<ChatModelItem[]> {
  if (!_modelsPromise) {
    _modelsPromise = fetchChatModels()
      .then((items) => (items.length > 0 ? items : fallbackChatModels))
      .catch(() => fallbackChatModels);
  }
  return _modelsPromise;
}

export function useChatModels(): UseChatModelsResult {
  // 关键：初始值必须为空数组，**不能**是 fallback 列表。
  // 否则 panel 的 settings 同步效果会先用 fallback 的第一项做默认，
  // 等真清单回包时 prev.model 已被锁成 fallback 项（典型 bug：用户的 proxy
  // 上根本没有 openai/gpt-4o-mini，但 chip 默认显示了它）。
  // 模型清单一般 <100ms 就到，期间 chip 会显示"选择模型"占位，可接受。
  const [models, setModels] = useState<ChatModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    ensureChatModelsPromise()
      .then((items) => {
        if (cancelledRef.current) return;
        setModels(items);
        // 当前模块的 ensure 总会兜底，无法直接区分"成功但空"和"失败"；
        // 这里通过"是否退化到 fallback 引用"近似判断
        setErrored(items === fallbackChatModels);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return { models, loading, errored };
}

/** 测试 / 调试用：清空内部缓存，下次调用 useChatModels 会重新拉取 */
export function _resetChatModelsCacheForTest(): void {
  _modelsPromise = null;
}
