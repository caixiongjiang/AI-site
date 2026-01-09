"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, ChevronDown, FileText, BarChart3, Globe, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mode } from "@/lib/types";

const modes: Mode[] = [
  {
    id: "chat",
    name: "普通对话",
    icon: MessageSquare,
    description: "通用AI问答和全库检索",
    placeholder: "有问题随意问，或在此搜索您想要的信息...",
  },
];

const recentAgents: Mode[] = [
  {
    id: "contract",
    name: "合同风险审查",
    icon: FileText,
    description: "识别合同中的法律风险",
    placeholder: "使用 合同风险审查 处理您的任务...",
  },
  {
    id: "weekly",
    name: "周报生成",
    icon: BarChart3,
    description: "自动生成工作周报",
    placeholder: "使用 周报生成 处理您的任务...",
  },
  {
    id: "translation",
    name: "文档翻译",
    icon: Globe,
    description: "专业文档翻译助手",
    placeholder: "使用 文档翻译 处理您的任务...",
  },
  {
    id: "code-review",
    name: "代码审查",
    icon: Code,
    description: "代码质量审查和建议",
    placeholder: "使用 代码审查 处理您的任务...",
  },
];

interface ModeSelectorProps {
  value: Mode;
  onChange: (mode: Mode) => void;
}

export const ModeSelector = ({ value, onChange }: ModeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const Icon = value.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-lg bg-dark px-3.5 py-2 transition-all hover:bg-dark-card",
          isOpen && "bg-dark-card"
        )}
      >
        <Icon className="h-4.5 w-4.5 text-foreground" />
        <span className="text-sm text-foreground whitespace-nowrap">{value.name}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-50 min-w-[280px] animate-fadeIn rounded-xl border border-dark-border bg-[#2A2A2A] p-2 shadow-2xl">
          {/* Normal Mode */}
          <div className="mb-3">
            <div className="mb-1 px-3 py-2 text-xs uppercase tracking-wider text-muted">
              对话模式
            </div>
            {modes.map((mode) => {
              const ModeIcon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onChange(mode);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-3 transition-all hover:bg-primary/10"
                >
                  <ModeIcon className="h-5 w-5 text-foreground" />
                  <div className="flex-1 text-left">
                    <div className="text-sm text-foreground">{mode.name} (Copilot)</div>
                    <div className="text-xs text-muted">{mode.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Recent Agents */}
          <div>
            <div className="mb-1 px-3 py-2 text-xs uppercase tracking-wider text-muted">
              最近使用
            </div>
            {recentAgents.map((agent) => {
              const AgentIcon = agent.icon;
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    onChange(agent);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-3 transition-all hover:bg-primary/10"
                >
                  <AgentIcon className="h-5 w-5 text-foreground" />
                  <div className="flex-1 text-left">
                    <div className="text-sm text-foreground">{agent.name}</div>
                    <div className="text-xs text-muted">{agent.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
