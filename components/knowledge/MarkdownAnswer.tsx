"use client";

/**
 * MarkdownAnswer - 助手消息正文渲染
 *
 * 在 react-markdown 之上叠加两件事：
 *   1. LaTeX：通过 `remark-math` + `rehype-katex` 支持 $...$ 与 $$...$$
 *      （equation 类型的 chunk 在后端被切成 text + LaTeX 语法，这里就能渲染）。
 *   2. 内联引用：扫描所有文本节点中的引用占位符，替换为 `<CitationChip />`。
 *
 * 引用占位符支持两种格式（同时识别，方便从 Phase A 过渡到 Phase B）：
 *   - Phase B（首选）：`[cN]` 短 alias，例如 `[c1]` `[c12]`。后端 prompt 强制
 *     LLM 用这种形式；token 省、不容易被截断。alias 在每条 message.citations
 *     里通过 `citation.alias` 字段携带。
 *   - Phase A（兼容）：`[chunk-<uuid>]` 完整 chunk_id。老会话回放或新模型偶发
 *     时仍能识别；按 citation.chunk_id 直接匹配。
 *
 * 设计要点：
 * - 渲染期间用 useMemo 预建两个查表：alias→citation 和 chunkId→citation。
 * - 不在 markdown AST 上做 plugin，而是在 react-markdown 的 components 钩子
 *   里拦截子节点字符串（更直接、对常见 markdown 结构都生效：段落、列表、
 *   表格单元格、强调等）。
 * - 老会话没有 alias 字段时自动回退到 chunk_id 路径；都查不到则 chip 显示
 *   降级灰色"?"占位 + console.warn。
 */

import { Children, useMemo } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CitationChip } from "@/components/knowledge/CitationChip";
import type { Citation } from "@/lib/chat-types";

// 同时匹配 `[cN]` 与 `[chunk-<uuid 等价 hex 段>]`。
// - alias：`[c<纯数字>]`
// - 完整 chunk_id：`[chunk-` + 至少 8 位 hex/连字符 + `]`
const CHUNK_REF_RE = /\[(?:c\d{1,6}|chunk-[0-9a-f-]{8,})\]/gi;
const ALIAS_RE = /^c\d+$/;

interface MarkdownAnswerProps {
  content: string;
  citations?: Citation[];
}

interface CitationLookup {
  byAlias: Map<string, { index: number; citation: Citation }>;
  byChunkId: Map<string, { index: number; citation: Citation }>;
}

/** 大小写不敏感地匹配 chunk_id（防御 LLM 输出 chunk-1AD9521D 这种大写格式） */
function normalizeChunkId(s: string): string {
  return s.toLowerCase();
}

/**
 * 字符串切片：把 `[cN]` / `[chunk-xxx]` 替换为 CitationChip。
 * 同时把"陌生引用号"（在 citations 列表里查不到）也尝试渲染为降级 chip，
 * 这样 LLM 引用了一个 message.citations 里没有的引用号也不会显示原始裸文本。
 */
function splitTextToChips(
  text: string,
  lookup: CitationLookup,
  warnedUnknown: Set<string>
): ReactNode {
  if (!text || !text.includes("[")) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CHUNK_REF_RE.lastIndex = 0;

  while ((match = CHUNK_REF_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0].slice(1, -1); // 去掉 [ ]
    const key = normalizeChunkId(raw);

    // 路径 1：alias 形式（首选）
    // 路径 2：完整 chunk_id 形式（兼容老消息 / 模型偶发回退）
    const known = ALIAS_RE.test(key)
      ? lookup.byAlias.get(key)
      : lookup.byChunkId.get(key);

    let index: number | "?";
    let citation: Citation | undefined;
    if (known) {
      index = known.index;
      citation = known.citation;
    } else {
      index = "?";
      citation = undefined;
      if (!warnedUnknown.has(key)) {
        warnedUnknown.add(key);
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn(
            "[citation] LLM 引用了 message.citations 里没有的引用号:",
            raw,
            `（citations 已有 ${lookup.byAlias.size || lookup.byChunkId.size} 条）`
          );
        }
      }
    }
    parts.push(
      <CitationChip
        key={`${raw}-${match.index}`}
        index={index}
        citation={citation}
        rawChunkId={citation?.chunk_id ?? raw}
      />
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 1 ? parts[0] : parts;
}

/** 递归把 children 中的字符串节点转换为 chip 混合数组 */
function mapChildren(
  children: ReactNode,
  lookup: CitationLookup,
  warnedUnknown: Set<string>
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return splitTextToChips(child, lookup, warnedUnknown);
    }
    if (typeof child === "number") {
      return child;
    }
    return child;
  });
}

export function MarkdownAnswer({ content, citations }: MarkdownAnswerProps) {
  const lookup = useMemo<CitationLookup>(() => {
    const byAlias = new Map<string, { index: number; citation: Citation }>();
    const byChunkId = new Map<string, { index: number; citation: Citation }>();
    (citations ?? []).forEach((c, i) => {
      const entry = { index: i + 1, citation: c };
      if (c?.alias) byAlias.set(c.alias.toLowerCase(), entry);
      if (c?.chunk_id) byChunkId.set(normalizeChunkId(c.chunk_id), entry);
    });
    return { byAlias, byChunkId };
  }, [citations]);

  // 仅用于去重 console.warn；不参与渲染序号
  const warnedUnknown = useMemo(() => new Set<string>(), [lookup]);

  // react-markdown 的 components 钩子；这里覆盖所有可能携带文本的容器。
  // 注意 `code` / `pre` 不拦截（代码里出现的 [chunk-xxx] / [cN] 不应被替换）。
  const components = useMemo(() => {
    const makeTransform = (Tag: React.ElementType) => {
      const Component = (props: Record<string, unknown>) => {
        const { node: _node, children, ...rest } = props as {
          node?: unknown;
          children?: ReactNode;
        } & Record<string, unknown>;
        const transformed = mapChildren(children, lookup, warnedUnknown);
        return <Tag {...rest}>{transformed}</Tag>;
      };
      return Component;
    };

    return {
      p: makeTransform("p"),
      li: makeTransform("li"),
      td: makeTransform("td"),
      th: makeTransform("th"),
      strong: makeTransform("strong"),
      em: makeTransform("em"),
      span: makeTransform("span"),
      h1: makeTransform("h1"),
      h2: makeTransform("h2"),
      h3: makeTransform("h3"),
      h4: makeTransform("h4"),
      h5: makeTransform("h5"),
      h6: makeTransform("h6"),
    } as Record<string, React.ComponentType<Record<string, unknown>>>;
  }, [lookup, warnedUnknown]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
