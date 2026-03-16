"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Bot, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeChatPanelProps {
  title: string;
  subtitle: string;
  contextName: string;
  starterPrompts: string[];
  placeholder?: string;
  emptyHint?: string;
  className?: string;
}

export const KnowledgeChatPanel = ({
  title,
  subtitle,
  contextName,
  starterPrompts,
  placeholder = "输入你的问题...",
  emptyHint,
  className,
}: KnowledgeChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `当前已围绕「${contextName}」准备好问答上下文。你可以直接让我总结重点、提炼结论、找风险，或者继续深挖细节。`,
        timestamp: new Date(),
      },
    ]);
  }, [contextName]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleSend = (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content,
        timestamp: new Date(),
      },
    ]);
    setInput("");

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `这是围绕「${contextName}」的占位回答。正式接入问答接口后，这里会返回基于上下文的答案、引用片段和可继续追问的方向。`,
          reference: `当前提问范围：${contextName}`,
          timestamp: new Date(),
        },
      ]);
    }, 450);
  };

  return (
    <section
      className={cn(
        "flex min-h-[620px] flex-col rounded-[32px] border border-white/5 bg-[linear-gradient(180deg,rgba(18,21,22,0.98),rgba(12,14,15,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.24)]",
        className
      )}
    >
      <div className="border-b border-white/5 px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary-light">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-lg text-foreground">
              <span>{title}</span>
              <Sparkles className="h-4 w-4 text-primary-light" />
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.length === 0 && emptyHint ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-muted">
            {emptyHint}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div key={index} className="flex gap-3 animate-fadeIn">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm",
                message.role === "assistant"
                  ? "bg-primary/15 text-primary-light"
                  : "bg-white/10 text-foreground"
              )}
            >
              {message.role === "assistant" ? <Sparkles className="h-4 w-4" /> : "你"}
            </div>

            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "rounded-[24px] p-4 text-sm leading-7 whitespace-pre-line",
                  message.role === "assistant"
                    ? "bg-dark-card text-foreground"
                    : "bg-primary/10 text-foreground"
                )}
              >
                {message.content}
              </div>
              {message.reference ? (
                <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary-light">
                  {message.reference}
                </div>
              ) : null}
              <div className="mt-1 text-[10px] text-muted">
                {formatDate(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-5">
        <div className="flex items-end gap-3 rounded-[28px] border border-white/10 bg-dark-card p-3 focus-within:border-primary">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            rows={3}
            placeholder={placeholder}
            className="min-h-[72px] flex-1 resize-none bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
