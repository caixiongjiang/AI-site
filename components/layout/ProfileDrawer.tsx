"use client";

import { X, Mail, Github, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileDrawer = ({ isOpen, onClose }: ProfileDrawerProps) => {
  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[998] bg-black/50 transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed left-[60px] top-0 z-[999] flex h-screen w-[400px] flex-col bg-[#1E1E1E] border-r border-dark-border shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 to-primary-light/5 border-b border-dark-border p-8">
          <button
            onClick={onClose}
            className="float-right flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-all hover:bg-red-500/20 hover:text-red-500"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="mt-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-light text-4xl font-bold text-white">
            蔡
          </div>
          
          <h2 className="mt-5 text-2xl text-foreground">蔡雄江</h2>
          <p className="mt-2 text-sm text-muted">全栈开发工程师 · AI产品设计师</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* About Section */}
          <section className="mb-8">
            <h3 className="mb-4 text-xs uppercase tracking-wider text-muted">
              关于我
            </h3>
            <p className="leading-relaxed text-sm text-gray-300">
              热爱技术，专注于人工智能和知识管理领域的产品设计与开发。致力于通过技术创新提升知识工作者的效率，让AI真正成为每个人的智能助手。
            </p>
          </section>

          {/* Stats Section */}
          <section className="mb-8">
            <h3 className="mb-4 text-xs uppercase tracking-wider text-muted">
              统计数据
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-dark-card p-4 text-center">
                <div className="mb-1 text-2xl font-bold text-primary">16</div>
                <div className="text-xs text-muted">智能体</div>
              </div>
              <div className="rounded-lg bg-dark-card p-4 text-center">
                <div className="mb-1 text-2xl font-bold text-primary">234</div>
                <div className="text-xs text-muted">知识库</div>
              </div>
              <div className="rounded-lg bg-dark-card p-4 text-center">
                <div className="mb-1 text-2xl font-bold text-primary">1.2k</div>
                <div className="text-xs text-muted">对话数</div>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="mb-8">
            <h3 className="mb-4 text-xs uppercase tracking-wider text-muted">
              联系方式
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:caixiongjiang@example.com"
                className="flex items-center gap-3 rounded-lg bg-dark-card p-3 transition-all hover:border-l-2 hover:border-primary hover:bg-dark-card/80"
              >
                <Mail className="h-5 w-5 text-foreground" />
                <span className="text-sm text-foreground">caixiongjiang@example.com</span>
              </a>
              <a
                href="https://github.com/caixiongjiang"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg bg-dark-card p-3 transition-all hover:border-l-2 hover:border-primary hover:bg-dark-card/80"
              >
                <Github className="h-5 w-5 text-foreground" />
                <span className="text-sm text-foreground">GitHub: @caixiongjiang</span>
              </a>
              <a
                href="#"
                className="flex items-center gap-3 rounded-lg bg-dark-card p-3 transition-all hover:border-l-2 hover:border-primary hover:bg-dark-card/80"
              >
                <Globe className="h-5 w-5 text-foreground" />
                <span className="text-sm text-foreground">个人网站</span>
              </a>
            </div>
          </section>

          {/* Tech Stack Section */}
          <section>
            <h3 className="mb-4 text-xs uppercase tracking-wider text-muted">
              技术栈
            </h3>
            <div className="space-y-2 text-sm leading-relaxed text-gray-300">
              <p><strong className="text-foreground">前端：</strong>React, Vue, TypeScript</p>
              <p><strong className="text-foreground">后端：</strong>Python, Node.js, FastAPI</p>
              <p><strong className="text-foreground">AI：</strong>LangChain, OpenAI, Vector Database</p>
              <p><strong className="text-foreground">设计：</strong>Figma, Sketch, 交互原型</p>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
};
