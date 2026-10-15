"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  loadChatMessagesAction,
  sendChatMessage,
} from "@/app/chats/actions";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatProfile } from "@/lib/chat/types";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRealtimeMessage(value: unknown): ChatMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.conversation_id !== "string" ||
    typeof value.sender_id !== "string" ||
    typeof value.body !== "string" ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at)) ||
    typeof value.client_message_id !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    conversation_id: value.conversation_id,
    sender_id: value.sender_id,
    body: value.body,
    created_at: value.created_at,
    client_message_id: value.client_message_id,
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const merged: ChatMessage[] = [...current];

  for (const item of incoming) {
    const existingIndex = merged.findIndex((m) => {
      if (m.id === item.id) return true;
      if (
        item.client_message_id &&
        (m.client_message_id === item.client_message_id || m.id === item.client_message_id)
      ) {
        return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      merged[existingIndex] = item;
    } else {
      merged.push(item);
    }
  }

  return merged.sort((left, right) => {
    const timeOrder = left.created_at.localeCompare(right.created_at);
    return timeOrder || left.id.localeCompare(right.id);
  });
}

export function ChatConversation({
  conversationId,
  currentUserId,
  otherUserId,
  profile,
  initialMessages,
  initiallyHasMore,
}: {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  profile: ChatProfile;
  initialMessages: ChatMessage[];
  initiallyHasMore: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(initiallyHasMore);
  const [sendError, setSendError] = useState("");
  const [realtimeError, setRealtimeError] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const olderScrollPosition = useRef<{ height: number; top: number } | null>(null);
  const [retryMessage, setRetryMessage] = useState<{ body: string; id: string } | null>(null);

  const refreshLatest = useCallback(async () => {
    try {
      const result = await loadChatMessagesAction(conversationId);
      if ("error" in result) {
        setRealtimeError(result.error);
        return;
      }
      setRealtimeError("");
      setMessages((current) => mergeMessages(current, result.messages));
    } catch {
      setRealtimeError("Live updates are unavailable. Your saved messages remain safe.");
    }
  }, [conversationId]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const oldPosition = olderScrollPosition.current;
    if (oldPosition) {
      container.scrollTop =
        container.scrollHeight - oldPosition.height + oldPosition.top;
      olderScrollPosition.current = null;
    } else if (nearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initRealtime() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
        if (!active) return;

        const newChannel = supabase.channel(`chat-messages:${conversationId}`);

        newChannel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              if (!active) return;
              const incoming = parseRealtimeMessage(payload.new);
              if (incoming && incoming.conversation_id === conversationId) {
                setMessages((current) => mergeMessages(current, [incoming]));
              } else {
                void refreshLatest();
              }
            },
          )
          .subscribe((status) => {
            if (!active) return;
            if (status === "SUBSCRIBED") {
              setSubscribed(true);
              setRealtimeError("");
              void refreshLatest();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setSubscribed(false);
              setRealtimeError("Live updates are reconnecting. Your messages remain saved.");
            } else if (status === "CLOSED") {
              setSubscribed(false);
            }
          });

        if (!active) {
          void supabase.removeChannel(newChannel);
          return;
        }

        channel = newChannel;
      } catch {
        if (!active) return;
        setSubscribed(false);
        setRealtimeError("Live updates are reconnecting. Your messages remain saved.");
      }
    }

    void initRealtime();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        void supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      active = false;
      authSubscription.unsubscribe();
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [conversationId, refreshLatest]);

  async function loadOlderMessages() {
    const oldest = messages[0];
    if (!oldest || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    setSendError("");
    const container = scrollRef.current;
    const oldPosition = container
      ? { height: container.scrollHeight, top: container.scrollTop }
      : null;
    try {
      const result = await loadChatMessagesAction(
        conversationId,
        oldest.created_at,
        oldest.id,
      );
      if ("error" in result) {
        setSendError(result.error);
        return;
      }
      olderScrollPosition.current = oldPosition;
      setMessages((current) => mergeMessages(result.messages, current));
      setHasMore(result.hasMore);
    } catch {
      setSendError("We couldn’t load earlier messages. Please try again.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submitMessage(body: string, clientMessageId?: string) {
    const cleanBody = body.trim();
    if (!cleanBody || cleanBody.length > 2000 || sending) return;
    const retryId = clientMessageId ?? crypto.randomUUID();
    setSending(true);
    setSendError("");

    const optimisticMessage: ChatMessage = {
      id: retryId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: cleanBody,
      created_at: new Date().toISOString(),
      client_message_id: retryId,
    };

    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    setDraft((current) => (current === body ? "" : current));
    nearBottomRef.current = true;

    try {
      const result = await sendChatMessage(
        conversationId,
        cleanBody,
        retryId,
      );
      const message = result.message;
      if (result.error || !message) {
        setRetryMessage({ body: cleanBody, id: retryId });
        setSendError(result.error ?? "Your message couldn’t be sent. Try again.");
        setMessages((current) =>
          current.filter(
            (m) => m.id !== retryId && m.client_message_id !== retryId,
          ),
        );
        return;
      }
      setRetryMessage(null);
      setMessages((current) => mergeMessages(current, [message]));
    } catch {
      setRetryMessage({ body: cleanBody, id: retryId });
      setSendError("Your message couldn’t be sent. Your text is still here to retry.");
      setMessages((current) =>
        current.filter(
          (m) => m.id !== retryId && m.client_message_id !== retryId,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(draft);
  }

  const primaryPhoto =
    profile.photos.find((photo) => photo.is_primary) ?? profile.photos[0];

  return (
    <main className="home-page">
      <header className="site-header chat-topbar">
        <Link className="text-link" href="/chats">← All chats</Link>
        <Link className="wordmark" href="/home">twin<span>.</span></Link>
        <Link className="chat-topbar-profile" href={`/profile/${otherUserId}`}>
          View profile
        </Link>
      </header>
      <section aria-label={`Conversation with ${profile.display_name}`} className="chat-room">
        <header className="chat-room-header">
          <Link className="chat-room-person" href={`/profile/${otherUserId}`}>
            <span className="chat-list-avatar chat-room-avatar">
              {primaryPhoto?.signed_url ? (
                <Image alt="" fill sizes="48px" src={primaryPhoto.signed_url} unoptimized />
              ) : (
                profile.display_name.slice(0, 1).toUpperCase()
              )}
            </span>
            <span>
              <strong>
                {profile.display_name}
                {profile.age ? `, ${profile.age}` : ""}
              </strong>
              <small>{profile.city ?? "Twin member"}</small>
            </span>
          </Link>
          <span className={subscribed ? "chat-connection-status is-online" : "chat-connection-status"}>
            {subscribed ? "Live" : "Connecting"}
          </span>
        </header>

        <div
          aria-live="polite"
          className="chat-message-list"
          onScroll={(event) => {
            const element = event.currentTarget;
            nearBottomRef.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 120;
          }}
          ref={scrollRef}
          role="log"
          aria-label="Messages"
        >
          {hasMore ? (
            <button
              className="chat-load-older"
              disabled={loadingOlder}
              onClick={() => void loadOlderMessages()}
              type="button"
            >
              {loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}
            </button>
          ) : null}
          {!messages.length ? (
            <div className="chat-empty-messages">
              <span aria-hidden="true" className="empty-state-mark">✳</span>
              <p>This is the start of your conversation.</p>
              <small>Take your time. A thoughtful hello is a good place to begin.</small>
            </div>
          ) : (
            <ol className="chat-message-items">
              {messages.map((message) => {
                const outgoing = message.sender_id === currentUserId;
                return (
                  <li
                    className={outgoing ? "chat-message-item is-outgoing" : "chat-message-item"}
                    key={message.id}
                  >
                    <p className="chat-message-bubble">{message.body}</p>
                    <time dateTime={message.created_at}>
                      {formatMessageTime(message.created_at)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {realtimeError ? <p className="chat-realtime-note" role="status">{realtimeError}</p> : null}
        <form className="chat-composer" onSubmit={handleSubmit}>
          {sendError ? (
            <div className="chat-send-error" role="alert">
              <span>{sendError}</span>
              {retryMessage ? (
                <button
                  disabled={sending}
                  onClick={() => {
                    void submitMessage(retryMessage.body, retryMessage.id);
                  }}
                  type="button"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          <label className="visually-hidden" htmlFor="chat-message-input">Write a message</label>
          <textarea
            id="chat-message-input"
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (draft.trim() && draft.length <= 2000) void submitMessage(draft);
              }
            }}
            placeholder="Write a thoughtful message…"
            rows={2}
            value={draft}
          />
          <div className="chat-composer-footer">
            <span>{draft.length}/2000 · Enter to send, Shift+Enter for a new line</span>
            <button
              className="button button-primary"
              disabled={sending || !draft.trim() || draft.length > 2000}
              type="submit"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
