"use client";

/**
 * SkillList — 技能市场与管理（现代卡片式最优网格布局 + 艺术封面 + 启停交互）
 */

import { useMemo, useState } from "react";
import {
  Trash2,
  Search,
  LayoutGrid,
  List,
  Wrench,
  Plus,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillDescriptor } from "@/lib/api/skills";
import { resolveSkillCoverUrl } from "@/lib/api/skills";
import { SkillCover } from "@/components/skills/SkillCover";

interface SkillListProps {
  skills: SkillDescriptor[];
  loading: boolean;
  onView: (name: string) => void;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
  onCreate: () => void;
}

type FilterSource = "all" | "builtin" | "custom" | "enabled";

export function SkillList({
  skills,
  loading,
  onView,
  onToggle,
  onDelete,
  onCreate,
}: SkillListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterSource>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);

  // 提取全部可用分类
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set);
  }, [skills]);

  // 过滤与搜索
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      // 1. 来源/状态过滤
      if (activeFilter === "builtin" && s.source !== "builtin") return false;
      if (activeFilter === "custom" && s.source !== "custom") return false;
      if (activeFilter === "enabled" && !s.enabled) return false;

      // 2. 分类过滤
      if (selectedCategory !== "all" && s.category !== selectedCategory) return false;

      // 3. 关键字搜索
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = s.description.toLowerCase().includes(q);
        const matchTags = s.tags.some((t) => t.toLowerCase().includes(q));
        const matchCat = s.category?.toLowerCase().includes(q);
        return matchName || matchDesc || matchTags || matchCat;
      }

      return true;
    });
  }, [skills, activeFilter, selectedCategory, searchQuery]);

  const enabledCount = useMemo(() => skills.filter((s) => s.enabled).length, [skills]);
  const builtinCount = useMemo(() => skills.filter((s) => s.source === "builtin").length, [skills]);
  const customCount = useMemo(() => skills.filter((s) => s.source === "custom").length, [skills]);

  const handleToggle = async (name: string, enabled: boolean) => {
    setTogglingSkill(name);
    try {
      await onToggle(name, enabled);
    } finally {
      setTogglingSkill(null);
    }
  };

  const handleDelete = (name: string) => {
    if (confirm(`确定删除自定义技能「${name}」？此操作不可撤销。`)) {
      onDelete(name);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-gray-200/80 bg-white p-4 space-y-3"
            >
              <div className="h-32 w-full rounded-xl bg-gray-100" />
              <div className="h-4 w-2/3 rounded bg-gray-100" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-4/5 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      {/* 顶部控制栏：与下方卡片共用同一套 max-w + 水平内边距，保证左右对齐 */}
      <div className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto max-w-7xl space-y-5 px-6 py-6 sm:px-10">
          {/* 标题与主操作按钮 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">技能集市与管理</h1>
              <p className="mt-1 text-xs text-muted">
                为智能体配置专属的领域专长、推理范式与工具调度能力（总计 {skills.length} 个技能 · {enabledCount} 个启用中）
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-primary-light hover:shadow-md hover:shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                <span>创建技能</span>
              </button>
            </div>
          </div>

          {/* 搜索与过滤工具栏 */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* 搜索框 */}
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索技能名称、描述、标签或分类..."
                className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-4 text-xs text-foreground placeholder-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-colors"
              />
            </div>

            {/* 过滤器组 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 来源切换 */}
              <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50/80 p-1 text-xs">
                {[
                  { id: "all", label: `全部 (${skills.length})` },
                  { id: "builtin", label: `内置 (${builtinCount})` },
                  { id: "custom", label: `自定义 (${customCount})` },
                  { id: "enabled", label: `已启用 (${enabledCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id as FilterSource)}
                    className={cn(
                      "rounded-lg px-3 py-1 font-medium transition-colors",
                      activeFilter === tab.id
                        ? "bg-white text-primary-deep font-semibold shadow-xs"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 分类下拉过滤：自定义菜单，避免原生 option 跟系统深色皮肤走 */}
              {categories.length > 0 && (
                <CategoryFilter
                  categories={categories}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                />
              )}

              {/* 视图切换 */}
              <div className="hidden sm:inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-2xs">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "rounded-lg p-1 text-muted transition-colors",
                    viewMode === "grid" ? "bg-gray-100 text-foreground" : "hover:text-foreground"
                  )}
                  title="卡片网格视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded-lg p-1 text-muted transition-colors",
                    viewMode === "list" ? "bg-gray-100 text-foreground" : "hover:text-foreground"
                  )}
                  title="紧凑列表视图"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主体卡片网格 / 列表区 */}
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-10">
        {filteredSkills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white py-16 text-center shadow-xs">
            <h3 className="text-sm font-bold text-foreground">没有找到匹配的技能</h3>
            <p className="mt-1 text-xs text-muted">
              尝试清除过滤条件，或点击上方「创建技能」添加专属工作流。
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* ==================== 1. 最优卡片网格布局 (Grid) ==================== */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                onView={onView}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isToggling={togglingSkill === skill.name}
              />
            ))}
          </div>
        ) : (
          /* ==================== 2. 紧凑列表布局 (List) ==================== */
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
            {filteredSkills.map((skill) => (
              <SkillListItem
                key={skill.name}
                skill={skill}
                onView={onView}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isToggling={togglingSkill === skill.name}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryFilter（白底圆角菜单，与筛选条/卡片同一套视觉）
// ---------------------------------------------------------------------------

function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = [
    { id: "all", label: "全部分类" },
    ...categories.map((cat) => ({ id: cat, label: cat })),
  ];
  const currentLabel = options.find((opt) => opt.id === value)?.label ?? "全部分类";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-medium transition-colors",
          open
            ? "border-primary text-primary-deep shadow-xs"
            : "border-gray-200 text-foreground hover:border-primary/40"
        )}
      >
        <span>{currentLabel}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform",
            open && "rotate-180 text-primary-deep"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            aria-label="按分类筛选"
            className="absolute left-0 z-40 mt-1.5 min-w-[10rem] overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
          >
            {options.map((opt) => {
              const selected = value === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors",
                      selected
                        ? "bg-primary/10 font-semibold text-primary-deep"
                        : "text-foreground hover:bg-gray-50"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillCard (卡片式最优展示组件)
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: SkillDescriptor;
  onView: (name: string) => void;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
  isToggling: boolean;
}

function SkillCard({ skill, onView, onToggle, onDelete, isToggling }: SkillCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(skill.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(skill.name);
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md",
        skill.enabled ? "border-gray-200/90" : "border-gray-200/60 bg-gray-50/40 opacity-90"
      )}
    >
      <div>
        {/* 顶部艺术封面 (带分类与来源浮层) */}
        <div className="overflow-hidden">
          <SkillCover
            name={skill.name}
            category={skill.category}
            tags={skill.tags}
            source={skill.source}
            enabled={skill.enabled}
            coverUrl={resolveSkillCoverUrl(skill.cover_url)}
            height={130}
          />
        </div>

        {/* 卡片主体内容 */}
        <div className="p-4 space-y-2.5">
          {/* 标题与版本 */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary-deep"
              title={skill.name}
            >
              {skill.name}
            </h3>
            {skill.version && (
              <span className="shrink-0 font-mono text-[10px] text-muted-subtle bg-gray-100 px-1.5 py-0.5 rounded">
                v{skill.version}
              </span>
            )}
          </div>

          {/* 描述信息 (截断 2 行) */}
          <p
            className="line-clamp-2 text-xs leading-relaxed text-muted"
            title={skill.description}
          >
            {skill.description || "暂无技能详细描述"}
          </p>

          {/* 标签列表 */}
          {skill.tags && skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {skill.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-gray-100/90 px-1.5 py-0.5 text-[10px] text-muted-subtle font-medium"
                >
                  #{tag}
                </span>
              ))}
              {skill.tags.length > 3 && (
                <span className="text-[10px] text-muted">+{skill.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* 依赖工具提示 */}
          {skill.requires_tools && skill.requires_tools.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-subtle pt-0.5">
              <Wrench className="h-3 w-3 text-primary-deep shrink-0" />
              <span className="truncate">需工具: {skill.requires_tools.join(", ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* 卡片底部：左下开关，右下状态 */}
      <div
        className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(skill.name, !skill.enabled);
            }}
            disabled={isToggling}
            className="cursor-pointer"
            title={skill.enabled ? "点击停用此技能" : "点击启用此技能"}
            aria-label={skill.enabled ? "停用技能" : "启用技能"}
          >
            <span
              className={cn(
                "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
                skill.enabled ? "bg-primary" : "bg-gray-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-xs transition-transform duration-200",
                  skill.enabled ? "translate-x-3" : "translate-x-0"
                )}
              />
            </span>
          </button>
          {skill.deletable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(skill.name);
              }}
              className="rounded-lg p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
              title="删除技能"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <span
          className={cn(
            "text-[11px] font-medium",
            skill.enabled ? "text-primary-deep" : "text-muted"
          )}
        >
          {skill.enabled ? "已启用" : "已停用"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillListItem (紧凑列表组件)
// ---------------------------------------------------------------------------

function SkillListItem({
  skill,
  onView,
  onToggle,
  onDelete,
  isToggling,
}: SkillCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView(skill.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(skill.name);
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-gray-50/80",
        !skill.enabled && "opacity-75 bg-gray-50/30"
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* 缩略图封面 */}
        <div className="h-14 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200">
          <SkillCover
            name={skill.name}
            category={skill.category}
            tags={skill.tags}
            source={skill.source}
            enabled={skill.enabled}
            coverUrl={resolveSkillCoverUrl(skill.cover_url)}
            height={56}
          />
        </div>

        {/* 文字主体 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-foreground group-hover:text-primary-deep">
              {skill.name}
            </h3>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                skill.source === "builtin" ? "bg-emerald-50 text-primary-deep" : "bg-blue-50 text-blue-700"
              )}
            >
              {skill.source === "builtin" ? "内置" : "自定义"}
            </span>
            {skill.version && (
              <span className="font-mono text-[10px] text-muted">v{skill.version}</span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{skill.description}</p>
        </div>
      </div>

      {/* 右侧动作 */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(skill.name, !skill.enabled);
          }}
          disabled={isToggling}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border",
            skill.enabled
              ? "border-emerald-200 bg-emerald-50 text-primary-deep hover:bg-emerald-100"
              : "border-gray-200 bg-gray-100 text-muted hover:bg-gray-200"
          )}
        >
          {skill.enabled ? "已启用" : "已停用"}
        </button>

        {skill.deletable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(skill.name);
            }}
            className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
            title="删除技能"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
