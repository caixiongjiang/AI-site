/**
 * 应用配置
 * 包含 API、认证等全局配置
 */
import { getAuthSession, getAuthToken, getAuthUser } from "@/lib/auth";

// 获取 API 版本前缀（支持空字符串，自动处理斜杠）
function getApiVersion(): string {
  const version = process.env.NEXT_PUBLIC_API_VERSION;
  
  // 如果环境变量已定义
  if (typeof version !== 'undefined') {
    // 如果是空字符串，直接返回
    if (version === '') {
      return '';
    }
    // 确保以 / 开头
    return version.startsWith('/') ? version : `/${version}`;
  }
  
  // 默认值
  return "/api/v1";
}

// API 配置
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "",
  VERSION: getApiVersion(),
  TIMEOUT: 30000, // 30 秒超时
};

// 认证配置
export const AUTH_CONFIG = {
  COOKIE_NAME: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || "ai_site_auth_token",
  MOCK_USER_ID: process.env.NEXT_PUBLIC_MOCK_USER_ID || "user_demo_001",
};

function resolveUserId(): string | null {
  const sessionUser = getAuthSession()?.user;
  if (sessionUser?.id) return sessionUser.id;
  if (sessionUser?.user_id) return sessionUser.user_id;
  if (sessionUser?.sub) return sessionUser.sub;

  const authUser = getAuthUser();
  if (authUser?.id) return authUser.id;
  if (authUser?.user_id) return authUser.user_id;
  if (authUser?.sub) return authUser.sub;

  return null;
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(): string {
  return resolveUserId() || AUTH_CONFIG.MOCK_USER_ID;
}

/**
 * 获取 API 请求的通用请求头
 */
export function getCommonHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-User-Id": getCurrentUserId(),
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
