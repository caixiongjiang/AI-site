export interface HomeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface HomeConversation {
  id: string;
  title: string;
  messages: HomeChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface PendingHomeAction {
  type: "resume-home-chat";
  message: string;
  conversationId: string | null;
  createdAt: string;
}

const GUEST_CONVERSATIONS_KEY = "ai_site_guest_home_conversations";
const USER_CONVERSATIONS_KEY_PREFIX = "ai_site_home_conversations";
const PENDING_HOME_ACTION_KEY = "ai_site_pending_home_action";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function createStorageKey(userId?: string | null): string {
  return userId
    ? `${USER_CONVERSATIONS_KEY_PREFIX}_${userId}`
    : GUEST_CONVERSATIONS_KEY;
}

function parseConversations(raw: string | null): HomeConversation[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as HomeConversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeConversations(
  userId: string | null | undefined,
  conversations: HomeConversation[]
): void {
  if (!isBrowser()) return;

  localStorage.setItem(createStorageKey(userId), JSON.stringify(conversations));
}

export function createMessage(
  role: HomeChatMessage["role"],
  content: string
): HomeChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createConversation(seedMessage?: HomeChatMessage): HomeConversation {
  const now = new Date().toISOString();

  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: seedMessage?.content.slice(0, 18) || "新的对话",
    messages: seedMessage ? [seedMessage] : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function listHomeConversations(
  userId?: string | null
): HomeConversation[] {
  if (!isBrowser()) return [];

  return parseConversations(localStorage.getItem(createStorageKey(userId))).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function saveHomeConversation(
  userId: string | null | undefined,
  conversation: HomeConversation
): HomeConversation[] {
  const conversations = listHomeConversations(userId);
  const nextConversations = [
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id),
  ];

  writeConversations(userId, nextConversations);
  return nextConversations;
}

export function countUserMessages(conversation: HomeConversation | null): number {
  if (!conversation) return 0;

  return conversation.messages.filter((message) => message.role === "user").length;
}

export function migrateGuestHomeConversations(userId?: string | null): void {
  if (!isBrowser() || !userId) return;

  const guestConversations = listHomeConversations(null);
  if (guestConversations.length === 0) return;

  const currentUserConversations = listHomeConversations(userId);
  const merged = [
    ...guestConversations,
    ...currentUserConversations.filter(
      (item) => !guestConversations.some((guest) => guest.id === item.id)
    ),
  ].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  writeConversations(userId, merged);
  localStorage.removeItem(createStorageKey(null));
}

export function setPendingHomeAction(action: PendingHomeAction): void {
  if (!isBrowser()) return;

  localStorage.setItem(PENDING_HOME_ACTION_KEY, JSON.stringify(action));
}

export function getPendingHomeAction(): PendingHomeAction | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(PENDING_HOME_ACTION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingHomeAction;
  } catch {
    return null;
  }
}

export function clearPendingHomeAction(): void {
  if (!isBrowser()) return;

  localStorage.removeItem(PENDING_HOME_ACTION_KEY);
}
