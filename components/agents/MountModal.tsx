"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { mockKnowledgeBases, mockFiles } from "@/lib/mock-data";
import * as Icons from "lucide-react";
import { MountedSource } from "@/lib/types";

interface MountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sources: MountedSource[]) => void;
}

export const MountModal = ({ isOpen, onClose, onConfirm }: MountModalProps) => {
  const [activeTab, setActiveTab] = useState<"knowledge" | "files">("knowledge");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleConfirm = () => {
    const sources: MountedSource[] = [];
    
    if (activeTab === "knowledge") {
      mockKnowledgeBases
        .filter((kb) => selectedItems.has(kb.id))
        .forEach((kb) => {
          sources.push({
            name: kb.name,
            type: "kb",
            icon: kb.icon,
          });
        });
    } else {
      mockFiles
        .filter((file) => selectedItems.has(file.id))
        .forEach((file) => {
          sources.push({
            name: file.name,
            type: "file",
            icon: file.icon,
          });
        });
    }

    onConfirm(sources);
    setSelectedItems(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const items = activeTab === "knowledge" ? mockKnowledgeBases : mockFiles;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[2000] animate-fadeIn bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[2001] flex max-h-[80vh] w-[90%] max-w-[700px] -translate-x-1/2 -translate-y-1/2 animate-slideUp flex-col rounded-2xl bg-dark-card shadow-2xl">
        {/* Header */}
        <div className="border-b border-dark-border p-6">
          <h2 className="mb-4 text-lg text-foreground">挂载知识库/文件</h2>
          <div className="flex gap-6">
            <button
              onClick={() => {
                setActiveTab("knowledge");
                setSelectedItems(new Set());
              }}
              className={cn(
                "border-b-2 pb-2 text-sm transition-colors",
                activeTab === "knowledge"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              我的知识库
            </button>
            <button
              onClick={() => {
                setActiveTab("files");
                setSelectedItems(new Set());
              }}
              className={cn(
                "border-b-2 pb-2 text-sm transition-colors",
                activeTab === "files"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              工作空间文件
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.map((item) => {
            const IconComponent = (Icons as any)[item.icon] || Icons.FileText;
            const isSelected = selectedItems.has(item.id);

            return (
              <button
                key={item.id}
                onClick={() => handleToggle(item.id)}
                className="mb-2 flex w-full items-center gap-3 rounded-lg p-3 transition-all hover:bg-primary/5"
              >
                <div
                  className={cn(
                    "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted"
                  )}
                >
                  {isSelected && (
                    <span className="text-xs text-white">✓</span>
                  )}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <IconComponent className="h-4.5 w-4.5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm text-foreground">{item.name}</div>
                  <div className="text-xs text-muted">
                    {"fileCount" in item
                      ? `${item.fileCount}个文件 · 最后更新: ${item.lastUpdated}`
                      : `${"size" in item ? item.size : ""} · 上传于: ${item.lastUpdated}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-dark-border p-5">
          <span className="text-xs text-muted">
            已选择 {selectedItems.size} 项
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-6 py-2 text-sm text-muted transition-all hover:bg-dark hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className="rounded-lg bg-primary px-6 py-2 text-sm text-white transition-all hover:bg-primary-light disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-muted"
            >
              确认挂载
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
