"use client";

import { useState } from "react";
import { Send, Paperclip, Sparkles } from "lucide-react";
import { ModeSelector } from "./ModeSelector";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { Mode } from "@/lib/types";

const defaultMode: Mode = {
  id: "chat",
  name: "普通对话",
  icon: MessageSquare,
  description: "通用AI问答和全库检索",
  placeholder: "有问题随意问，或在此搜索您想要的信息...",
};

export const SearchInput = () => {
  const [mode, setMode] = useState(defaultMode);
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // If an agent is selected, redirect to agent usage page
    if (mode.id !== "chat") {
      router.push(`/agents/${mode.id}?message=${encodeURIComponent(input)}`);
    } else {
      // Normal chat mode - could redirect to a chat page or handle here
      console.log("Normal chat:", input);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[800px]">
      <div className="group rounded-2xl border-2 border-transparent bg-dark-card p-4.5 shadow-2xl transition-all focus-within:border-primary focus-within:shadow-primary/20">
        <div className="flex items-center gap-3">
          {/* Mode Selector */}
          <ModeSelector value={mode} onChange={(newMode) => setMode(newMode)} />

          {/* @ Symbol */}
          <span className="text-muted">@</span>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode.placeholder}
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-all hover:bg-white/5 hover:text-foreground"
              aria-label="附件"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-all hover:bg-white/5 hover:text-foreground"
              aria-label="更多"
            >
              <Sparkles className="h-4.5 w-4.5" />
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-muted"
              aria-label="发送"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
