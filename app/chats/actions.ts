"use server";

import { revalidatePath } from "next/cache";
import { getChatClient, loadChatMessages } from "@/lib/chat/data";

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type ActionResult = { error?: string; success?: true; conversationId?: string };

export async function createChatRequest(
  targetUserId: string,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(targetUserId)) {
    return { error: "This profile can’t receive a chat request." };
  }

  const { supabase } = await getChatClient();
  const { error } = await supabase.rpc("create_chat_request", {
    target_user_id: targetUserId,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "A chat request isn’t available for this profile right now."
          : "We couldn’t send your request. Please try again.",
    };
  }

  revalidatePath("/chats");
  revalidatePath(`/profile/${targetUserId}`);
  return { success: true };
}

export async function respondToChatRequest(
  requestId: string,
  decision: "accept" | "decline",
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(requestId) || !["accept", "decline"].includes(decision)) {
    return { error: "That chat request is no longer available." };
  }

  const { supabase } = await getChatClient();
  if (decision === "accept") {
    const { data, error } = await supabase.rpc("accept_chat_request", {
      target_request_id: requestId,
    });
    if (error) {
      return { error: "We couldn’t accept this request. It may no longer be available." };
    }
    if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
      return { error: "The conversation couldn’t be opened. Please try again." };
    }
    revalidatePath("/chats");
    revalidatePath(`/chats/${data}`);
    return { success: true, conversationId: data };
  }

  const { error } = await supabase.rpc("decline_chat_request", {
    target_request_id: requestId,
  });
  if (error) {
    return { error: "We couldn’t decline this request. It may no longer be available." };
  }
  revalidatePath("/chats");
  return { success: true };
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
  clientMessageId: string,
): Promise<ActionResult & { message?: {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  client_message_id: string;
} }> {
  if (
    !UUID_PATTERN.test(conversationId) ||
    !UUID_PATTERN.test(clientMessageId) ||
    typeof body !== "string" ||
    body.trim().length < 1 ||
    body.length > 2000
  ) {
    return { error: "Messages must contain 1 to 2000 characters." };
  }

  const { supabase } = await getChatClient();
  const { data: messageId, error: sendError } = await supabase.rpc(
    "send_chat_message",
    {
      target_conversation_id: conversationId,
      message_body: body,
      client_message_id: clientMessageId,
    },
  );
  if (sendError) {
    if (
      sendError.code === "PGRST202" ||
      sendError.code === "42883" ||
      sendError.code === "42P01" ||
      sendError.code === "42703" ||
      sendError.code === "42P10"
    ) {
      console.error("Chat messaging RPC is unavailable in Supabase.", {
        code: sendError.code,
      });
      return {
        error:
          `Chat setup in Supabase is incomplete (database error ${sendError.code}). Apply the latest chat migration and refresh the API schema.`,
      };
    }
    if (sendError.code === "P0001") {
      return { error: "You’re sending messages too quickly. Please wait a moment." };
    }
    if (sendError.code === "42501") {
      return { error: "This conversation is no longer available." };
    }
    if (sendError.code === "22023") {
      return { error: "Check your message and try again." };
    }
    if (sendError.code === "23514") {
      return { error: "Messages must contain 1 to 2000 non-whitespace characters." };
    }
    console.error("Supabase rejected a chat message.", {
      code: sendError.code ?? "unknown",
    });
    return {
      error: `Your message could not be sent (database error ${sendError.code ?? "unknown"}). Please try again and share this code with support.`,
    };
  }
  if (typeof messageId !== "string" || !UUID_PATTERN.test(messageId)) {
    console.error("Supabase returned an invalid chat message identifier.", {
      responseType: typeof messageId,
    });
    return { error: "Your message couldn’t be confirmed. Please retry." };
  }

  const { data: message, error: loadError } = await supabase
    .from("chat_messages")
    .select("id,conversation_id,sender_id,body,created_at,client_message_id")
    .eq("id", messageId)
    .single();
  if (loadError || !message) {
    if (loadError) {
      console.error("A saved chat message could not be loaded.", {
        code: loadError.code ?? "unknown",
      });
    }
    return { error: "Your message was saved, but couldn’t be loaded. Refresh the conversation." };
  }

  revalidatePath("/chats");
  return {
    success: true,
    message: {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      body: message.body,
      created_at: message.created_at,
      client_message_id: message.client_message_id,
    },
  };
}

export async function loadChatMessagesAction(
  conversationId: string,
  beforeCreatedAt: string | null = null,
  beforeMessageId: string | null = null,
) {
  if (
    !UUID_PATTERN.test(conversationId) ||
    ((beforeCreatedAt === null) !== (beforeMessageId === null)) ||
    (beforeMessageId !== null && !UUID_PATTERN.test(beforeMessageId)) ||
    (beforeCreatedAt !== null && Number.isNaN(Date.parse(beforeCreatedAt)))
  ) {
    return { error: "We couldn’t load these messages." };
  }
  return loadChatMessages(conversationId, beforeCreatedAt, beforeMessageId);
}
