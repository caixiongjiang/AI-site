"use client";

/**
 * SkillEditor — 创建/编辑自定义技能（带 SKILL.md 模板）
 */

import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const SKILL_TEMPLATE = `---
name: my-skill
description: 一句话说明技能用途（≤1024 字符，模型据此决定是否加载）
version: 1.0.0
metadata:
  tags: [tag1, tag2]
  category: custom
  # requires_tools: [search_knowledge_base]   # 可选：依赖的工具
---

# 技能标题

## When to Use
什么情况下应该加载并遵循本技能。

## Procedure
1. 第一步
2. 第二步
3. ...

## Pitfalls
- 已知坑与规避方式

## Verification
- [ ] 自检项 1
- [ ] 自检项 2
`;

interface SkillEditorProps {
  /** 编辑模式时的初始内容 */
  initialBody?: string;
  /** 编辑模式时的技能名（不可改） */
  editName?: string;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}

export function SkillEditor({
  initialBody,
  editName,
  onSave,
  onCancel,
}: SkillEditorProps) {
  const [body, setBody] = useState(initialBody ?? SKILL_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave(body);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <button
        onClick={onCancel}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {editName ? `编辑技能：${editName}` : "创建自定义技能"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            按 SKILL.md 格式编写技能内容，包含 frontmatter 和正文
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-foreground transition-colors hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !body.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="h-[60vh] w-full resize-none rounded-xl border border-gray-200 bg-white p-4 font-mono text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary"
        placeholder="粘贴 SKILL.md 内容..."
        spellCheck={false}
      />
    </div>
  );
}
