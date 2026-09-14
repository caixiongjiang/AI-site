"use client";

import { ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ProfilePanel } from "@/components/layout/ProfilePanel";

/**
 * 移动端「我的」标签页。
 *
 * 桌面端个人空间是左侧抽屉（ProfileDrawer），移动端按「一个标签一个页面」的
 * 约定落在独立路由上，因此这里只是把同一份 ProfilePanel 放进页面壳里。
 */
export default function ProfilePage() {
  const { isAuthenticated } = useAuth();

  return (
    <RequireAuth
      featureLabel="个人空间"
      title="登录后查看你的个人空间"
      description="登录后可以管理头像、昵称与简介，并同步你的知识库与专属智能体配置。"
      nextPath="/profile"
    >
      <div className="min-h-[calc(100dvh-3.5rem)] w-full bg-gray-50/60 md:min-h-screen">
        <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3.5 sm:px-6">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-deep ring-1 ring-primary/15">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">个人空间</span>
            {isAuthenticated ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-deep ring-1 ring-primary/20">
                <ShieldCheck className="h-3 w-3" />
                已登录
              </span>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl px-4 py-4 pb-8 sm:px-6">
          <ProfilePanel />
        </main>
      </div>
    </RequireAuth>
  );
}
