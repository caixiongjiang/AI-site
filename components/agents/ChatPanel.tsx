"use client";

import { useState } from "react";
import { Send, Library, Paperclip, MessageSquare, MoreHorizontal, X } from "lucide-react";
import { Message, MountedSource } from "@/lib/types";
import { MountModal } from "./MountModal";
import { formatDate } from "@/lib/utils";

interface ChatPanelProps {
  agentName: string;
}

export const ChatPanel = ({ agentName }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `您好，我是${agentName}助手。请先在左侧挂载您的相关文件或知识库，我才能开始为您工作。`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [mountedSources, setMountedSources] = useState<MountedSource[]>([]);
  const [showMountModal, setShowMountModal] = useState(false);

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
      const aiMessage: Message = {
        role: "assistant",
        content: "正在分析您的问题，请稍候...",
        reference: mountedSources.length > 0 ? `参考：${mountedSources[0].name}` : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 500);
  };

  const handleRemoveSource = (index: number) => {
    setMountedSources((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex w-[480px] shrink-0 flex-col border-l border-dark-border bg-[#1E1E1E]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-border p-5">
        <h3 className="text-base text-foreground">问答</h3>
        <div className="flex gap-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-all hover:bg-dark hover:text-foreground">
            <MessageSquare className="h-4 w-4" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-all hover:bg-dark hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mounted Sources */}
      {mountedSources.length > 0 && (
        <div className="border-b border-dark-border p-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">
            已挂载的知识源
          </div>
          <div className="flex flex-wrap gap-2">
            {mountedSources.map((source, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs text-primary-light"
              >
                <span>{source.name}</span>
                <button
                  onClick={() => handleRemoveSource(index)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((message, index) => (
          <div key={index} className="flex gap-2.5 animate-fadeIn">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                message.role === "assistant"
                  ? "bg-gradient-to-br from-primary to-primary-light text-white"
                  : "bg-dark-border text-foreground"
              }`}
            >
              {message.role === "assistant" ? "🤖" : "👤"}
            </div>
            <div className="flex-1">
              <div
                className={`rounded-xl p-3 text-sm leading-relaxed ${
                  message.role === "assistant"
                    ? "bg-dark-card text-foreground"
                    : "bg-primary/15 text-foreground"
                }`}
              >
                {message.content}
              </div>
              {message.reference && (
                <div className="mt-2 rounded-r-md border-l-2 border-primary bg-primary/10 px-3 py-2 text-xs text-primary-light">
                  {message.reference}
                </div>
              )}
              <div className="mt-1 ml-1 text-[10px] text-muted">
                {formatDate(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-dark-border p-4">
        {/* Toolbar */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setShowMountModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-dark-border bg-dark-card px-3 py-1.5 text-xs text-muted transition-all hover:border-primary hover:text-foreground"
          >
            <Library className="h-3.5 w-3.5" />
            <span>挂载知识库</span>
          </button>
          <button className="flex items-center gap-1.5 rounded-md border border-dark-border bg-dark-card px-3 py-1.5 text-xs text-muted transition-all hover:border-primary hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            <span>上传文件</span>
          </button>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2.5 rounded-xl border-2 border-transparent bg-dark-card p-3 transition-all focus-within:border-primary">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入您的问题，或粘贴内容..."
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

      {/* Mount Modal */}
      <MountModal
        isOpen={showMountModal}
        onClose={() => setShowMountModal(false)}
        onConfirm={(sources) => {
          setMountedSources((prev) => [...prev, ...sources]);
        }}
      />
    </div>
  );
};
