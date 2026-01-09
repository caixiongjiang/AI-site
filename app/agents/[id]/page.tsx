"use client";

import { use } from "react";
import { mockAgents } from "@/lib/mock-data";
import { AgentInfo } from "@/components/agents/AgentInfo";
import { ChatPanel } from "@/components/agents/ChatPanel";
import { Check } from "lucide-react";
import Link from "next/link";

export default function AgentUsagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const agent = mockAgents.find((a) => a.id === id) || mockAgents[0];

  return (
    <div className="flex h-screen">
      {/* Left Panel: Agent List */}
      <aside className="w-[280px] shrink-0 border-r border-dark-border bg-[#1E1E1E]">
        <div className="border-b border-dark-border p-5">
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">
            代理列表
          </div>
          <Link
            href="/agents"
            className="w-full rounded-lg border border-dashed border-primary px-3 py-2.5 text-center text-xs text-primary transition-all hover:bg-primary/10 block"
          >
            + 浏览更多智能体
          </Link>
        </div>
        <div className="space-y-2 p-3">
          {mockAgents.slice(0, 6).map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className={`block rounded-lg p-3 transition-all ${
                a.id === id
                  ? "border-l-2 border-primary bg-primary/15"
                  : "hover:bg-dark-card"
              }`}
            >
              <div className="mb-1 text-sm text-foreground">{a.name}</div>
              <div className="text-xs text-muted">{a.category}</div>
            </Link>
          ))}
        </div>
      </aside>

      {/* Middle Panel: Agent Info & Usage */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <AgentInfo agent={agent} />

        <div className="p-8">
          <h3 className="mb-4 text-base font-medium text-foreground">使用说明</h3>
          <div className="rounded-xl border border-dark-border bg-dark-card p-6">
            {/* Main Features */}
            <div className="mb-5 pb-5 border-b border-dark-border">
              <div className="mb-2 text-xs text-muted">主要功能</div>
              <p className="text-sm leading-relaxed text-gray-300">
                该智能体可以帮助您快速处理相关任务。请在右侧对话框中输入您的需求，或挂载相关知识库以获得更精准的结果。
              </p>
            </div>

            {/* Usage Methods */}
            <div className="mb-5 pb-5 border-b border-dark-border">
              <div className="mb-3 text-xs text-muted">使用方式</div>
              <ul className="space-y-2">
                {[
                  "在右侧对话框中直接输入问题或需求",
                  "点击"挂载知识库"快速关联您的文档库",
                  "上传文件进行专业分析",
                  "查看分析结果并获取建议",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Applicable Scenarios */}
            <div>
              <div className="mb-3 text-xs text-muted">适用场景</div>
              <div className="flex flex-wrap gap-2">
                {agent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-primary/30 bg-primary/15 px-3 py-1 text-xs text-primary-light"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel: Chat */}
      <ChatPanel agentName={agent.name} />
    </div>
  );
}
