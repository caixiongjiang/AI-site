import { AgentGrid } from "@/components/agents/AgentGrid";
import { mockAgents } from "@/lib/mock-data";

export default function AgentsPage() {
  return (
    <div className="min-h-screen p-10 md:p-15">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <h1 className="text-4xl font-light text-foreground">智能体应用中心</h1>
      </div>

      {/* Section Title */}
      <h2 className="mb-6 text-xl font-normal text-gray-300">官方智能体</h2>

      {/* Agent Grid */}
      <AgentGrid agents={mockAgents} />
    </div>
  );
}
