"use client";

/**
 * SkillDetail — 技能详情（Markdown 渲染）
 */

import { ArrowLeft, Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillDetail as SkillDetailType } from "@/lib/api/skills";

interface SkillDetailProps {
  skill: SkillDetailType;
  onBack: () => void;
  onEdit?: (name: string) => void;
}

export function SkillDetail({ skill, onBack, onEdit }: SkillDetailProps) {
  const { descriptor: desc, body, files } = skill;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkle className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h1 className="text-2xl font-bold text-foreground">{desc.name}</h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                desc.source === "builtin"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-green-50 text-green-600"
              )}
            >
              {desc.source === "builtin" ? "内置" : "自定义"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{desc.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {desc.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        {desc.deletable && onEdit && (
          <button
            onClick={() => onEdit(desc.name)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-gray-50"
          >
            编辑
          </button>
        )}
      </div>

      {files.length > 0 && (
        <div className="mb-4 rounded-lg bg-gray-50 px-4 py-2 text-xs text-muted">
          附件：{files.join(", ")}
        </div>
      )}

      <article className="prose prose-sm max-w-none rounded-xl border border-gray-200 bg-white p-6">
        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {body}
        </pre>
      </article>
    </div>
  );
}
