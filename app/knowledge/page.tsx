"use client";

import { useState } from "react";
import { mockKnowledgeBases, mockFiles } from "@/lib/mock-data";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import { FileGrid } from "@/components/knowledge/FileGrid";
import { DocumentView } from "@/components/knowledge/DocumentView";
import { ChatSidebar } from "@/components/knowledge/ChatSidebar";
import { FileItem } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KnowledgePage() {
  const [selectedKbId, setSelectedKbId] = useState<string>(mockKnowledgeBases[0].id);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [showChat, setShowChat] = useState(false);

  const selectedKb = mockKnowledgeBases.find((kb) => kb.id === selectedKbId);
  const files = mockFiles.filter((f) => f.kbId === selectedKbId);

  const handleBackToList = () => {
    setSelectedFile(null);
    setShowChat(false);
  };

  return (
    <div className="flex h-screen">
      {/* Left: Knowledge Base List */}
      <KnowledgeList
        knowledgeBases={mockKnowledgeBases}
        selectedId={selectedKbId}
        onSelect={(id) => {
          setSelectedKbId(id);
          setSelectedFile(null);
          setShowChat(false);
        }}
      />

      {/* Middle: File Grid or Document View */}
      <main
        className={cn(
          "flex flex-1 flex-col overflow-y-auto transition-all",
          showChat && "mr-[420px]"
        )}
      >
        {/* Header */}
        <div className="border-b border-dark-border p-8">
          <div>
            <h1 className="mb-2 text-2xl text-foreground">
              {selectedFile ? selectedFile.name : selectedKb?.name}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted">
              <button
                onClick={() => setSelectedKbId(selectedKbId)}
                className="text-primary transition-colors hover:text-primary-light"
              >
                知识库
              </button>
              <span>›</span>
              <span>{selectedKb?.name}</span>
              {selectedFile && (
                <>
                  <span>›</span>
                  <span>{selectedFile.name}</span>
                </>
              )}
            </div>
          </div>
          {selectedFile && (
            <button
              onClick={handleBackToList}
              className="mt-4 flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-4 py-2 text-sm text-foreground transition-all hover:border-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回列表</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-8">
          {selectedFile ? (
            <DocumentView
              file={selectedFile}
              kbName={selectedKb?.name || ""}
              onAskClick={() => setShowChat(true)}
            />
          ) : (
            <FileGrid
              files={files}
              onFileClick={(file) => setSelectedFile(file)}
            />
          )}
        </div>
      </main>

      {/* Right: Chat Sidebar */}
      {selectedFile && (
        <ChatSidebar
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          documentName={selectedFile.name}
        />
      )}
    </div>
  );
}
