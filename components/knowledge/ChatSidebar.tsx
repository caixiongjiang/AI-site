"use client";

import { useEffect, useState } from "react";
import { Message } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
}

const starterPrompts = [
  "总结这份文档的核心结论",
  "列出值得继续追问的 5 个问题",
  "帮我按汇报口径提炼重点",
];

export const ChatSidebar = ({
  isOpen,
  onClose,
  documentName,
}: ChatSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `已接入「${documentName}」的上下文。你可以让我做摘要、找重点、列风险点，或给出后续追问建议。`,
        timestamp: new Date(),
      },
    ]);
  }, [documentName]);

  const handleSend = (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content) return;

    const userMessage: Message = {
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: `基于「${documentName}」的已知上下文，这个问题适合从“核心事实、结论依据、待补信息”三个维度来看。当前界面还没有接入真实问答接口，所以这里先展示占位响应；接入后端后可直接返回带引用的答案。`,
        reference: `引用范围：${documentName}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-[900] flex h-screen w-[440px] flex-col border-l border-white/5 bg-[#121516]/95 shadow-2xl backdrop-blur transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="border-b border-white/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-base text-foreground">
              <Bot className="h-5 w-5 text-primary-light" />
              文档问答
            </div>
            <div className="mt-1 text-xs text-muted">当前上下文：{documentName}</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted transition-all hover:border-red-500/40 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((message, index) => (
          <div key={index} className="flex gap-3 animate-fadeIn">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                message.role === "assistant"
                  ? "bg-primary/15 text-primary-light"
                  : "bg-white/10 text-foreground"
              )}
            >
              {message.role === "assistant" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                "你"
              )}
            </div>
            <div className="flex-1">
              <div
                className={cn(
                  "rounded-2xl p-3 text-sm leading-6 whitespace-pre-line",
                  message.role === "assistant"
                    ? "bg-dark-card text-foreground"
                    : "bg-primary/10 text-foreground"
                )}
              >
                {message.content}
              </div>
              {message.reference && (
                <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary-light">
                  {message.reference}
                </div>
              )}
              <div className="mt-1 text-[10px] text-muted">
                {formatDate(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-4">
        <div className="flex items-end gap-2 rounded-[24px] border border-white/10 bg-dark-card p-2.5 focus-within:border-primary">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="向文档提问..."
            rows={2}
            className="min-h-[48px] flex-1 resize-none bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
