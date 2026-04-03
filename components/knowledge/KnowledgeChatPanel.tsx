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
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

export const KnowledgeChatPanel = ({
  title,
  subtitle,
  contextName,
  starterPrompts,
  placeholder = "输入你的问题...",
  emptyHint,
  disabled = false,
  disabledReason,
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
    if (disabled) return;

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
        "flex min-h-[620px] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm",
        className
      )}
    >
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-lg font-medium text-foreground">
              <span>{title}</span>
              <Sparkles className="h-4 w-4 text-primary" />
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
              disabled={disabled}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-muted"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.length === 0 && emptyHint ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-muted">
            {emptyHint}
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div key={index} className="flex gap-3 animate-fadeIn">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm",
                message.role === "assistant"
                  ? "bg-primary/10 text-primary"
                  : "bg-gray-100 text-foreground"
              )}
            >
              {message.role === "assistant" ? <Sparkles className="h-4 w-4" /> : "你"}
            </div>

            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "rounded-2xl p-4 text-sm leading-7 whitespace-pre-line",
                  message.role === "assistant"
                    ? "bg-gray-50 text-foreground"
                    : "bg-primary/5 text-foreground"
                )}
              >
                {message.content}
              </div>
              {message.reference ? (
                <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
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

      <div className="border-t border-gray-100 p-5">
        {disabledReason ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700">
            {disabledReason}
          </div>
        ) : null}
        <div className="flex items-end gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 focus-within:border-primary">
          <textarea
            value={input}
            disabled={disabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (disabled) return;
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            rows={3}
            placeholder={disabled ? "当前上下文处理中，暂不可提问" : placeholder}
            className="min-h-[72px] flex-1 resize-none bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={disabled || !input.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-muted"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
