import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { getChatConversation } from "@/lib/chat/data";

async function ChatConversationContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) notFound();
  const conversation = await getChatConversation(id);
  return (
    <ChatConversation
      key={conversation.conversationId}
      conversationId={conversation.conversationId}
      currentUserId={conversation.userId}
      initialMessages={conversation.messages}
      initiallyHasMore={conversation.hasMore}
      otherUserId={conversation.otherUserId}
      profile={conversation.profile}
    />
  );
}

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Opening your conversation…</p></main>}>
      <ChatConversationContent params={params} />
    </Suspense>
  );
}
