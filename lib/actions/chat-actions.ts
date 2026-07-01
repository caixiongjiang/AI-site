/**
 * 聊天动作定义
 *
 * 用户可通过 "/" 菜单触发的直接操作。
 * 与技能不同，动作由前端直接执行，不经过 LLM。
 */

import type { ActionDescriptor } from "./types";

/** 聊天动作列表 */
export const CHAT_ACTIONS: ActionDescriptor[] = [
  {
    name: "clear",
    description: "清空当前对话上下文，保留会话配置",
    icon: "Trash2",
    type: "action",
    category: "系统",
  },
  {
    name: "summary",
    description: "总结当前对话内容",
    icon: "FileText",
    type: "action",
    category: "系统",
  },
];

/**
 * 根据名称获取动作定义
 */
export function getActionByName(name: string): ActionDescriptor | undefined {
  return CHAT_ACTIONS.find((a) => a.name === name);
}

/**
 * 检查名称是否是动作
 */
export function isAction(name: string): boolean {
  return CHAT_ACTIONS.some((a) => a.name === name);
}
