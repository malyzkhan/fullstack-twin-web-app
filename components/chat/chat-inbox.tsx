import Image from "next/image";
import Link from "next/link";
import { HomeNavbar } from "@/components/home/home-navbar";
import { IncomingChatRequests } from "@/components/chat/chat-request-controls";
import type { ChatConversationSummary, IncomingChatRequest } from "@/lib/chat/types";

function formatMessageDate(value: string | null) {
  if (!value) return "No messages yet";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ChatInbox({
  name,
  requests,
  conversations,
}: {
  name: string;
  requests: IncomingChatRequest[];
  conversations: ChatConversationSummary[];
}) {
  return (
    <main className="home-page">
      <HomeNavbar name={name} />
      <section aria-labelledby="chats-title" className="chat-inbox-page">
        <header className="chat-page-heading">
          <div>
            <p className="eyebrow">One conversation at a time</p>
            <h1 id="chats-title">Chats</h1>
            <p>Private conversations with people who have accepted your request.</p>
          </div>
          <Link className="button button-secondary" href="/discover">Discover people</Link>
        </header>

        {requests.length ? <IncomingChatRequests requests={requests} /> : null}

        <section aria-labelledby="conversations-title" className="chat-conversations-section">
          <div className="chat-section-heading">
            <div>
              <p className="eyebrow">Accepted conversations</p>
              <h2 id="conversations-title">Your messages</h2>
            </div>
          </div>
          {conversations.length ? (
            <div className="chat-conversation-list">
              {conversations.map((conversation) => {
                const photo =
                  conversation.profile.photos.find((item) => item.is_primary) ??
                  conversation.profile.photos[0];
                return (
                  <Link
                    className="chat-conversation-row"
                    href={`/chats/${conversation.conversation_id}`}
                    key={conversation.conversation_id}
                  >
                    <span className="chat-list-avatar">
                      {photo?.signed_url ? (
                        <Image
                          alt=""
                          fill
                          sizes="64px"
                          src={photo.signed_url}
                          unoptimized
                        />
                      ) : (
                        conversation.profile.display_name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="chat-conversation-copy">
                      <span className="chat-conversation-title">
                        <strong>
                          {conversation.profile.display_name}
                          {conversation.profile.age ? `, ${conversation.profile.age}` : ""}
                        </strong>
                        <time dateTime={conversation.latest_message_created_at ?? undefined}>
                          {formatMessageDate(conversation.latest_message_created_at)}
                        </time>
                      </span>
                      <span className="chat-conversation-preview">
                        {conversation.latest_message_body ?? "Your conversation is ready when you are."}
                      </span>
                    </span>
                    <span aria-hidden="true" className="chat-conversation-chevron">›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="chat-empty-state">
              <span aria-hidden="true" className="empty-state-mark">✳</span>
              <h3>No conversations yet.</h3>
              <p>
                When someone accepts a chat request, your private conversation
                will appear here.
              </p>
              <Link className="text-link" href="/discover">Explore Discover</Link>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
