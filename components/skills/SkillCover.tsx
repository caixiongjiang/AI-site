"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

interface SkillCoverProps {
  name: string;
  category?: string;
  tags?: string[];
  source?: "builtin" | "custom";
  enabled?: boolean;
  coverUrl?: string | null;
  className?: string;
  height?: number | string;
}

// 32-bit FNV-1a 哈希
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 契合网站白底与翡翠绿主色调的封面艺术配色方案
const COVER_THEMES = [
  // 1. 翡翠晨光 (主色调)
  {
    gradient: ["#00B36B", "#00D980", "#EAF8F1"],
    bg: "#F2FBF7",
    accent: "#007A49",
    pattern: "mesh",
  },
  // 2. 薄荷青蓝
  {
    gradient: ["#059669", "#34D399", "#E6FFFA"],
    bg: "#F0FDF4",
    accent: "#047857",
    pattern: "circles",
  },
  // 3. 碧海极光
  {
    gradient: ["#0284C7", "#00B36B", "#E0F2FE"],
    bg: "#F0F9FF",
    accent: "#0369A1",
    pattern: "grid",
  },
  // 4. 紫晶流光
  {
    gradient: ["#7C3AED", "#00B36B", "#F5F3FF"],
    bg: "#FAF5FF",
    accent: "#6D28D9",
    pattern: "waves",
  },
  // 5. 琥珀金芒
  {
    gradient: ["#D97706", "#059669", "#FEF3C7"],
    bg: "#FFFBEB",
    accent: "#B45309",
    pattern: "geometric",
  },
  // 6. 赛博电青
  {
    gradient: ["#0D9488", "#6366F1", "#F0FDFA"],
    bg: "#F0FDF4",
    accent: "#0F766E",
    pattern: "hex",
  },
];

export function SkillCover({
  name,
  category = "general",
  tags = [],
  source = "builtin",
  enabled = true,
  coverUrl,
  className,
  height = 140,
}: SkillCoverProps) {
  const filterId = useId();

  // 根据技能名确定性分配配色与纹理参数
  const theme = useMemo(() => {
    const hash = hashString(name);
    return COVER_THEMES[hash % COVER_THEMES.length];
  }, [name]);

  // 生成图形位置
  const seed = useMemo(() => hashString(`${name}-seed`), [name]);
  const circleX1 = 20 + (seed % 60);
  const circleY1 = 20 + ((seed >> 4) % 60);
  const circleX2 = 60 + ((seed >> 8) % 35);
  const circleY2 = 50 + ((seed >> 12) % 40);

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden select-none transition-all",
        !enabled && "grayscale-[40%] opacity-85",
        className
      )}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        backgroundColor: theme.bg,
      }}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        /* 确定性现代几何艺术 SVG 封面 */
        <svg
          viewBox="0 0 320 140"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`grad-main-${filterId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.gradient[0]} stopOpacity="0.22" />
              <stop offset="60%" stopColor={theme.gradient[1]} stopOpacity="0.12" />
              <stop offset="100%" stopColor={theme.gradient[2]} stopOpacity="0.9" />
            </linearGradient>

            <linearGradient id={`grad-orb1-${filterId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.gradient[0]} stopOpacity="0.75" />
              <stop offset="100%" stopColor={theme.gradient[1]} stopOpacity="0.25" />
            </linearGradient>

            <linearGradient id={`grad-orb2-${filterId}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={theme.gradient[1]} stopOpacity="0.65" />
              <stop offset="100%" stopColor={theme.accent} stopOpacity="0.15" />
            </linearGradient>

            {/* 柔光高斯模糊 */}
            <filter id={`blur-${filterId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" />
            </filter>

            {/* 科技点阵底纹 */}
            <pattern
              id={`dots-${filterId}`}
              x="0"
              y="0"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill={theme.accent} fillOpacity="0.12" />
            </pattern>
          </defs>

          {/* 渐变底色 */}
          <rect width="320" height="140" fill={`url(#grad-main-${filterId})`} />

          {/* 科技点阵网格 */}
          <rect width="320" height="140" fill={`url(#dots-${filterId})`} />

          {/* 柔和流体光斑层 */}
          <g filter={`url(#blur-${filterId})`}>
            <circle cx={circleX1} cy={circleY1} r="48" fill={`url(#grad-orb1-${filterId})`} />
            <circle cx={circleX2} cy={circleY2} r="42" fill={`url(#grad-orb2-${filterId})`} />
            <circle cx="270" cy="30" r="38" fill={theme.gradient[0]} fillOpacity="0.35" />
          </g>

          {/* 几何装饰线条与环 */}
          <g opacity="0.35" stroke={theme.accent} strokeWidth="1" fill="none">
            <circle cx="260" cy="70" r="50" strokeDasharray="4 4" />
            <circle cx="260" cy="70" r="32" />
            <line x1="20" y1="120" x2="300" y2="120" strokeOpacity="0.3" />
            <line x1="280" y1="20" x2="310" y2="20" strokeWidth="2" strokeOpacity="0.5" />
          </g>

          {/* 右下角大尺寸抽象水印几何 */}
          <g opacity="0.12" transform="translate(230, 45)">
            <rect x="0" y="0" width="60" height="60" rx="16" fill={theme.accent} />
          </g>
        </svg>
      )}

      {/* 顶部标签浮层 */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pointer-events-none">
        {/* 左上角分类徽章 */}
        <div className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-xs backdrop-blur-xs ring-1 ring-black/5">
          <span className="capitalize">{category || "Skill"}</span>
        </div>

        {/* 右上角来源标记 */}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium shadow-2xs backdrop-blur-xs ring-1",
            source === "builtin"
              ? "bg-emerald-50/90 text-primary-deep ring-primary/20"
              : "bg-blue-50/90 text-blue-700 ring-blue-200"
          )}
        >
          {source === "builtin" ? "内置" : "自定义"}
        </span>
      </div>

      {/* 底部微光分隔线 */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-300/60 to-transparent" />
    </div>
  );
}
