"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { Message } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
}

export const ChatSidebar = ({ isOpen, onClose, documentName }: ChatSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `您好！我是小蔡，您的智能文档助手。我已经准备好回答关于「${documentName}」的任何问题了。您可以问我：\n\n• 这份文档的核心内容是什么？\n• 帮我总结关键要点\n• 文档中的某个条款是什么意思？`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        `根据「${documentName}」的内容，我为您找到了以下信息：\n\n这份文档主要涵盖了相关的核心要点和注意事项。文档详细说明了关键条款和实施方式。`,
        `让我为您总结一下要点：\n\n1. 明确了核心内容的定义和范围\n2. 详细规定了相关的执行标准\n3. 强调了重要条款的关键性\n4. 提供了多种处理途径\n5. 确保了流程的规范性和可执行性`,
        `关于这个问题，文档中有明确说明：\n\n根据相关规定，应当按照标准流程执行。具体操作时需要注意关键要点，确保符合要求。`,
      ];

      const aiMessage: Message = {
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        reference: `参考：${documentName}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    }, 800);
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-[900] flex h-screen w-[420px] flex-col border-l border-dark-border bg-[#1E1E1E] shadow-2xl transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-border p-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-base text-foreground">
            <span>🤖</span>
            <span>小蔡助手</span>
          </div>
          <div className="text-xs text-muted">正在查看：{documentName}</div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-all hover:bg-red-500/20 hover:text-red-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((message, index) => (
          <div key={index} className="flex gap-2.5 animate-fadeIn">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                message.role === "assistant"
                  ? "bg-gradient-to-br from-primary to-primary-light"
                  : "bg-dark-border"
              }`}
            >
              {message.role === "assistant" ? "🤖" : "👤"}
            </div>
            <div className="flex-1">
              <div
                className={`rounded-xl p-3 text-sm leading-relaxed whitespace-pre-line ${
                  message.role === "assistant"
                    ? "bg-dark-card text-foreground"
                    : "bg-primary/15 text-foreground"
                }`}
              >
                {message.content}
              </div>
              {message.reference && (
                <div className="mt-2 rounded-r-md border-l-2 border-primary bg-primary/10 px-3 py-2 text-xs text-primary-light">
                  📍 {message.reference}
                </div>
              )}
              <div className="mt-1 text-[10px] text-muted">
                {formatDate(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-dark-border p-4">
        <div className="flex items-center gap-2.5 rounded-xl border-2 border-transparent bg-dark-card p-2.5 transition-all focus-within:border-primary">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="询问关于文档的问题..."
            rows={1}
            className="max-h-[100px] flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-all hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-muted"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
