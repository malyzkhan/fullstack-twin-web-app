"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createChatRequest, respondToChatRequest } from "@/app/chats/actions";
import type { ChatRequestState, IncomingChatRequest } from "@/lib/chat/types";

function formatRequestDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ChatRequestAction({
  targetUserId,
  state,
}: {
  targetUserId: string;
  state: ChatRequestState;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendRequest() {
    setBusy(true);
    setError("");
    try {
      const result = await createChatRequest(targetUserId);
      if (result.error) setError(result.error);
      else router.refresh();
    } catch {
      setError("We couldn’t send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "accepted" && state.conversationId) {
    return (
      <Link className="button button-primary" href={`/chats/${state.conversationId}`}>
        Open chat
      </Link>
    );
  }
  if (state.status === "pending" && state.direction === "outgoing") {
    return <p className="chat-request-status">Chat request sent · awaiting acceptance</p>;
  }
  if (state.status === "pending" && state.direction === "incoming") {
    return (
      <Link className="button button-primary" href="/chats">
        View chat request
      </Link>
    );
  }
  if (
    state.status === "unavailable" ||
    (state.status === "declined" && state.direction === "incoming")
  ) {
    return null;
  }

  return (
    <div className="chat-request-action">
      <button
        className="button button-primary"
        disabled={busy}
        onClick={() => void sendRequest()}
        type="button"
      >
        {busy ? "Sending…" : state.status === "declined" ? "Send another request" : "Request to chat"}
      </button>
      {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
      {state.status === "declined" ? (
        <p className="chat-request-status">Your earlier request wasn’t accepted.</p>
      ) : null}
    </div>
  );
}

export function IncomingChatRequests({
  requests,
}: {
  requests: IncomingChatRequest[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function respond(requestId: string, decision: "accept" | "decline") {
    setBusyId(requestId);
    setError("");
    try {
      const result = await respondToChatRequest(requestId, decision);
      if (result.error) {
        setError(result.error);
      } else if (decision === "accept" && result.conversationId) {
        router.push(`/chats/${result.conversationId}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("We couldn’t update this request. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section aria-labelledby="incoming-requests-title" className="chat-requests-section">
      <div className="chat-section-heading">
        <div>
          <p className="eyebrow">Your choice, always</p>
          <h2 id="incoming-requests-title">Chat requests</h2>
        </div>
        <span className="chat-request-count">{requests.length}</span>
      </div>
      <div className="chat-request-list">
        {requests.map((request) => {
          const photo =
            request.profile.photos.find((item) => item.is_primary) ??
            request.profile.photos[0];
          return (
            <article className="chat-request-card" key={request.request_id}>
              <Link className="chat-request-person" href={`/profile/${request.requester_id}`}>
                <span className="chat-list-avatar">
                  {photo?.signed_url ? (
                    <Image
                      alt=""
                      fill
                      sizes="52px"
                      src={photo.signed_url}
                      unoptimized
                    />
                  ) : (
                    request.profile.display_name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span>
                  <strong>
                    {request.profile.display_name}
                    {request.profile.age ? `, ${request.profile.age}` : ""}
                  </strong>
                  <small>Sent {formatRequestDate(request.created_at)}</small>
                </span>
              </Link>
              <div className="chat-request-actions">
                <button
                  className="button button-primary"
                  disabled={busyId === request.request_id}
                  onClick={() => void respond(request.request_id, "accept")}
                  type="button"
                >
                  {busyId === request.request_id ? "Please wait…" : "Accept"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={busyId === request.request_id}
                  onClick={() => void respond(request.request_id, "decline")}
                  type="button"
                >
                  Decline
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="form-message form-message-error" role="alert">{error}</p> : null}
    </section>
  );
}
