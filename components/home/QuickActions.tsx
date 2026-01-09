"use client";

import { FileText, PenTool, BarChart3, Target } from "lucide-react";

const actions = [
  { icon: FileText, label: "文档翻译" },
  { icon: PenTool, label: "智能写作" },
  { icon: BarChart3, label: "数据总结" },
  { icon: Target, label: "快捷回问" },
];

export const QuickActions = () => {
  return (
    <div className="grid w-full max-w-[800px] grid-cols-4 gap-5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            className="group flex flex-col items-center gap-2.5 rounded-xl border border-transparent bg-dark-card p-5 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/15"
          >
            <Icon className="h-8 w-8 text-foreground" />
            <span className="text-xs text-gray-300">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};
