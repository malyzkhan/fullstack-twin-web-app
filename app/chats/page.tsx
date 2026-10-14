import { Suspense } from "react";
import { ChatInbox } from "@/components/chat/chat-inbox";
import { getChatInbox } from "@/lib/chat/data";

async function ChatInboxContent() {
  const data = await getChatInbox();
  return (
    <ChatInbox
      conversations={data.conversations}
      name={data.userName}
      requests={data.requests}
    />
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Loading your chats…</p></main>}>
      <ChatInboxContent />
    </Suspense>
  );
}
