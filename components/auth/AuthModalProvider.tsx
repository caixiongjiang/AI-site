"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import { LockKeyhole, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

interface AuthModalOptions {
  title: string;
  description: string;
  nextPath?: string;
  featureLabel?: string;
}

interface AuthModalContextValue {
  openAuthModal: (options: AuthModalOptions) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const { login, isReady } = useAuth();
  const [options, setOptions] = useState<AuthModalOptions | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOpen = Boolean(options);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      openAuthModal: (nextOptions) => {
        setOptions(nextOptions);
      },
      closeAuthModal: () => {
        setOptions(null);
      },
    }),
    []
  );

  const handleLogin = async () => {
    if (!options) return;

    setIsSubmitting(true);

    try {
      await login(options.nextPath || pathname);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthModalContext.Provider value={value}>
      {children}

      {isOpen && options && (
        <>
          <div
            className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm"
            onClick={() => setOptions(null)}
          />
          <div className="fixed inset-0 z-[1201] flex items-center justify-center px-6">
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#101314] shadow-[0_40px_160px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(0,217,128,0.22),transparent_70%)]" />
              <button
                type="button"
                onClick={() => setOptions(null)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative p-7">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-light">
                  <LockKeyhole className="h-5 w-5" />
                </div>

                <h2 className="mt-5 text-2xl text-foreground">{options.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {options.description}
                </p>

                {options.featureLabel && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200">
                    <Sparkles className="h-3.5 w-3.5 text-primary-light" />
                    {options.featureLabel}
                  </div>
                )}

                <div className="mt-7 space-y-3">
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={!isReady || isSubmitting}
                    className="flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "正在跳转到 Logto..." : "登录 / 注册后继续"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOptions(null)}
                    className="flex w-full items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm text-foreground transition hover:bg-white/5"
                  >
                    继续先逛逛
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }

  return context;
}
