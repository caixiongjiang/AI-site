"use client";

import { Agent } from "@/lib/types";
import * as Icons from "lucide-react";
import { Edit2, Trash2 } from "lucide-react";

interface AgentInfoProps {
  agent: Agent;
}

export const AgentInfo = ({ agent }: AgentInfoProps) => {
  const IconComponent = (Icons as any)[agent.icon] || Icons.Bot;

  return (
    <div className="border-b border-dark-border p-8">
      {/* Icon */}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary-light/10">
        <IconComponent className="h-8 w-8 text-foreground" />
      </div>

      {/* Name & Category */}
      <h2 className="mb-2 text-2xl font-normal text-foreground">{agent.name}</h2>
      <p className="mb-4 text-sm text-muted">{agent.category}</p>

      {/* Description */}
      <p className="leading-relaxed text-sm text-gray-400">{agent.description}</p>

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-card text-muted transition-all hover:bg-dark-card/80 hover:text-foreground">
          <Edit2 className="h-4 w-4" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-card text-muted transition-all hover:bg-dark-card/80 hover:text-foreground">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
