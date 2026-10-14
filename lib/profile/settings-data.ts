import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { throwIfProfileSchemaMissing } from "./errors";
import type {
  ProfileVisibilityRecord,
  UserPreferenceRecord,
  UserSettingsRecord,
} from "./types";

export type BlockedProfile = {
  blocked_user_id: string;
  display_name: string;
  created_at: string;
};

export async function getSettingsData() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) redirect("/login");
  if (
    auth.user.app_metadata.provider === "email" &&
    !auth.user.email_confirmed_at
  ) {
    redirect("/verify-email");
  }

  const [profileResult, settingsResult, preferencesResult, visibilityResult, blocksResult] =
    await Promise.all([
      supabase.from("profiles").select("display_name,is_discoverable,profile_status").eq("id", auth.user.id).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("user_preferences").select("*").eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("profile_visibility").select("field_name,visibility").eq("user_id", auth.user.id),
      supabase.rpc("list_blocked_profiles"),
    ]);

  const error =
    profileResult.error ??
    settingsResult.error ??
    preferencesResult.error ??
    visibilityResult.error ??
    blocksResult.error;
  if (error) throwIfProfileSchemaMissing(error);
  if (!profileResult.data || !settingsResult.data || !preferencesResult.data) {
    throw new Error("TWIN_PROFILE_SCHEMA_NOT_READY");
  }

  return {
    user: {
      id: auth.user.id,
      email: auth.user.email ?? "",
      provider: String(auth.user.app_metadata.provider ?? "email"),
    },
    profile: profileResult.data as {
      display_name: string;
      is_discoverable: boolean;
      profile_status: "draft" | "active" | "paused";
    },
    settings: settingsResult.data as UserSettingsRecord,
    preferences: preferencesResult.data as UserPreferenceRecord,
    visibility: visibilityResult.data as ProfileVisibilityRecord[],
    blockedProfiles: (blocksResult.data ?? []) as BlockedProfile[],
  };
}
