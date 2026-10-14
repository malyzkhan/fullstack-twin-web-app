import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { throwIfProfileSchemaMissing } from "./errors";
import type {
  InterestRecord,
  DiscoverableProfile,
  ProfileBundle,
  ProfileInterestRecord,
  ProfilePhotoRecord,
  ProfileRecord,
  ProfileVisibilityRecord,
  PublicProfile,
  UserPreferenceRecord,
  UserSettingsRecord,
} from "./types";

export async function getProfileBundle(): Promise<ProfileBundle> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth.user) redirect("/login");
  if (
    auth.user.app_metadata.provider === "email" &&
    !auth.user.email_confirmed_at
  ) {
    redirect("/verify-email");
  }

  const [
    profileResult,
    visibilityResult,
    preferenceResult,
    settingsResult,
    interestsResult,
    catalogResult,
    photosResult,
    blocksResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
    supabase.from("profile_visibility").select("field_name,visibility").eq("user_id", auth.user.id),
    supabase.from("user_preferences").select("*").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("profile_interests").select("id,interest_id,custom_name,display_order").eq("user_id", auth.user.id).order("display_order"),
    supabase.from("interests").select("id,name,category").order("category").order("name"),
    supabase.from("profile_photos").select("id,storage_path,display_order,is_primary").eq("user_id", auth.user.id).order("display_order"),
    supabase.from("blocked_users").select("blocked_user_id,created_at").eq("blocker_id", auth.user.id).order("created_at", { ascending: false }),
  ]);

  const error =
    profileResult.error ??
    visibilityResult.error ??
    preferenceResult.error ??
    settingsResult.error ??
    interestsResult.error ??
    catalogResult.error ??
    photosResult.error ??
    blocksResult.error;
  if (error) throwIfProfileSchemaMissing(error);
  if (!profileResult.data || !preferenceResult.data || !settingsResult.data) {
    throw new Error("TWIN_PROFILE_SCHEMA_NOT_READY");
  }

  const profile = profileResult.data as ProfileRecord;
  const interestRows = interestsResult.data as ProfileInterestRecord[];
  const catalog = catalogResult.data as InterestRecord[];
  const photos = photosResult.data as ProfilePhotoRecord[];
  const catalogById = new Map(catalog.map((interest) => [interest.id, interest]));

  const signedPhotos = await Promise.all(
    photos.map(async (photo) => {
      const { data, error: signedUrlError } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(photo.storage_path, 60 * 60);
      if (signedUrlError) throw signedUrlError;
      return { ...photo, signedUrl: data.signedUrl };
    }),
  );

  return {
    profile,
    visibility: visibilityResult.data as ProfileVisibilityRecord[],
    preferences: preferenceResult.data as UserPreferenceRecord,
    settings: settingsResult.data as UserSettingsRecord,
    interests: interestRows.map((interest) => {
      const catalogItem = interest.interest_id
        ? catalogById.get(interest.interest_id)
        : undefined;
      return {
        ...interest,
        name: catalogItem?.name ?? interest.custom_name ?? "",
        category: catalogItem?.category ?? "custom",
      };
    }),
    interestCatalog: catalog,
    photos: signedPhotos,
    blockedUsers: blocksResult.data ?? [],
  };
}

export async function getPublicProfile(
  userId: string,
): Promise<PublicProfile> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth.user) redirect("/login");
  if (
    auth.user.app_metadata.provider === "email" &&
    !auth.user.email_confirmed_at
  ) {
    redirect("/verify-email");
  }

  const { data, error } = await supabase.rpc("get_public_profile", {
    target_user_id: userId,
  });
  if (error) throwIfProfileSchemaMissing(error);
  if (!data || typeof data !== "object" || Array.isArray(data)) notFound();

  const result = data as Partial<PublicProfile>;
  if (typeof result.display_name !== "string") notFound();

  const photos = await Promise.all(
    (result.photos ?? []).map(async (photo) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(photo.storage_path, 5 * 60);
      if (signedError) throw signedError;
      return { ...photo, signed_url: signed.signedUrl };
    }),
  );

  return { ...result, photos, is_owner: auth.user.id === userId } as PublicProfile;
}

export async function getDiscoverableProfiles(
  resultOffset = 0,
): Promise<DiscoverableProfile[]> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!auth.user) redirect("/login");
  if (
    auth.user.app_metadata.provider === "email" &&
    !auth.user.email_confirmed_at
  ) {
    redirect("/verify-email");
  }

  const { data, error } = await supabase.rpc("list_discoverable_profiles", {
    result_limit: 25,
    result_offset: Math.max(0, Math.floor(resultOffset)),
  });
  if (error) throwIfProfileSchemaMissing(error);
  if (!Array.isArray(data)) {
    throw new Error("The Discover feed returned an invalid response.");
  }

  return Promise.all(
    (data as Array<{ profile_id: string; profile: PublicProfile }>).map(
      async ({ profile_id, profile }) => {
        const photos = await Promise.all(
          (profile.photos ?? []).map(async (photo) => {
            const { data: signed, error: signedError } = await supabase.storage
              .from("profile-photos")
              .createSignedUrl(photo.storage_path, 5 * 60);
            if (signedError) throw signedError;
            return { ...photo, signed_url: signed.signedUrl };
          }),
        );
        return { ...profile, id: profile_id, photos };
      },
    ),
  );
}
