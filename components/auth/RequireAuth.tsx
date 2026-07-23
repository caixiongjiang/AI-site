"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

interface RequireAuthProps {
  /** 当前特性名（展示用） */
  featureLabel: string;
  title: string;
  description: string;
  /** 登录后回到的路径，默认当前页 */
  nextPath?: string;
  children: React.ReactNode;
}

/**
 * 登录前置守卫：未登录时展示统一的「锁定 + 登录」全屏卡片，
 * 已登录则直接渲染 children。
 *
 * 用于「登录前锁定、登录后解锁」的特性（知识库 / 技能）。
 * 与 LockedFeatureScreen 不同：后者是「始终锁定（敬请期待）」。
 */
export function RequireAuth({
  featureLabel,
  title,
  description,
  nextPath,
  children,
}: RequireAuthProps) {
  const { isAuthenticated, isReady } = useAuth();
  const { openAuthModal } = useAuthModal();

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.08),transparent_35%)]" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary-light">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-light text-foreground">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted">{description}</p>
        <button
          type="button"
          disabled={!isReady}
          onClick={() =>
            openAuthModal({
              title,
              description,
              featureLabel,
              ...(nextPath ? { nextPath } : {}),
            })
          }
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          登录 / 注册
        </button>
      </div>
    </div>
  );
}
