"use client";

/**
 * SlashSkillMenu — 输入框 `/` 自动补全浮层
 *
 * 交互逻辑：
 * 1. 输入框行首输入 `/` + 后续字符 → 弹出浮层
 * 2. 分三区展示：动作 / 模式 / 技能，各有标题与「Show more」（模式仅两项不折叠）
 * 3. 按名称前缀 + 模糊匹配实时过滤
 * 4. 键盘上下选择 + Enter 选中（跨区连续导航）
 * 5. 鼠标悬停某项时右侧弹出详情卡片
 * 6. 选中技能显示为 chip（可取消）；动作直接执行；模式切换 interactionMode
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SkillDescriptor } from "@/lib/api/skills";
import { type ActionDescriptor } from "@/lib/actions/types";
import { CHAT_ACTIONS } from "@/lib/actions/chat-actions";
import {
  INTERACTION_MODE_OPTIONS,
  type InteractionMode,
} from "@/lib/chat/interaction-modes";

const SECTION_LIMIT = 3;

type ModeOption = (typeof INTERACTION_MODE_OPTIONS)[number];

/** 菜单项类型 */
type MenuItem =
  | { kind: "skill"; data: SkillDescriptor }
  | { kind: "action"; data: ActionDescriptor }
  | { kind: "mode"; data: ModeOption };

function formatTitle(name: string): string {
  return name
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

interface SlashSkillMenuProps {
  /** 已加载的技能列表 */
  skills: SkillDescriptor[];
  /** 由编辑器算出的 `/` query：null=未触发；""=刚敲下/；非空=过滤词 */
  query: string | null;
  /** 选中技能/动作回调 */
  onSelect: (name: string, kind: "skill" | "action") => void;
  /** 选中模式回调 */
  onSelectMode: (mode: InteractionMode) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export function SlashSkillMenu({
  skills,
  query: slashQuery,
  onSelect,
  onSelectMode,
  disabled,
}: SlashSkillMenuProps) {
  const [open, setOpen] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [detailBottom, setDetailBottom] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // 检测是否触发 `/` 模式（由 MentionComposer 基于光标位置算出，不限行首）
  const filteredActions = useMemo<ActionDescriptor[]>(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase();
    return CHAT_ACTIONS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [slashQuery]);

  // 过滤模式
  const filteredModes = useMemo<ModeOption[]>(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase();
    return INTERACTION_MODE_OPTIONS.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q)
    );
  }, [slashQuery]);

  // 过滤技能
  const filteredSkills = useMemo<SkillDescriptor[]>(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [skills, slashQuery]);

  const visibleActions = showAllActions
    ? filteredActions
    : filteredActions.slice(0, SECTION_LIMIT);
  const visibleSkills = showAllSkills
    ? filteredSkills
    : filteredSkills.slice(0, SECTION_LIMIT);
  const hiddenActions = Math.max(0, filteredActions.length - SECTION_LIMIT);
  const hiddenSkills = Math.max(0, filteredSkills.length - SECTION_LIMIT);

  // 合并为扁平列表，供键盘导航 / hover 详情使用（动作 → 模式 → 技能）
  const combinedVisible = useMemo<MenuItem[]>(
    () => [
      ...visibleActions.map((data) => ({ kind: "action" as const, data })),
      ...filteredModes.map((data) => ({ kind: "mode" as const, data })),
      ...visibleSkills.map((data) => ({ kind: "skill" as const, data })),
    ],
    [visibleActions, filteredModes, visibleSkills]
  );

  const totalFiltered =
    filteredActions.length + filteredModes.length + filteredSkills.length;
  const hoveredItem =
    hoveredIndex !== null ? (combinedVisible[hoveredIndex] ?? null) : null;

  // 控制浮层显隐
  useEffect(() => {
    setOpen(slashQuery !== null && totalFiltered > 0);
    setHighlightIndex(0);
    setHoveredIndex(null);
    setShowAllActions(false);
    setShowAllSkills(false);
  }, [slashQuery, totalFiltered]);

  // 详情卡片底边对齐当前 hover 项，子面板向上展开
  useEffect(() => {
    if (hoveredIndex === null) return;
    const panel = menuPanelRef.current;
    const item = itemRefs.current[hoveredIndex];
    if (!panel || !item) return;
    const panelRect = panel.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setDetailBottom(panelRect.height - (itemRect.bottom - panelRect.top));
  }, [hoveredIndex, combinedVisible, showAllActions, showAllSkills]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (item: MenuItem) => {
      if (item.kind === "mode") {
        if (disabled) return;
        onSelectMode(item.data.key);
        setOpen(false);
        return;
      }
      onSelect(item.data.name, item.kind);
      setOpen(false);
    },
    [onSelect, onSelectMode, disabled]
  );

  // 键盘导航（由父组件 textarea 的 onKeyDown 调用）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!open) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, combinedVisible.length - 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (e.key === "Enter" && combinedVisible[highlightIndex]) {
        e.preventDefault();
        handleSelect(combinedVisible[highlightIndex]);
        return true;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return true;
      }
      return false;
    },
    [open, combinedVisible, highlightIndex, handleSelect]
  );

  // 渲染单个分区条目
  const renderRow = (item: MenuItem, globalIndex: number) => {
    const isActive =
      globalIndex === hoveredIndex ||
      (hoveredIndex === null && globalIndex === highlightIndex);

    if (item.kind === "mode") {
      const mode = item.data;
      const IconComponent = mode.icon;
      const rowDisabled = disabled;

      return (
        <button
          key={`mode:${mode.key}`}
          ref={(el) => {
            itemRefs.current[globalIndex] = el;
          }}
          type="button"
          role="option"
          aria-selected={globalIndex === highlightIndex}
          disabled={rowDisabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!rowDisabled) handleSelect(item);
          }}
          onMouseEnter={(e) => {
            setHighlightIndex(globalIndex);
            setHoveredIndex(globalIndex);
            const panel = menuPanelRef.current;
            if (panel) {
              const panelRect = panel.getBoundingClientRect();
              const itemRect = e.currentTarget.getBoundingClientRect();
              setDetailBottom(panelRect.height - (itemRect.bottom - panelRect.top));
            }
          }}
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] text-neutral-800",
            rowDisabled && "cursor-not-allowed opacity-50",
            isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
          )}
        >
          <IconComponent
            className={cn("h-3.5 w-3.5 shrink-0", mode.iconClassName)}
            strokeWidth={1.75}
          />
          <span className="min-w-0 flex-1 truncate">{mode.label}</span>
        </button>
      );
    }

    const isAction = item.kind === "action";
    const IconComponent = isAction ? Zap : Sparkle;

    return (
      <button
        key={`${item.kind}:${item.data.name}`}
        ref={(el) => {
          itemRefs.current[globalIndex] = el;
        }}
        type="button"
        role="option"
        aria-selected={globalIndex === highlightIndex}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSelect(item);
        }}
        onMouseEnter={(e) => {
          setHighlightIndex(globalIndex);
          setHoveredIndex(globalIndex);
          const panel = menuPanelRef.current;
          if (panel) {
            const panelRect = panel.getBoundingClientRect();
            const itemRect = e.currentTarget.getBoundingClientRect();
            setDetailBottom(panelRect.height - (itemRect.bottom - panelRect.top));
          }
        }}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] text-neutral-800",
          isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
        )}
      >
        <IconComponent
          className="h-3.5 w-3.5 shrink-0 text-neutral-500"
          strokeWidth={1.75}
        />
        <span className="truncate">{item.data.name}</span>
      </button>
    );
  };

  return {
    open,
    slashQuery,
    filtered: combinedVisible,
    highlightIndex,
    handleKeyDown,
    menuRef,
    renderMenu: () =>
      open ? (
        <div ref={menuRef} className="absolute bottom-full left-0 z-50 mb-2">
          <div
            ref={menuPanelRef}
            className="relative w-60 overflow-visible rounded-xl border border-gray-200 bg-white shadow-xl"
            role="listbox"
            aria-label="Slash menu"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* 动作分区 */}
            {visibleActions.length > 0 ? (
              <div className="pb-1">
                <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium tracking-wide text-neutral-400">
                  动作
                </div>
                {visibleActions.map((action, i) =>
                  renderRow({ kind: "action", data: action }, i)
                )}
                {!showAllActions && hiddenActions > 0 ? (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowAllActions(true);
                    }}
                    onMouseEnter={() => setHoveredIndex(null)}
                    className="w-full px-3 py-[7px] text-left text-[11px] text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    Show {hiddenActions} more
                  </button>
                ) : null}
              </div>
            ) : null}

            {visibleActions.length > 0 && filteredModes.length > 0 ? (
              <div className="mx-3 my-1 h-px bg-neutral-100" />
            ) : null}

            {/* 模式分区 */}
            {filteredModes.length > 0 ? (
              <div className="pb-1">
                <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium tracking-wide text-neutral-400">
                  模式
                </div>
                {filteredModes.map((mode, i) =>
                  renderRow(
                    { kind: "mode", data: mode },
                    visibleActions.length + i
                  )
                )}
              </div>
            ) : null}

            {(visibleActions.length > 0 || filteredModes.length > 0) &&
            visibleSkills.length > 0 ? (
              <div className="mx-3 my-1 h-px bg-neutral-100" />
            ) : null}

            {/* 技能分区 */}
            {visibleSkills.length > 0 ? (
              <div className="pb-1">
                <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium tracking-wide text-neutral-400">
                  技能
                </div>
                {visibleSkills.map((skill, i) =>
                  renderRow(
                    { kind: "skill", data: skill },
                    visibleActions.length + filteredModes.length + i
                  )
                )}
                {!showAllSkills && hiddenSkills > 0 ? (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowAllSkills(true);
                    }}
                    onMouseEnter={() => setHoveredIndex(null)}
                    className="w-full px-3 py-[7px] text-left text-[11px] text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    Show {hiddenSkills} more
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* 悬停详情卡片 */}
            {hoveredItem && hoveredIndex !== null ? (
              <div
                className="pointer-events-none absolute left-full z-10 ml-2 w-[min(100vw-2rem,280px)] rounded-[10px] border border-neutral-200/90 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
                style={{ bottom: detailBottom }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-semibold leading-snug text-neutral-900">
                    {hoveredItem.kind === "mode"
                      ? hoveredItem.data.label
                      : formatTitle(hoveredItem.data.name)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      hoveredItem.kind === "action"
                        ? "bg-neutral-100 text-neutral-600"
                        : hoveredItem.kind === "mode"
                          ? hoveredItem.data.key === "plan"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-primary/10 text-primary"
                          : "bg-blue-50 text-blue-600"
                    )}
                  >
                    {hoveredItem.kind === "action"
                      ? "动作"
                      : hoveredItem.kind === "mode"
                        ? "模式"
                        : "技能"}
                  </span>
                </div>
                <div className="max-h-[180px] overflow-y-auto text-[12px] leading-relaxed text-neutral-600">
                  {hoveredItem.kind === "mode"
                    ? hoveredItem.data.desc
                    : hoveredItem.data.description}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null,
  };
}
