export type ChatProfile = {
  display_name: string;
  age: number | null;
  city: string | null;
  headline: string | null;
  photos: Array<{
    storage_path: string;
    display_order: number;
    is_primary: boolean;
    signed_url?: string;
  }>;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  client_message_id: string;
};

export type ChatConversationSummary = {
  conversation_id: string;
  other_user_id: string;
  profile: ChatProfile;
  latest_message_body: string | null;
  latest_message_created_at: string | null;
};

export type IncomingChatRequest = {
  request_id: string;
  requester_id: string;
  profile: ChatProfile;
  created_at: string;
};

export type ChatRequestState = {
  status: "none" | "pending" | "accepted" | "declined" | "unavailable";
  requestId: string | null;
  conversationId: string | null;
  direction: "incoming" | "outgoing" | null;
};
