"use client";

/**
 * SkillList — 技能列表（内置/自定义分组 + 启停开关 + 删除）
 */

import { useState } from "react";
import { Sparkle, Trash2, Power, PowerOff, Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillDescriptor } from "@/lib/api/skills";

interface SkillListProps {
  skills: SkillDescriptor[];
  loading: boolean;
  onView: (name: string) => void;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
  onCreate: () => void;
}

export function SkillList({
  skills,
  loading,
  onView,
  onToggle,
  onDelete,
  onCreate,
}: SkillListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const builtin = skills.filter((s) => s.source === "builtin");
  const custom = skills.filter((s) => s.source === "custom");

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除技能「${name}」？此操作不可恢复。`)) return;
    setDeleting(name);
    try {
      await onDelete(name);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        加载中...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">技能管理</h1>
          <p className="mt-1 text-sm text-muted">
            管理可用技能，控制对话中的技能加载行为
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
        >
          <Sparkle className="h-4 w-4" strokeWidth={1.75} />
          创建技能
        </button>
      </div>

      {/* 内置技能 */}
      {builtin.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            内置技能（{builtin.length}）
          </h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {builtin.map((skill) => (
              <SkillRow
                key={skill.name}
                skill={skill}
                onView={onView}
                onToggle={onToggle}
                onDelete={handleDelete}
                deleting={deleting === skill.name}
              />
            ))}
          </div>
        </section>
      )}

      {/* 自定义技能 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">
          自定义技能（{custom.length}）
        </h2>
        {custom.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-muted">
            暂无自定义技能，点击「创建技能」开始
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {custom.map((skill) => (
              <SkillRow
                key={skill.name}
                skill={skill}
                onView={onView}
                onToggle={onToggle}
                onDelete={handleDelete}
                deleting={deleting === skill.name}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillRow
// ---------------------------------------------------------------------------

function SkillRow({
  skill,
  onView,
  onToggle,
  onDelete,
  deleting,
}: {
  skill: SkillDescriptor;
  onView: (name: string) => void;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          skill.source === "builtin"
            ? "bg-blue-50 text-blue-600"
            : "bg-green-50 text-green-600"
        )}
      >
        <Sparkle className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{skill.name}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px]",
              skill.source === "builtin"
                ? "bg-blue-50 text-blue-600"
                : "bg-green-50 text-green-600"
            )}
          >
            {skill.source === "builtin" ? "内置" : "自定义"}
          </span>
          {!skill.enabled && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
              已停用
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted">{skill.description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onView(skill.name)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-gray-100 hover:text-foreground"
          title="查看详情"
        >
          <Eye className="h-4 w-4" />
        </button>

        <button
          onClick={() => onToggle(skill.name, !skill.enabled)}
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            skill.enabled
              ? "text-green-600 hover:bg-green-50"
              : "text-gray-400 hover:bg-gray-100"
          )}
          title={skill.enabled ? "停用" : "启用"}
        >
          {skill.enabled ? (
            <Power className="h-4 w-4" />
          ) : (
            <PowerOff className="h-4 w-4" />
          )}
        </button>

        {skill.deletable ? (
          <button
            onClick={() => onDelete(skill.name)}
            disabled={deleting}
            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <span className="rounded-lg p-1.5 text-gray-300" title="内置技能不可删除">
            <Lock className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
