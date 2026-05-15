"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

/** 引用浮层内短文：与主回答一致的 GFM + KaTeX，不含 CitationChip（避免递归） */
export function CitationPreviewMarkdown({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div
      className={cn(
        "citation-preview-md prose prose-sm max-w-none text-[11px] leading-relaxed text-gray-800",
        "prose-p:my-1 prose-headings:my-1.5 prose-headings:text-[12px]",
        "prose-pre:text-[10px] prose-pre:leading-snug"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
