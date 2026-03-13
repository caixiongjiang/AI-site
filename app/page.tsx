"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  LogIn,
  MessageSquareText,
  Plus,
  Sparkles,
} from "lucide-react";
import { SearchInput } from "@/components/home/SearchInput";
import { QuickActions } from "@/components/home/QuickActions";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import {
  HomeConversation,
  clearPendingHomeAction,
  countUserMessages,
  createConversation,
  createMessage,
  getPendingHomeAction,
  listHomeConversations,
  saveHomeConversation,
  setPendingHomeAction,
} from "@/lib/home-chat";
import { formatDate } from "@/lib/utils";

const DRAFT_STORAGE_KEY = "ai_site_home_draft";
const GUEST_MESSAGE_LIMIT = 5;

function buildAssistantReply(input: string): string {
  if (input.includes("总结")) {
    return "我可以先帮你抽取核心结论、关键依据和待确认事项，再把它整理成适合继续追问的摘要结构。登录后，这些内容会自动保存在你的历史记录中。";
  }

  if (input.includes("方案") || input.includes("计划")) {
    return "这类问题通常适合先明确目标、约束条件和输出形式。我可以继续帮你把它拆成执行步骤、风险点与里程碑，形成更像工作底稿的结果。";
  }

  return "这是首页的免登录体验对话。我已经记住了你刚刚的问题和上下文，你可以继续追问；如果现在登录，这段对话会自动归档进你的个人历史记录里。";
}

function createStarterConversation(): HomeConversation {
  return createConversation(
    createMessage(
      "assistant",
      "你好，我是你的通用 AI 助手。这里可以先免登录体验多轮对话；当你需要保存历史、继续深聊或启用高级能力时，再登录也不迟。"
    )
  );
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const userId = user?.id || user?.user_id || user?.sub || null;
  const [draft, setDraft] = useState("");
  const [conversations, setConversations] = useState<HomeConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [showHistory, setShowHistory] = useState(false);
  const [hasHydratedConversations, setHasHydratedConversations] = useState(false);

  useEffect(() => {
    const cachedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (cachedDraft) {
      setDraft(cachedDraft);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, draft);
  }, [draft]);

  useEffect(() => {
    const nextConversations = listHomeConversations(userId);
    setConversations(nextConversations);
    setActiveConversationId(nextConversations[0]?.id ?? null);
    setHasHydratedConversations(true);
  }, [userId, isAuthenticated]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [activeConversationId, conversations]
  );

  const guestMessagesUsed = countUserMessages(activeConversation);
  const guestRemaining = Math.max(GUEST_MESSAGE_LIMIT - guestMessagesUsed, 0);
  const shouldShowInlineUpgrade = !isAuthenticated && guestRemaining === 0;

  const persistConversation = (conversation: HomeConversation) => {
    const nextConversations = saveHomeConversation(userId, conversation);
    setConversations(nextConversations);
    setActiveConversationId(conversation.id);
  };

  const ensureConversation = (): HomeConversation => {
    if (activeConversation) {
      return activeConversation;
    }

    const starterConversation = createStarterConversation();
    persistConversation(starterConversation);
    return starterConversation;
  };

  const sendMessage = (message: string) => {
    const content = message.trim();
    if (!content) return;
    if (!isAuthenticated && guestRemaining <= 0) return;

    const currentConversation = ensureConversation();
    const userMessage = createMessage("user", content);
    const assistantMessage = createMessage("assistant", buildAssistantReply(content));
    const nextConversation: HomeConversation = {
      ...currentConversation,
      title:
        currentConversation.title === "新的对话"
          ? content.slice(0, 18)
          : currentConversation.title,
      messages: [...currentConversation.messages, userMessage, assistantMessage],
      updatedAt: assistantMessage.timestamp,
    };

    persistConversation(nextConversation);
    setDraft("");
  };

  useEffect(() => {
    if (!isAuthenticated || !hasHydratedConversations) return;

    const pendingAction = getPendingHomeAction();
    if (!pendingAction || pendingAction.type !== "resume-home-chat") return;

    clearPendingHomeAction();
    sendMessage(pendingAction.message);
  }, [hasHydratedConversations, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const openUpgradeModal = (title: string, description: string) => {
    openAuthModal({
      title,
      description,
      nextPath: "/",
      featureLabel: "对话记录与持续上下文",
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-8 md:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,179,107,0.08),transparent_35%)]" />

      <div className="absolute right-8 top-8 z-20 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              openUpgradeModal(
                "登录以保存和管理你的历史对话",
                "免登录状态下你可以先体验当前对话，但查看历史记录、创建新会话分支和长期保留上下文，需要先登录。"
              );
              return;
            }

            setShowHistory((current) => !current);
          }}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition hover:border-primary/40 hover:bg-white/10"
        >
          <Clock3 className="h-4 w-4" />
          <span>历史记录</span>
        </button>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => {
              const conversation = createConversation(
                createMessage(
                  "assistant",
                  "新的会话已经准备好了。你可以继续探索新的方向，我会保留此前会话在历史记录中。"
                )
              );
              persistConversation(conversation);
              setDraft("");
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-primary-light hover:shadow-lg hover:shadow-primary/30"
          >
            <Plus className="h-4 w-4" />
            <span>新建会话</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              openAuthModal({
                title: "登录以永久保存你的精彩对话",
                description:
                  "首页对话可以直接体验，但登录后你可以同步历史记录、继续多轮上下文，并解锁更高阶的 AI 能力。",
                nextPath: "/",
                featureLabel: "对话记录与高级能力",
              })
            }
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/10"
          >
            <LogIn className="h-4 w-4" />
            <span>登录 / 注册</span>
          </button>
        )}
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl gap-6">
        {showHistory && isAuthenticated && (
          <aside className="hidden w-[280px] shrink-0 rounded-[28px] border border-white/10 bg-[#111415]/90 p-4 shadow-2xl backdrop-blur lg:block">
            <div className="mb-3 flex items-center gap-2 px-2 text-sm text-foreground">
              <MessageSquareText className="h-4 w-4 text-primary-light" />
              最近对话
            </div>
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-muted">
                  还没有保存过对话。先发起一轮交流，历史记录就会自动在这里出现。
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      activeConversationId === conversation.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="line-clamp-1 text-sm text-foreground">
                      {conversation.title}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {formatDate(conversation.updatedAt)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}

        <main className="flex-1">
          <div className="mx-auto flex max-w-[880px] flex-col items-center">
            <div className="mb-12 mt-12 text-center">
              <h1 className="mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-5xl font-light tracking-wide text-transparent md:text-6xl">
                JarsonCai&apos;s Assistant
              </h1>
              <p className="text-base font-light text-muted">
                先聊起来，再决定是否把它变成你的长期工作流
              </p>
              {!isAuthenticated && (
                <p className="mt-3 text-sm text-primary-light/90">
                  当前为免登录体验模式，还可继续对话 {guestRemaining} 次
                </p>
              )}
            </div>

            <div className="w-full">
              <SearchInput
                input={draft}
                onInputChange={setDraft}
                onSend={sendMessage}
              />
            </div>

            <div className="mt-8 w-full space-y-4">
              {activeConversation?.messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      message.role === "assistant"
                        ? "bg-primary/15 text-primary-light"
                        : "bg-white/10 text-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      "你"
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`rounded-[24px] px-4 py-3 text-sm leading-7 ${
                        message.role === "assistant"
                          ? "bg-dark-card text-foreground"
                          : "bg-primary/10 text-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {formatDate(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}

              {shouldShowInlineUpgrade && (
                <div className="rounded-[28px] border border-primary/20 bg-[linear-gradient(135deg,rgba(0,179,107,0.14),rgba(255,255,255,0.03))] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-black">
                      <LogIn className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base text-foreground">
                        我们已经聊得很深入了，登录后可以继续无缝聊下去
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        当前这段对话已经保存在本地。登录后我会自动把它归档到你的历史记录里，并继续刚刚被中断的话题，不会让你的上下文白费。
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (draft.trim()) {
                              setPendingHomeAction({
                                type: "resume-home-chat",
                                message: draft.trim(),
                                conversationId: activeConversationId,
                                createdAt: new Date().toISOString(),
                              });
                            }

                            openUpgradeModal(
                              "登录以继续与 AI 深度交流",
                              "你当前的对话上下文会被自动保留；登录后系统将继续刚才的聊天，并把这段内容归档到你的历史记录。"
                            );
                          }}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:-translate-y-0.5"
                        >
                          登录并继续当前对话
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openUpgradeModal(
                              "登录以永久保存你的精彩对话",
                              "免登录状态下当前会话只会暂存在本地；登录后可跨设备保留，并解锁更多会话次数与高级能力。"
                            )
                          }
                          className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-foreground transition hover:bg-white/5"
                        >
                          仅保存这段对话
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10 w-full">
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
