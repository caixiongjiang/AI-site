"use client";

import { SearchInput } from "@/components/home/SearchInput";
import { QuickActions } from "@/components/home/QuickActions";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-10 relative">
      {/* New Chat Button */}
      <button className="absolute right-8 top-8 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-primary-light hover:shadow-lg hover:shadow-primary/30">
        <Sparkles className="h-4 w-4" />
        <span>新建会话</span>
      </button>

      {/* Title Area */}
      <div className="mb-15 text-center">
        <h1 className="mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-6xl font-light tracking-wide text-transparent">
          JarsonCai&apos;s Assistant
        </h1>
        <p className="text-base font-light text-muted">
          为创新赋能，与智慧同行
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-10">
        <SearchInput />
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
