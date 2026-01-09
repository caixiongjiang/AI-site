"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Bot,
  Library,
  Settings,
  HelpCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ProfileDrawer } from "./ProfileDrawer";

const navItems = [
  { icon: Home, label: "首页", href: "/" },
  { icon: Bot, label: "Agent应用", href: "/agents" },
  { icon: Library, label: "知识库", href: "/knowledge" },
];

const bottomItems = [
  { icon: Settings, label: "设置", href: "/settings" },
  { icon: HelpCircle, label: "帮助", href: "/help" },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <aside className="fixed left-0 top-0 z-[1000] flex h-screen w-[60px] flex-col items-center bg-dark-card py-5">
        {/* User Avatar */}
        <button
          onClick={() => setShowProfile(true)}
          className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light text-white font-bold transition-transform hover:scale-110"
          aria-label="用户中心"
        >
          蔡
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col gap-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
                           (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                  isActive
                    ? "bg-primary/20"
                    : "hover:bg-primary/10"
                )}
                aria-label={item.label}
              >
                {isActive && (
                  <span className="absolute -left-2.5 h-5 w-0.5 rounded-r bg-primary" />
                )}
                <Icon className="h-5 w-5 text-foreground" />
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
        </div>
      </aside>

      <ProfileDrawer isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
};
