/**
 * 思考强度档位（pi 风格的标准 7 档词汇）。
 *
 * 后端 `config/thinking_models.json` 为每个模型声明它支持哪些档位、以及档位到
 * 厂商原生 `reasoning_effort` 字符串的映射。前端只消费后端下发的
 * `ChatModelItem.thinking_levels`（已是该模型支持的子集），这里仅提供统一的
 * 中文展示标签与顺序，用于渲染档位下拉。
 */

/** pi 标准 7 档（从低到高） */
export const EXTENDED_THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ThinkingLevel = (typeof EXTENDED_THINKING_LEVELS)[number];

/** 档位 → UI 中文标签 */
export const THINKING_LEVEL_LABELS: Record<string, string> = {
  off: "关闭",
  minimal: "极低",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "极高",
  max: "最高",
};

/** 档位 → 一句话说明（title/aria 用） */
export const THINKING_LEVEL_DESCS: Record<string, string> = {
  off: "不下发思考参数（模型按默认不思考）",
  minimal: "极轻量思考",
  low: "低强度思考",
  medium: "中等强度思考（推荐）",
  high: "高强度思考",
  xhigh: "极高强度思考（耗时更长）",
  max: "最高强度思考（最耗时）",
};

/** 模型只支持思考开关（off + 恰好一个开档，通常是 medium）。 */
export function isSwitchOnlyThinking(levels?: string[] | null): boolean {
  const list = levels ?? [];
  const onLevels = list.filter((l) => l && l !== "off");
  return list.includes("off") && onLevels.length === 1;
}

/** 模型支持思考强度（至少两个非 off 档）。 */
export function isEffortThinking(levels?: string[] | null): boolean {
  const list = levels ?? [];
  return list.filter((l) => l && l !== "off").length > 1;
}

/** 开关模型的「开」档；强度模型返回第一个非 off 档。 */
export function getOnThinkingLevel(levels?: string[] | null): string {
  return (levels ?? []).find((l) => l && l !== "off") || "medium";
}

/** 给定模型支持的档位列表与当前档位，返回归位后的合法档位（与后端 clamp 一致）。 */
export function clampThinkingLevel(
  supported: string[] | undefined,
  level: string,
): string {
  const available = supported && supported.length > 0 ? supported : ["off"];
  if (available.includes(level)) return level;
  const idx = EXTENDED_THINKING_LEVELS.indexOf(level as ThinkingLevel);
  if (idx >= 0) {
    for (let i = idx; i < EXTENDED_THINKING_LEVELS.length; i++) {
      if (available.includes(EXTENDED_THINKING_LEVELS[i])) {
        return EXTENDED_THINKING_LEVELS[i];
      }
    }
    for (let i = idx - 1; i >= 0; i--) {
      if (available.includes(EXTENDED_THINKING_LEVELS[i])) {
        return EXTENDED_THINKING_LEVELS[i];
      }
    }
  }
  return available[0] ?? "off";
}
