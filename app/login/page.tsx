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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.12),transparent_40%)]" />
      <div className="relative w-full max-w-md rounded-[28px] border border-gray-200 bg-white p-8 shadow-2xl">
        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-deep">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-foreground">统一登录</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            使用 Logto 完成身份认证，登录后即可访问知识库、Agent 和文件操作能力。
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-muted">
            当前页面不会直接采集用户名和密码，点击下方按钮后会跳转到你部署好的 Logto 服务端完成登录。
          </div>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={isSubmitting || !isReady}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60 shadow-md shadow-primary/20"
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
