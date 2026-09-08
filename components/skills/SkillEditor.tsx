"use client";

/**
 * SkillEditor — 创建/编辑自定义技能（封面上传 + SKILL.md）
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  FileCode,
  ImagePlus,
  RotateCcw,
} from "lucide-react";
import { SkillCover } from "@/components/skills/SkillCover";
import { resolveSkillCoverUrl } from "@/lib/api/skills";

const SKILL_TEMPLATE = `---
name: my-skill
description: 一句话说明技能用途（≤1024 字符，模型据此决定是否加载）
version: 1.0.0
category: custom
metadata:
  tags: [tag1, tag2]
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

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface SkillEditorSavePayload {
  body: string;
  coverFile?: File | null;
  removeCover?: boolean;
}

interface SkillEditorProps {
  initialBody?: string;
  editName?: string;
  initialCoverUrl?: string | null;
  onSave: (payload: SkillEditorSavePayload) => Promise<void>;
  onCancel: () => void;
}

function parseFrontmatterValue(body: string, key: string): string {
  const fence = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const block = fence?.[1] ?? "";
  const matched = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return (matched?.[1] || "").trim().replace(/^["']|["']$/g, "");
}

export function SkillEditor({
  initialBody,
  editName,
  initialCoverUrl,
  onSave,
  onCancel,
}: SkillEditorProps) {
  const [body, setBody] = useState(initialBody ?? SKILL_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    resolveSkillCoverUrl(initialCoverUrl)
  );
  const [removeCover, setRemoveCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const previewName = useMemo(
    () => editName || parseFrontmatterValue(body, "name") || "my-skill",
    [body, editName]
  );
  const previewCategory = useMemo(
    () => parseFrontmatterValue(body, "category") || "custom",
    [body]
  );

  const handlePickCover = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_COVER_TYPES.has(file.type)) {
      setError("封面仅支持 JPG、PNG、WEBP、GIF");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError("封面文件不能超过 5MB");
      return;
    }

    setError(null);
    setRemoveCover(false);
    setCoverFile(file);
  };

  const handleResetCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(Boolean(initialCoverUrl));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        body,
        coverFile,
        removeCover: removeCover && !coverFile,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <button
          onClick={onCancel}
          className="mb-5 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-muted shadow-xs transition-colors hover:bg-gray-50 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回列表</span>
        </button>

        <div className="rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary-deep" />
                <h1 className="text-xl font-bold text-foreground">
                  {editName ? `编辑技能：${editName}` : "创建自定义技能"}
                </h1>
              </div>
              <p className="mt-1 text-xs text-muted">
                先选封面，再按 SKILL.md 编写技能内容
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !body.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-primary-light disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? "保存中..." : "保存并发布"}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">技能封面</h2>
              <p className="mt-0.5 text-xs text-muted">
                可选。不上传时会按技能名生成品牌封面；支持 JPG / PNG / WEBP / GIF，最大 5MB。
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handlePickCover}
            />

            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <SkillCover
                name={previewName}
                category={previewCategory}
                source="custom"
                coverUrl={coverPreview}
                height={180}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-gray-50"
              >
                <ImagePlus className="h-3.5 w-3.5 text-primary-deep" />
                {coverPreview ? "更换封面" : "上传封面"}
              </button>
              {coverPreview && (
                <button
                  type="button"
                  onClick={handleResetCover}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  使用生成封面
                </button>
              )}
              {coverFile && (
                <span className="text-[11px] text-muted-subtle truncate max-w-[220px]">
                  已选择 {coverFile.name}
                </span>
              )}
            </div>
          </section>

          <div>
            <h2 className="mb-2 text-sm font-bold text-foreground">SKILL.md</h2>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="h-[52vh] w-full resize-none rounded-2xl border border-gray-300 bg-gray-50/50 p-4 font-mono text-xs leading-6 text-foreground outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              placeholder="粘贴或编写 SKILL.md 内容..."
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
