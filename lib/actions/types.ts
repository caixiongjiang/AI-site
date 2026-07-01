/**
 * 动作（Action）类型定义
 *
 * 动作是用户可通过 "/" 菜单触发的直接操作，与技能（Skill）不同：
 * - 技能：注入 system prompt，由 LLM 执行
 * - 动作：前端直接执行，不经过 LLM
 */

/** 动作类型 */
export type ActionType = "action";

/** 动作定义 */
export interface ActionDescriptor {
  /** 动作名称（唯一标识，kebab-case） */
  name: string;
  /** 动作描述（显示在 "/" 菜单中） */
  description: string;
  /** 图标名称（lucide-react 图标名） */
  icon: string;
  /** 类型标识，用于区分技能和动作 */
  type: ActionType;
  /** 分类标签 */
  category: string;
}

/** 动作执行上下文 */
export interface ActionContext {
  /** 当前会话 ID */
  sessionId: string | null;
  /** 清空消息回调 */
  onClearMessages: () => Promise<void>;
  /** 发送消息回调（用于总结对话） */
  onSendMessage: (content: string) => Promise<void>;
}

/** 菜单项类型（技能或动作） */
export type MenuItem =
  | {
      kind: "skill";
      name: string;
      description: string;
      category: string;
      source: "builtin" | "custom";
    }
  | {
      kind: "action";
      name: string;
      description: string;
      category: string;
      icon: string;
    };
