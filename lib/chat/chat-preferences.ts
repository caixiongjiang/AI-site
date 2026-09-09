/**
 * 设置页与对话面板共享的本地偏好。
 * 仅浏览器 localStorage，不写后端。
 */

export const CHAT_PREF_KEYS = {
  SEND_SHORTCUT: "chat-send-shortcut",
  DEFAULT_MODEL: "knowledge-chat-last-model",
  DEFAULT_THINKING_LEVEL: "knowledge-chat-last-thinking-level",
  ENABLE_ROUTE_PLAN: "knowledge-chat-enable-route-plan",
} as const;

function readPref(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  if (typeof window === "undefined" || !value) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

export function getSettingsDefaultModel(): string | null {
  return readPref(CHAT_PREF_KEYS.DEFAULT_MODEL);
}

export function setSettingsDefaultModel(modelId: string): void {
  writePref(CHAT_PREF_KEYS.DEFAULT_MODEL, modelId);
}

export function getSettingsDefaultThinkingLevel(): string | null {
  return readPref(CHAT_PREF_KEYS.DEFAULT_THINKING_LEVEL);
}

export function setSettingsDefaultThinkingLevel(level: string): void {
  writePref(CHAT_PREF_KEYS.DEFAULT_THINKING_LEVEL, level);
}

export function getSendShortcut(): "enter" | "cmd-enter" | null {
  const raw = readPref(CHAT_PREF_KEYS.SEND_SHORTCUT);
  return raw === "cmd-enter" || raw === "enter" ? raw : null;
}

export function setSendShortcut(shortcut: "enter" | "cmd-enter"): void {
  writePref(CHAT_PREF_KEYS.SEND_SHORTCUT, shortcut);
}

export function getSettingsEnableRoutePlan(): boolean {
  const raw = readPref(CHAT_PREF_KEYS.ENABLE_ROUTE_PLAN);
  return raw === "true";
}

export function setSettingsEnableRoutePlan(enable: boolean): void {
  writePref(CHAT_PREF_KEYS.ENABLE_ROUTE_PLAN, String(enable));
}

/** 设置页默认模型若仍在当前清单中则用之，否则回落列表第一项。 */
export function pickSettingsDefaultModel(models: { id: string }[]): string {
  const saved = getSettingsDefaultModel();
  if (saved && models.some((m) => m.id === saved)) return saved;
  return models[0]?.id ?? "";
}
