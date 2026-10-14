import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatSchemaNotReadyError } from "./errors";
import type {
  ChatConversationSummary,
  ChatMessage,
  ChatProfile,
  ChatRequestState,
  IncomingChatRequest,
} from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeProfile(value: unknown): ChatProfile {
  if (!isRecord(value) || typeof value.display_name !== "string") {
    throw new Error("Chat profile data is invalid.");
  }
  const photos = Array.isArray(value.photos)
    ? value.photos.flatMap((photo) => {
        if (
          !isRecord(photo) ||
          typeof photo.storage_path !== "string" ||
          typeof photo.display_order !== "number" ||
          typeof photo.is_primary !== "boolean"
        ) {
          return [];
        }
        return [{
          storage_path: photo.storage_path,
          display_order: photo.display_order,
          is_primary: photo.is_primary,
        }];
      })
    : [];

  return {
    display_name: value.display_name,
    age: typeof value.age === "number" ? value.age : null,
    city: nullableString(value.city),
    headline: nullableString(value.headline),
    photos,
  };
}

async function withSignedPhotos(
  supabase: SupabaseClient,
  profile: ChatProfile,
): Promise<ChatProfile> {
  const photos = await Promise.all(
    profile.photos.map(async (photo) => {
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(photo.storage_path, 5 * 60);
      if (error) throw error;
      return { ...photo, signed_url: data.signedUrl };
    }),
  );
  return { ...profile, photos };
}

function normalizeMessage(value: unknown): ChatMessage {
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
    throw new Error("Chat message data is invalid.");
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

export async function getChatClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  if (!data.user) redirect("/login?next=%2Fchats");
  if (
    data.user.app_metadata.provider === "email" &&
    !data.user.email_confirmed_at
  ) {
    redirect("/verify-email");
  }
  return { supabase, user: data.user };
}

function throwChatRpcError(error: { code?: string }): never {
  if (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  ) {
    throw new ChatSchemaNotReadyError();
  }
  throw error;
}

export async function getChatInbox() {
  const { supabase, user } = await getChatClient();
  const [conversationResult, requestResult] = await Promise.all([
    supabase.rpc("list_my_chat_conversations"),
    supabase.rpc("list_incoming_chat_requests"),
  ]);
  if (conversationResult.error) throwChatRpcError(conversationResult.error);
  if (requestResult.error) throwChatRpcError(requestResult.error);
  if (!Array.isArray(conversationResult.data) || !Array.isArray(requestResult.data)) {
    throw new Error("The chat inbox returned an invalid response.");
  }

  const conversations = await Promise.all(
    (conversationResult.data as Array<Record<string, unknown>>).map(async (row) => ({
      conversation_id: String(row.conversation_id),
      other_user_id: String(row.other_user_id),
      profile: await withSignedPhotos(supabase, normalizeProfile(row.profile)),
      latest_message_body: nullableString(row.latest_message_body),
      latest_message_created_at: nullableString(row.latest_message_created_at),
    } satisfies ChatConversationSummary)),
  );
  const requests = await Promise.all(
    (requestResult.data as Array<Record<string, unknown>>).map(async (row) => ({
      request_id: String(row.request_id),
      requester_id: String(row.requester_id),
      profile: await withSignedPhotos(supabase, normalizeProfile(row.profile)),
      created_at: String(row.created_at),
    } satisfies IncomingChatRequest)),
  );
  const metadataName = user.user_metadata.full_name;

  return {
    userId: user.id,
    userName:
      typeof metadataName === "string" && metadataName.trim()
        ? metadataName.trim()
        : user.email ?? "Twin member",
    conversations,
    requests,
  };
}

export async function getChatRequestState(
  targetUserId: string,
): Promise<ChatRequestState> {
  const { supabase } = await getChatClient();
  const { data, error } = await supabase.rpc("get_chat_request_status", {
    target_user_id: targetUserId,
  });
  if (error) throwChatRpcError(error);
  if (!Array.isArray(data) || !isRecord(data[0])) {
    throw new Error("Chat request status returned an invalid response.");
  }

  const row = data[0];
  const validStatuses = ["none", "pending", "accepted", "declined", "unavailable"];
  const status = validStatuses.includes(String(row.request_status))
    ? (String(row.request_status) as ChatRequestState["status"])
    : "unavailable";
  return {
    status,
    requestId: nullableString(row.request_id),
    conversationId: nullableString(row.conversation_id),
    direction:
      row.request_direction === "incoming" || row.request_direction === "outgoing"
        ? row.request_direction
        : null,
  };
}

export async function getChatConversation(conversationId: string) {
  const { supabase, user } = await getChatClient();
  const { data, error } = await supabase.rpc("get_chat_conversation", {
    target_conversation_id: conversationId,
  });
  if (error) throwChatRpcError(error);
  if (!Array.isArray(data) || !isRecord(data[0])) notFound();

  const row = data[0];
  const profile = await withSignedPhotos(
    supabase,
    normalizeProfile(row.profile),
  );
  const { messages, hasMore } = await getChatMessagesPage(
    supabase,
    conversationId,
    null,
    null,
  );
  return {
    userId: user.id,
    conversationId,
    otherUserId: String(row.other_user_id),
    profile,
    messages,
    hasMore,
  };
}

async function getChatMessagesPage(
  supabase: SupabaseClient,
  conversationId: string,
  beforeCreatedAt: string | null,
  beforeMessageId: string | null,
) {
  const { data, error } = await supabase.rpc("get_chat_messages", {
    target_conversation_id: conversationId,
    before_created_at: beforeCreatedAt,
    before_message_id: beforeMessageId,
    result_limit: 31,
  });
  if (error) throwChatRpcError(error);
  if (!Array.isArray(data)) throw new Error("Message history returned an invalid response.");
  const rows = data.map(normalizeMessage);
  return {
    messages: rows.slice(0, 30).reverse(),
    hasMore: rows.length > 30,
  };
}

export async function loadChatMessages(
  conversationId: string,
  beforeCreatedAt: string | null = null,
  beforeMessageId: string | null = null,
) {
  const { supabase } = await getChatClient();
  return getChatMessagesPage(
    supabase,
    conversationId,
    beforeCreatedAt,
    beforeMessageId,
  );
}
