"use client";

/**
 * MentionComposer — 支持原子 @ pill 的富文本输入框（Cursor 式 @）
 *
 * 设计（Cursor 式内联 token）：
 * - 使用 contenteditable，把 @ 文件/目录、/ 技能都渲染成「原子 pill」（contentEditable=false 的 span）：
 *   无边框、与正文同字号；整颗删除、不可被部分编辑、可在文本任意位置插入、可多个，混在自然语言里。
 *   （@ 文件=图标+名称，青色；/ 技能=`/技能名`，橙色。）
 * - DOM 即数据源：每次变更序列化出 { text, mentions, skills, atQuery, slashQuery } 通过 onChange 透出。
 *   - text：纯文本（@ pill 序列化为 `@标签`，/ skill pill 不进文本，<br> 序列化为换行），用于显示/持久化/发送。
 *   - mentions / skills：有序列表；删除 pill 即自动消失；**均不限次数、可重复**。
 *   - atQuery / slashQuery：基于「光标位置」算出的触发词（null=未触发），`/` 不限行首。
 * - 通过 ref 暴露命令式方法：focus / clear / insertMention / insertSkill / removeSkill /
 *   removeSlashTrigger / getText / getMentions / getSkills。
 * - skill pill：仅 Backspace 原子删除；点击无交互（不可编辑、无链接）。
 *
 * 键位：
 * - 先把 keydown 交给父组件路由给浮层菜单（方向键/Enter/Esc 选中）；菜单消费后 return。
 * - 未被消费时：Enter 发送、Shift+Enter 换行、Backspace 原子删除紧邻的 pill。
 * - IME 组合中（isComposing）不触发发送。
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { AtMention } from "@/components/knowledge/AtFileMentionMenu";

export interface MentionComposerHandle {
  focus: () => void;
  clear: () => void;
  /** 在当前 @ 触发处（光标处）插入一颗 pill，并移除已敲入的 `@关键字` */
  insertMention: (mention: AtMention) => void;
  /** 在光标处插入内联 skill pill（移除 `/` 触发词） */
  insertSkill: (name: string) => void;
  /** 按名称移除内联 skill pill */
  removeSkill: (name: string) => void;
  /** 移除行首 `/` 触发词（含已输入的过滤关键字），Slash 菜单选中后调用 */
  removeSlashTrigger: () => void;
  getText: () => string;
  getMentions: () => AtMention[];
  /** 当前编辑器内联 skill pill 的技能名列表 */
  getSkills: () => string[];
  /** 布局切换后强制重新测量行数 */
  remeasure: () => void;
}

interface ComposerState {
  text: string;
  mentions: AtMention[];
  /** 内联 skill pill 的技能名列表（有序，删除 pill 即自动消失） */
  skills: string[];
  atQuery: string | null;
  /** 基于光标位置的 `/` 触发词（null=未触发；""=刚敲下/；非空=过滤词） */
  slashQuery: string | null;
  /** 当前编辑器内容占用的视觉行数（用于父组件判断单/多行布局） */
  lineCount: number;
  /** 编辑器 innerHTML（用于单行宽度折行探测） */
  editorHtml: string;
  /** 编辑器当前 clientWidth */
  editorWidth: number;
}

interface MentionComposerProps {
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** 内容/光标变化回调（带 signature 去重，不会无脑刷新） */
  onChange: (state: ComposerState) => void;
  /** 把原始 keydown 先给父组件（路由浮层菜单）；父组件消费后应 preventDefault */
  onMenuKeyDown?: (e: React.KeyboardEvent) => void;
  /** Enter（非 Shift、非 IME、菜单未消费）触发 */
  onSubmit?: () => void;
  /** 单行紧凑模式：固定 h-7，避免空内容撑高 */
  compact?: boolean;
}

const NBSP = "\u00A0";

/** 测量 contenteditable 当前占用的视觉行数 */
function measureLineCount(el: HTMLElement): number {
  const text = (el.textContent ?? "").replace(/\u00A0/g, " ");
  const hasPill = el.querySelector("[data-mention-id],[data-skill-name]");
  if (!text.trim() && !hasPill) return 1;

  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return 1;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const contentHeight = el.scrollHeight - paddingTop - paddingBottom;
  return Math.max(1, Math.round(contentHeight / lineHeight));
}

/** 递归把编辑器 DOM 序列化为 { text, mentions, skills }
 *
 * - @ 文件/目录 pill → 文本里序列化为 `@标签`，并进 mentions；
 * - / skill pill     → **不进文本**（skill 由 forced_skill_names 单独透传），只进 skills；
 * - <br> → 换行。
 */
function serialize(root: Node): {
  text: string;
  mentions: AtMention[];
  skills: string[];
} {
  let text = "";
  const mentions: AtMention[] = [];
  const skills: string[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset.mentionId) {
      const mention: AtMention = {
        kind: (el.dataset.mentionKind as "file" | "folder") ?? "file",
        id: el.dataset.mentionId,
        label: el.dataset.mentionLabel ?? "",
        indexed: el.dataset.mentionIndexed === "true",
      };
      mentions.push(mention);
      text += `@${mention.label}`;
      return;
    }
    if (el.dataset.skillName) {
      // skill pill 不参与文本（避免污染发送/持久化的 query）
      skills.push(el.dataset.skillName);
      return;
    }
    if (el.tagName === "BR") {
      text += "\n";
      return;
    }
    // 兜底：粘贴 / 浏览器自动包裹的块级元素，按换行边界处理后递归
    if (el.tagName === "DIV" && text && !text.endsWith("\n")) {
      text += "\n";
    }
    const sub = serialize(el);
    text += sub.text;
    mentions.push(...sub.mentions);
    skills.push(...sub.skills);
  });
  return { text, mentions, skills };
}

/** 基于当前光标算出 @ 触发词 */
function computeAtQuery(editor: HTMLElement): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const node = sel.anchorNode;
  if (!node || !editor.contains(node)) return null;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const before = (node.textContent ?? "").slice(0, sel.anchorOffset);
  // 触发条件：行首 / 空白 / nbsp 后的 `@` + 不含空白和 @ 的词
  const m = before.match(/(?:^|\s|\u00A0)@([^\s@\u00A0]*)$/);
  return m ? m[1] : null;
}

/** 基于当前光标算出 `/` 触发词（可在任意位置，不限行首） */
function computeSlashQuery(editor: HTMLElement): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const node = sel.anchorNode;
  if (!node || !editor.contains(node)) return null;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const before = (node.textContent ?? "").slice(0, sel.anchorOffset);
  const m = before.match(/(?:^|\s|\u00A0)\/([^\s/]*)$/);
  return m ? m[1] : null;
}

/** 从光标处删除 `/` 触发词（含已输入的过滤关键字） */
function removeSlashTriggerAtCursor(editor: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const node = sel.anchorNode;
  if (!node || !editor.contains(node) || node.nodeType !== Node.TEXT_NODE) {
    return false;
  }
  const content = node.textContent ?? "";
  const offset = sel.anchorOffset;
  const before = content.slice(0, offset);
  const m = before.match(/(?:^|\s|\u00A0)(\/[^\s/]*)$/);
  if (!m) return false;
  const triggerLen = m[1].length;
  const startIdx = offset - triggerLen;
  const del = document.createRange();
  del.setStart(node, startIdx);
  del.setEnd(node, offset);
  del.deleteContents();
  return true;
}

/** 转义 HTML 特殊字符（用于把标签写进 innerHTML） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 内联图标（lucide 路径），1em × 1em，与正文行高对齐
const FILE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" ' +
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" class="shrink-0">' +
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
  '<path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
const FOLDER_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" ' +
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" class="shrink-0">' +
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 ' +
  '0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';

const PILL_LEADING_SLOT =
  "relative inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em] overflow-hidden";

function placeCursorAfter(node: Node): void {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.setStartAfter(node);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

const PILL_REMOVE_BTN =
  '<button type="button" tabindex="-1" data-pill-remove ' +
  'class="pill-remove-btn absolute inset-0 inline-flex items-center justify-center ' +
  'rounded text-[0.85em] leading-none opacity-0 transition-opacity ' +
  'group-hover:opacity-100 hover:bg-black/10" aria-label="移除">×</button>';

/** 删除 pill 并清理其后的 nbsp 空格 */
function removePillElement(pill: HTMLElement): void {
  const next = pill.nextSibling;
  if (
    next &&
    next.nodeType === Node.TEXT_NODE &&
    next.textContent === NBSP
  ) {
    next.parentNode?.removeChild(next);
  }
  pill.remove();
}

/** @ 文件/目录 pill：hover 时 × 叠在图标位，布局不跳动 */
function buildPill(mention: AtMention): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.mentionId = mention.id;
  span.dataset.mentionKind = mention.kind;
  span.dataset.mentionLabel = mention.label;
  span.dataset.mentionIndexed = String(mention.indexed);
  span.contentEditable = "false";
  span.setAttribute("data-mention", "true");
  const unindexedFile = mention.kind === "file" && !mention.indexed;
  span.className = cn(
    "mention-token group mx-0.5 inline max-w-[240px] align-baseline",
    "text-sm leading-[inherit] whitespace-nowrap",
    unindexedFile ? "text-amber-600" : "text-teal-700"
  );
  span.setAttribute(
    "aria-label",
    unindexedFile
      ? `${mention.label}（未完成索引）`
      : `${mention.kind === "folder" ? "目录" : "文件"}：${mention.label}`,
  );
  const icon = mention.kind === "folder" ? FOLDER_ICON_SVG : FILE_ICON_SVG;
  span.innerHTML =
    `<span class="${PILL_LEADING_SLOT}">` +
    `<span class="pill-icon absolute inset-0 inline-flex items-center justify-center transition-opacity group-hover:opacity-0">${icon}</span>` +
    `${PILL_REMOVE_BTN}</span>` +
    `<span class="inline truncate group-hover:underline">${escapeHtml(mention.label)}</span>`;
  return span;
}

/** / skill pill：不可点击编辑，仅 Backspace 删除 */
function buildSkillPill(name: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.skillName = name;
  span.contentEditable = "false";
  span.setAttribute("data-skill", "true");
  span.className = cn(
    "skill-token mx-0.5 inline max-w-[240px] cursor-default select-none align-baseline",
    "text-sm leading-[inherit] whitespace-nowrap text-orange-500"
  );
  span.setAttribute("aria-label", `技能：${name}`);
  span.textContent = `/${name}`;
  return span;
}

export const MentionComposer = forwardRef<
  MentionComposerHandle,
  MentionComposerProps
>(function MentionComposer(
  { disabled, placeholder, className, onChange, onMenuKeyDown, onSubmit, compact },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  // 去重：只有 text / mentions / atQuery 真正变化才回调父组件
  const lastSigRef = useRef<string>("");
  // 保存最新 onChange，避免 selectionchange 监听里闭包过期
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const { text, mentions, skills } = serialize(editor);
    const cleanText = text.replace(/\u00A0/g, " ");
    const atQuery = computeAtQuery(editor);
    const slashQuery = computeSlashQuery(editor);
    const lineCount = measureLineCount(editor);
    setIsEmpty(
      cleanText.trim() === "" && mentions.length === 0 && skills.length === 0
    );
    const sig = JSON.stringify({
      t: cleanText,
      m: mentions.map((x) => `${x.kind}:${x.id}`),
      s: skills,
      q: atQuery,
      sq: slashQuery,
      lc: lineCount,
      w: editor.clientWidth,
    });
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    onChangeRef.current({
      text: cleanText,
      mentions,
      skills,
      atQuery,
      slashQuery,
      lineCount,
      editorHtml: editor.innerHTML,
      editorWidth: editor.clientWidth,
    });
  }, []);

  // 监听全局 selectionchange，用于在光标移动时刷新 atQuery（带去重，不会抖动）
  useEffect(() => {
    const handler = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!editor.contains(sel.anchorNode)) return;
      emit();
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [emit]);

  const insertMention = useCallback(
    (mention: AtMention) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        // 没有有效光标：直接追加到末尾
        editor.appendChild(buildPill(mention));
        editor.appendChild(document.createTextNode(NBSP));
        emit();
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      // 若光标在文本节点里，移除已敲入的 `@关键字`
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent ?? "";
        const before = content.slice(0, offset);
        const m = before.match(/(?:^|\s|\u00A0)@([^\s@\u00A0]*)$/);
        const triggerLen = m ? m[1].length + 1 : 0; // +1 为 '@'
        const startIdx = offset - triggerLen;
        const del = document.createRange();
        del.setStart(node, startIdx);
        del.setEnd(node, offset);
        del.deleteContents();
        const insert = document.createRange();
        insert.setStart(node, startIdx);
        insert.collapse(true);
        const space = document.createTextNode(NBSP);
        insert.insertNode(space);
        insert.insertNode(buildPill(mention));
        // 光标移到空格之后
        const after = document.createRange();
        after.setStartAfter(space);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      } else {
        // 光标在元素节点：直接在 range 处插入
        range.deleteContents();
        const space = document.createTextNode(NBSP);
        range.insertNode(space);
        range.insertNode(buildPill(mention));
        const after = document.createRange();
        after.setStartAfter(space);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
      }
      emit();
    },
    [emit]
  );

  const removeSlashTrigger = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!removeSlashTriggerAtCursor(editor)) return;
    lastSigRef.current = "";
    editor.focus();
    emit();
  }, [emit]);

  // 在光标处插入 skill pill（移除 `/` 触发词）
  const insertSkill = useCallback(
    (name: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      const sel = window.getSelection();
      const pill = buildSkillPill(name);
      const space = document.createTextNode(NBSP);

      if (!sel || sel.rangeCount === 0) {
        editor.appendChild(pill);
        editor.appendChild(space);
        lastSigRef.current = "";
        emit();
        return;
      }

      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent ?? "";
        const before = content.slice(0, offset);
        const m = before.match(/(?:^|\s|\u00A0)(\/[^\s/]*)$/);
        const triggerLen = m ? m[1].length : 0;
        const startIdx = offset - triggerLen;
        const del = document.createRange();
        del.setStart(node, startIdx);
        del.setEnd(node, offset);
        del.deleteContents();
        const insert = document.createRange();
        insert.setStart(node, startIdx);
        insert.collapse(true);
        insert.insertNode(space);
        insert.insertNode(pill);
        placeCursorAfter(space);
      } else {
        range.deleteContents();
        range.insertNode(space);
        range.insertNode(pill);
        placeCursorAfter(space);
      }
      lastSigRef.current = "";
      emit();
    },
    [emit]
  );

  // 按名称移除内联 skill pill（同名可多个，此处移除全部；配置菜单取消时用）
  const removeSkill = useCallback(
    (name: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      let removed = false;
      editor.querySelectorAll("[data-skill-name]").forEach((n) => {
        if ((n as HTMLElement).dataset.skillName !== name) return;
        removePillElement(n as HTMLElement);
        removed = true;
      });
      if (!removed) return;
      lastSigRef.current = "";
      emit();
    },
    [emit]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.focus(),
      clear: () => {
        if (editorRef.current) editorRef.current.innerHTML = "";
        lastSigRef.current = "";
        setIsEmpty(true);
        emit();
      },
      insertMention,
      insertSkill,
      removeSkill,
      removeSlashTrigger,
      getText: () => {
        const editor = editorRef.current;
        if (!editor) return "";
        return serialize(editor).text.replace(/\u00A0/g, " ");
      },
      getMentions: () => {
        const editor = editorRef.current;
        if (!editor) return [];
        return serialize(editor).mentions;
      },
      getSkills: () => {
        const editor = editorRef.current;
        if (!editor) return [];
        return serialize(editor).skills;
      },
      remeasure: () => emit(),
    }),
    [emit, insertMention, insertSkill, removeSkill, removeSlashTrigger]
  );

  // 退格：原子删除紧邻光标左侧的 pill
  const tryDeleteAdjacentPill = useCallback((): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    const offset = sel.anchorOffset;
    if (!node) return false;

    const isPill = (n: Node | null): n is HTMLElement =>
      !!n &&
      n.nodeType === Node.ELEMENT_NODE &&
      ((n as HTMLElement).dataset.mentionId !== undefined ||
        (n as HTMLElement).dataset.skillName !== undefined);

    let target: HTMLElement | null = null;
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent ?? "";
      // 光标在 pill 后的 spacer 之后：一次 Backspace 删除 pill，保留后续输入
      if (
        offset > 0 &&
        isPill(node.previousSibling) &&
        content.slice(0, offset).replace(/\u00A0/g, " ").trim() === ""
      ) {
        const pill = node.previousSibling as HTMLElement;
        const rest = content.slice(offset);
        pill.remove();
        if (rest) {
          (node as Text).textContent = rest;
        } else {
          node.parentNode?.removeChild(node);
        }
        emit();
        return true;
      }
      // 光标在文本最前端，且其前一个兄弟是 pill
      if (offset === 0 && isPill(node.previousSibling)) {
        target = node.previousSibling as HTMLElement;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const prev = el.childNodes[offset - 1] ?? null;
      if (isPill(prev)) target = prev as HTMLElement;
    }
    if (!target) return false;
    removePillElement(target);
    emit();
    return true;
  }, [emit]);

  // 文件 pill hover × 删除；skill pill 点击无交互
  const handleEditorMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const skillPill = (e.target as HTMLElement).closest("[data-skill-name]");
      if (skillPill && editorRef.current?.contains(skillPill)) {
        e.preventDefault();
        return;
      }

      const btn = (e.target as HTMLElement).closest("[data-pill-remove]");
      if (!btn) return;
      e.preventDefault();
      const pill = btn.closest("[data-mention-id]") as HTMLElement | null;
      if (!pill) return;
      removePillElement(pill);
      lastSigRef.current = "";
      emit();
      editorRef.current?.focus();
    },
    [emit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 0) IME 组合中：方向键/Enter 交给输入法选词，既不路由菜单也不发送
      if (e.nativeEvent.isComposing) return;
      // 1) 先给父组件路由浮层菜单（方向键 / Enter / Esc 选中）
      onMenuKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertLineBreak");
        emit();
        return;
      }
      if (e.key === "Backspace") {
        if (tryDeleteAdjacentPill()) {
          e.preventDefault();
        }
      }
    },
    [onMenuKeyDown, onSubmit, emit, tryDeleteAdjacentPill]
  );

  // 粘贴：只取纯文本，避免引入嵌套块级元素
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emit();
    },
    [emit]
  );

  return (
    <div className={cn("relative w-full", compact && "h-7", className)}>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onMouseDown={handleEditorMouseDown}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={cn(
          "block w-full whitespace-pre-wrap break-words text-sm text-foreground outline-none",
          compact
            ? "h-7 min-h-0 overflow-hidden py-0 leading-7"
            : "max-h-40 min-h-[20px] overflow-y-auto leading-5",
          disabled && "cursor-not-allowed text-muted"
        )}
      />
      {isEmpty && placeholder ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 select-none truncate text-sm text-muted",
            compact ? "flex items-center leading-7" : "leading-5"
          )}
        >
          {placeholder}
        </div>
      ) : null}
    </div>
  );
});
