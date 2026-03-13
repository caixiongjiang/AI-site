"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isReady, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    const next =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || "/"
        : "/";
    setNextPath(next);
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, isReady, nextPath, router]);

  const handleLogin = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await login(nextPath);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "跳转 Logto 登录失败，请重试"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.22),transparent_30%),linear-gradient(180deg,#111314_0%,#0a0c0d_100%)] px-6 py-12">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.03)_35%,transparent_70%)]" />
      <div className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-[#121516]/90 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-light">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-3xl text-foreground">统一登录</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            使用 Logto 完成身份认证，登录后即可访问知识库、Agent 和文件操作能力。
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-dark-card px-4 py-4 text-sm leading-6 text-muted">
            当前页面不会直接采集用户名和密码，点击下方按钮后会跳转到你部署好的 Logto 服务端完成登录。
          </div>
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={isSubmitting || !isReady}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isSubmitting ? "正在跳转到 Logto..." : "前往 Logto 登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
