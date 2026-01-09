"use client";

import { FileItem } from "@/lib/types";
import * as Icons from "lucide-react";
import { mockDocumentContent } from "@/lib/mock-data";

interface DocumentViewProps {
  file: FileItem;
  kbName: string;
  onAskClick: () => void;
}

export const DocumentView = ({ file, kbName, onAskClick }: DocumentViewProps) => {
  const IconComponent = (Icons as any)[file.icon] || Icons.FileText;

  return (
    <div className="mx-auto max-w-[900px]">
      {/* Header */}
      <div className="mb-8 border-b border-dark-border pb-5">
        <div className="mb-3 flex items-center gap-3">
          <IconComponent className="h-8 w-8 text-foreground" />
          <h1 className="text-3xl text-foreground">{file.name}</h1>
        </div>
        <div className="flex gap-5 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <Icons.Package className="h-3.5 w-3.5" />
            <span>{file.size}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icons.Library className="h-3.5 w-3.5" />
            <span>{kbName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icons.Clock className="h-3.5 w-3.5" />
            <span>{file.lastUpdated}更新</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-8 rounded-xl bg-dark-card p-8 leading-relaxed text-sm text-gray-300">
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{
            __html: mockDocumentContent
              .split("\n")
              .map((line) => {
                if (line.startsWith("# ")) {
                  return `<h1 class="text-foreground text-xl font-medium mt-6 mb-3">${line.slice(2)}</h1>`;
                }
                if (line.startsWith("## ")) {
                  return `<h2 class="text-foreground text-lg font-medium mt-5 mb-2.5">${line.slice(3)}</h2>`;
                }
                if (line.trim()) {
                  return `<p class="mb-4">${line}</p>`;
                }
                return "";
              })
              .join(""),
          }}
        />
      </div>

      {/* Ask Button */}
      <div className="sticky bottom-8 flex justify-center">
        <button
          onClick={onAskClick}
          className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-primary to-primary-light px-8 py-3.5 font-medium text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40"
        >
          <Icons.Bot className="h-5 w-5" />
          <span>问问小蔡</span>
        </button>
      </div>
    </div>
  );
};
