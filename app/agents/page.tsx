"use client";

import { AgentGrid } from "@/components/agents/AgentGrid";
import { mockAgents } from "@/lib/mock-data";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { Bot } from "lucide-react";

export default function AgentsPage() {
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  return (
    <div className="min-h-screen p-10 md:p-15">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <h1 className="text-4xl font-light text-foreground">智能体应用中心</h1>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              openAuthModal({
                title: "登录以保存你设计的 Agent",
                description:
                  "你可以先浏览和体验智能体能力，但当你准备创建、保存、发布或关联知识库时，需要先登录以保留这些成果。",
                nextPath: "/agents",
                featureLabel: "专属 Agent 设计",
              });
            }
          }}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground transition hover:border-primary/40 hover:bg-white/10"
        >
          <Bot className="h-4 w-4" />
          {isAuthenticated ? "创建专属 Agent" : "登录后创建专属 Agent"}
        </button>
      </div>

      {/* Section Title */}
      <h2 className="mb-6 text-xl font-normal text-gray-300">官方智能体</h2>

      {/* Agent Grid */}
      <AgentGrid agents={mockAgents} />
    </div>
  );
}
