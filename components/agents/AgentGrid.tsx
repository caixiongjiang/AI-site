"use client";

import { useState } from "react";
import { Agent } from "@/lib/types";
import { AgentCard } from "./AgentCard";

interface AgentGridProps {
  agents: Agent[];
}

export const AgentGrid = ({ agents }: AgentGridProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      {/* Search Box */}
      <div className="mb-10 flex max-w-[500px] items-center gap-3 rounded-lg border-2 border-transparent bg-dark-card px-5 py-3 transition-all focus-within:border-primary">
        <span className="text-lg">🔍</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索智能体..."
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>

      {/* Grid */}
      {filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <div className="mb-5 text-6xl opacity-50">🤖</div>
          <p className="text-base text-muted">没有找到匹配的智能体</p>
        </div>
      )}
    </div>
  );
};
