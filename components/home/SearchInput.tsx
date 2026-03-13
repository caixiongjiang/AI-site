"use client";

import * as React from "react";
import { Send, Paperclip, Sparkles, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModeSelector } from "./ModeSelector";
import { Mode } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

const defaultMode: Mode = {
  id: "chat",
  name: "普通对话",
  icon: MessageSquare,
  description: "通用AI问答和全库检索",
  placeholder: "有问题随意问，或在此搜索您想要的信息...",
};

interface SearchInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (input: string) => void;
}

export const SearchInput = ({
  input,
  onInputChange,
  onSend,
}: SearchInputProps) => {
  const [mode, setMode] = React.useState(defaultMode);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (mode.id !== "chat") {
      router.push(`/agents/${mode.id}?message=${encodeURIComponent(input)}`);
      return;
    }

    onSend(input);
  };

  const requestAuthForFeature = (title: string, featureLabel: string) => {
    openAuthModal({
      title,
      description:
        "登录后我们会帮你保留当前输入内容，并把后续操作与个人会话、历史记录和高级能力打通。",
      nextPath: "/",
      featureLabel,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="group rounded-[28px] border-2 border-transparent bg-dark-card p-4.5 shadow-2xl transition-all focus-within:border-primary focus-within:shadow-primary/20">
        <div className="flex items-center gap-3">
          <ModeSelector value={mode} onChange={(newMode) => setMode(newMode)} />

          <span className="text-muted">@</span>

          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={mode.placeholder}
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requestAuthForFeature(
                    "登录以上传文档并进入深度对话",
                    "文件上传"
                  );
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-all hover:bg-white/5 hover:text-foreground"
              aria-label="附件"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  requestAuthForFeature(
                    "登录以切换更高阶的 AI 能力",
                    "高级模型与个性化能力"
                  );
                }
              }}
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
