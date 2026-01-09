"use client";

import { Agent } from "@/lib/types";
import { Users, Star } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AgentCardProps {
  agent: Agent;
}

export const AgentCard = ({ agent }: AgentCardProps) => {
  // Get icon component dynamically
  const IconComponent = (Icons as any)[agent.icon] || Icons.Bot;

  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border-2 border-transparent bg-dark-card p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl hover:shadow-primary/20",
        agent.featured && "bg-gradient-to-br from-primary/5 to-primary-light/[0.02]"
      )}
    >
      {/* Top Gradient Bar */}
      <div className="absolute left-0 top-0 h-1 w-full rounded-t-2xl bg-gradient-to-r from-primary to-primary-light opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-light/10">
          <IconComponent className="h-6 w-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-base font-medium text-foreground">
            {agent.name}
          </h3>
          <p className="truncate text-xs text-muted">{agent.category}</p>
        </div>
      </div>

      {/* Description */}
      <p className="flex-1 text-sm leading-relaxed text-gray-400 line-clamp-3">
        {agent.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {agent.tags.map((tag) => (
          <span
            key={tag}
            className="rounded border border-primary/30 bg-primary/15 px-2.5 py-1 text-xs text-primary-light"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-dark-border pt-3">
        <div className="flex gap-4 text-xs text-muted">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{agent.stats.users >= 1000 ? `${(agent.stats.users / 1000).toFixed(1)}k` : agent.stats.users}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
            <span className="text-foreground">{agent.stats.rating}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            window.location.href = `/agents/${agent.id}`;
          }}
          className="rounded-md bg-primary px-5 py-1.5 text-xs font-medium text-white transition-all hover:scale-105 hover:bg-primary-light"
        >
          去使用
        </button>
      </div>
    </Link>
  );
};
