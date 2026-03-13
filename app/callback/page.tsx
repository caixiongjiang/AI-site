"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { handleLogtoCallback } from "@/lib/logto";

export default function CallbackPage() {
  const router = useRouter();
  const { completeLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { session, nextPath } = await handleLogtoCallback(
          new URLSearchParams(window.location.search)
        );

        if (cancelled) return;

        completeLogin(session);
        router.replace(nextPath);
      } catch (callbackError) {
        if (cancelled) return;

        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "处理登录回调失败"
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [completeLogin, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.22),transparent_30%),linear-gradient(180deg,#111314_0%,#0a0c0d_100%)] px-6">
      <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#121516]/90 p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur">
        {error ? (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-red-300" />
            <h1 className="mt-4 text-2xl text-foreground">登录回调失败</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{error}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black"
            >
              返回登录页
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-primary-light" />
            <h1 className="mt-4 text-2xl text-foreground">正在完成登录</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              正在与 Logto 交换令牌并恢复你的登录态，请稍候。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
