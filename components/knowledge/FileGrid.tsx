"use client";

import { FileItem } from "@/lib/types";
import * as Icons from "lucide-react";

interface FileGridProps {
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
}

export const FileGrid = ({ files, onFileClick }: FileGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {files.map((file) => {
        const IconComponent = (Icons as any)[file.icon] || Icons.FileText;

        return (
          <button
            key={file.id}
            onClick={() => onFileClick(file)}
            className="group flex flex-col gap-3 rounded-xl border border-dark-border bg-dark-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/10"
          >
            <IconComponent className="h-9 w-9 text-foreground" />
            <div className="flex-1">
              <div className="mb-1 text-sm font-medium text-foreground line-clamp-2">
                {file.name}
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>{file.size}</span>
                <span>{file.lastUpdated}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
