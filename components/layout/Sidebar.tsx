"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bot,
  Library,
  Lock,
  Settings,
  HelpCircle,
  Info,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ProfileDrawer } from "./ProfileDrawer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

const navItems = [
  { icon: Home, label: "首页", href: "/", requiresAuth: false },
  { icon: Bot, label: "Agent应用", href: "/agents", requiresAuth: true },
  { icon: Library, label: "知识库", href: "/knowledge", requiresAuth: true },
];

const bottomItems = [
  { icon: Settings, label: "设置", href: "/settings" },
  { icon: HelpCircle, label: "帮助", href: "/help" },
];

export const Sidebar = () => {
  const pathname = usePathname() ?? "/";
  const [showProfile, setShowProfile] = useState(false);
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
                           (item.href !== "/" && pathname.startsWith(item.href));
            
            const content = (
              <>
                {isActive && (
                  <span className="absolute -left-2.5 h-5 w-0.5 rounded-r bg-primary" />
                )}
                <Icon className="h-5 w-5 text-foreground" />
                {!isAuthenticated && item.requiresAuth && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1f2426] ring-1 ring-white/10">
                    <Lock className="h-2.5 w-2.5 text-primary-light" />
                  </span>
                )}
              </>
            );

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
                          : "登录以保存和管理你的专属 Agent",
                      description:
                        item.href === "/knowledge"
                          ? "知识库支持上传资料、建立索引并围绕你的私有内容持续问答。登录后这些内容才能安全保存到你的工作区。"
                          : "Agent 设计、发布和个性化配置都需要绑定到你的账号，登录后你的创作成果才能被完整保存。",
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
    </>
  );
};
