import { SlidersHorizontal, Wand2, type LucideIcon } from "lucide-react";

/** 交互模式：Agent（工具循环）/ Plan（先规划再执行） */
export type InteractionMode = "agent" | "plan";

export const INTERACTION_MODE_OPTIONS: Array<{
  key: InteractionMode;
  icon: LucideIcon;
  label: string;
  desc: string;
  /** Slash 菜单等场景的图标色 */
  iconClassName: string;
}> = [
  {
    key: "agent",
    icon: Wand2,
    label: "Agent",
    desc: "可调用检索/工具补全上下文",
    iconClassName: "text-primary",
  },
  {
    key: "plan",
    icon: SlidersHorizontal,
    label: "Plan",
    desc: "先规划检索与回答步骤，再执行",
    iconClassName: "text-amber-600",
  },
];

/** 从 session 还原前端交互模式；后端 mode 字符串 → 前端 InteractionMode */
export function interactionModeFromSession(mode: string | null | undefined): InteractionMode {
  return mode === "plan" ? "plan" : "agent";
}

/** 发送到后端的 mode 字符串（Plan 模式后端尚未独立，暂与 Agent 相同执行路径） */
export function modeFromInteraction(mode: InteractionMode): string {
  return mode === "plan" ? "plan" : "agent";
}
