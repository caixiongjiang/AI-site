"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-8xl font-bold text-transparent">
          404
        </h1>
        <h2 className="mb-2 text-2xl text-foreground">页面未找到</h2>
        <p className="mb-8 text-muted">
          抱歉，您访问的页面不存在或已被移除
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-all hover:bg-primary-light"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-6 py-3 text-sm font-medium text-foreground transition-all hover:border-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
