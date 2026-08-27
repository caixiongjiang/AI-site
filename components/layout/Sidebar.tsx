"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  HelpCircle,
  Info,
  LogOut,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ProfileDrawer } from "./ProfileDrawer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { FEATURES, type FeatureConfig } from "@/lib/features";

const bottomItems = [
  { icon: Settings, label: "设置", href: "/settings" },
  { icon: HelpCircle, label: "帮助", href: "/help" },
];

export const Sidebar = () => {
  const pathname = usePathname() ?? "/";
  const [showProfile, setShowProfile] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<FeatureConfig | null>(null);
  const { isAuthenticated, logout, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const avatarText =
    user?.name?.trim()?.[0] ||
    user?.username?.trim()?.[0] ||
    user?.email?.trim()?.[0] ||
    "我";

  return (
    <>
      <aside className="fixed left-0 top-0 z-[1000] flex h-screen w-[60px] flex-col items-center bg-dark-card py-5">
        {/* User Avatar */}
        <button
          onClick={() => {
            if (!isAuthenticated) {
              openAuthModal({
                title: "登录后即可开启你的专属工作区",
                description:
                  "登录后你可以保存聊天历史、同步知识库与专属 Agent，右上角头像也会切换为你的个人空间入口。",
                nextPath: pathname,
                featureLabel: "个人工作区",
              });
              return;
            }

            setShowProfile(true);
          }}
          className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light text-white font-bold transition-transform hover:scale-110"
          aria-label="用户中心"
        >
          {avatarText.toUpperCase()}
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col gap-5">
          {FEATURES.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
                           (item.href !== "/" && pathname.startsWith(item.href));

            const showLockBadge =
              item.locked || (!isAuthenticated && item.requiresAuth);

            const content = (
              <>
                {isActive && (
                  <span className="absolute -left-2.5 h-5 w-0.5 rounded-r bg-primary" />
                )}
                <Icon className="h-5 w-5 text-foreground" />
                {showLockBadge && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1f2426] ring-1 ring-white/10">
                    <Lock className="h-2.5 w-2.5 text-primary-light" />
                  </span>
                )}
              </>
            );

            // 始终锁定（敬请期待）：登录前后都不可进入
            if (item.locked) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => setLockedFeature(item)}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                    isActive ? "bg-primary/20" : "hover:bg-primary/10"
                  )}
                  aria-label={item.label}
                >
                  {content}
                </button>
              );
            }

            // 需登录：未登录时弹登录 modal
            if (!isAuthenticated && item.requiresAuth) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() =>
                    openAuthModal({
                      title:
                        item.href === "/knowledge"
                          ? "登录以构建你的专属知识库"
                          : "登录以使用" + item.label,
                      description:
                        item.href === "/knowledge"
                          ? "知识库支持上传资料、建立索引并围绕你的私有内容持续问答。登录后这些内容才能安全保存到你的工作区。"
                          : "「" + item.label + "」需要绑定到你的账号，登录后才能完整保存与使用。",
                      nextPath: item.href,
                      featureLabel: item.label,
                    })
                  }
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                    isActive ? "bg-primary/20" : "hover:bg-primary/10"
                  )}
                  aria-label={item.label}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                  isActive ? "bg-primary/20" : "hover:bg-primary/10"
                )}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Items */}
        <div className="flex flex-col gap-4">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-primary/10"
                aria-label={item.label}
              >
                <Icon className="h-5 w-5 text-foreground" />
              </Link>
            );
          })}

          {/* Profile Info Button */}
          <button
            onClick={() => setShowProfile(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-primary/10"
            aria-label="作者简介"
          >
            <Info className="h-5 w-5 text-foreground" />
          </button>
          {isAuthenticated && (
            <button
              onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-red-500/10"
              aria-label="退出登录"
            >
              <LogOut className="h-5 w-5 text-foreground" />
            </button>
          )}
        </div>
      </aside>

      <ProfileDrawer isOpen={showProfile} onClose={() => setShowProfile(false)} />

      {lockedFeature && (
        <ComingSoonModal
          feature={lockedFeature}
          onClose={() => setLockedFeature(null)}
          onLogin={() => {
            const feature = lockedFeature;
            setLockedFeature(null);
            openAuthModal({
              title: "登录后解锁更多能力",
              description:
                "「" + feature.label + "」暂未开放，登录后可先使用「知识库」与「技能」模块。",
              featureLabel: feature.label,
            });
          }}
        />
      )}
    </>
  );
};

function ComingSoonModal({
  feature,
  onClose,
  onLogin,
}: {
  feature: FeatureConfig;
  onClose: () => void;
  onLogin: () => void;
}) {
  const { isAuthenticated } = useAuth();
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-dark-border bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.12),transparent_70%)]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-gray-100 hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-7">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </div>

          <h2 id="coming-soon-title" className="mt-5 text-2xl text-foreground">
            {feature.label} · 敬请期待
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            该模块正在打磨中，暂未开放使用。
            {isAuthenticated
              ? "你可以先使用左侧的「知识库」与「技能」继续你的工作。"
              : "登录后可先使用「知识库」与「技能」模块。"}
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-dark-border bg-dark-card px-3 py-1.5 text-xs text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {feature.label}
          </div>

          <div className="mt-7 space-y-3">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={onLogin}
                className="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-primary-light"
              >
                登录 / 注册
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-2xl border border-dark-border px-4 py-3 text-sm text-foreground transition hover:bg-gray-50"
            >
              知道了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
