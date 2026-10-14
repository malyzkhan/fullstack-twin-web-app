"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profilePrompts } from "@/lib/profile/prompts";

const profileSections = {
  basics: ["display_name", "date_of_birth", "pronouns", "city", "headline"],
  about: ["bio", "profile_prompts"],
  worldview: ["worldview", "worldview_description"],
  family: ["children_preference", "date_parent_preference"],
  relationship: [
    "relationship_intention",
    "relationship_structure",
  ],
  interests: ["personality_type"],
  visibility: ["profile_status", "is_discoverable"],
} as const;

type ProfileSection = keyof typeof profileSections;

const profileLimits: Record<string, number> = {
  display_name: 80,
  pronouns: 50,
  city: 100,
  headline: 120,
  bio: 2000,
  worldview: 80,
  worldview_description: 500,
};

const profileChoices: Record<string, readonly string[]> = {
  worldview: [
    "atheist",
    "agnostic",
    "irreligious",
    "humanist",
    "spiritual_but_not_religious",
    "religious",
    "questioning",
    "other",
    "prefer_not_to_say",
  ],
  children_preference: [
    "childfree",
    "wants_children",
    "unsure",
    "open_to_discussing",
    "prefer_not_to_say",
  ],
  date_parent_preference: ["yes", "no", "open_to_discussing", "prefer_not_to_say"],
  relationship_intention: ["long_term", "casual", "friendship", "open_to_see"],
  relationship_structure: [
    "monogamy",
    "consensual_non_monogamy",
    "open_to_discussing",
    "prefer_not_to_say",
  ],
  personality_type: ["introvert", "extrovert", "ambivert", "prefer_not_to_say"],
  profile_status: ["draft", "active", "paused"],
};

type ActionResult = { error?: string; success?: true };
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function saveProfileSection(
  section: ProfileSection,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  if (
    !Object.hasOwn(profileSections, section) ||
    !values ||
    typeof values !== "object" ||
    Array.isArray(values)
  ) {
    return { error: "Those profile changes are not valid." };
  }

  const allowedFields: readonly string[] = profileSections[section];
  const fields = Object.keys(values);
  if (!fields.length || fields.some((field) => !allowedFields.includes(field))) {
    return { error: "Those profile changes are not valid." };
  }

  const updates: Record<string, string | boolean | Record<string, string> | null> = {};
  for (const field of fields) {
    const value = values[field];
    if (field === "display_name") {
      if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 80) {
        return { error: "Display name must be between 2 and 80 characters." };
      }
      updates[field] = value.trim();
      continue;
    }
    if (field === "date_of_birth") {
      if (value === "" || value === null) {
        updates[field] = null;
      } else if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value ||
        value >= new Date().toISOString().slice(0, 10)
      ) {
        return { error: "Enter a valid date of birth." };
      } else {
        updates[field] = value;
      }
      continue;
    }

    if (field === "is_discoverable") {
      if (typeof value !== "boolean") {
        return { error: "Choose a valid profile visibility setting." };
      }
      updates[field] = value;
      continue;
    }

    if (field === "profile_prompts") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { error: "Your profile prompts are not valid." };
      }
      const prompts = value as Record<string, unknown>;
      const allowedPrompts = Object.keys(profilePrompts);
      if (
        Object.keys(prompts).some(
          (key) =>
            !allowedPrompts.includes(key) ||
            typeof prompts[key] !== "string" ||
            (prompts[key] as string).length > 500,
        )
      ) {
        return { error: "One or more profile prompt answers are too long." };
      }
      updates[field] = Object.fromEntries(
        Object.entries(prompts).map(([key, answer]) => [key, (answer as string).trim()]),
      );
      continue;
    }

    if (field === "profile_status") {
      if (
        typeof value !== "string" ||
        !profileChoices.profile_status.includes(
          value as (typeof profileChoices.profile_status)[number],
        )
      ) {
        return { error: "Choose a valid profile status." };
      }
      updates[field] = value;
      continue;
    }

    if (Object.hasOwn(profileChoices, field)) {
      const choices = profileChoices[field];
      if (value !== null && (typeof value !== "string" || !choices.includes(value))) {
        return { error: "Choose a valid option." };
      }
      updates[field] = value as string | null;
      continue;
    }

    const limit = profileLimits[field];
    if (typeof value !== "string" || value.trim().length > limit) {
      return { error: "One or more profile fields are too long or invalid." };
    }
    updates[field] = value.trim() || null;
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (
    updates.profile_status === "active" &&
    !user.email_confirmed_at
  ) {
    return { error: "Verify your email before activating your dating profile." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23514" && section === "visibility") {
      return {
        error: "Add a display name and confirm that you are at least 18 before activating your dating profile.",
      };
    }
    return { error: "We couldn’t save your profile. Please try again." };
  }
  if (!data) return { error: "Your profile could not be found. Reload and try again." };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/home");
  revalidatePath("/settings/profile");
  return { success: true };
}

export async function saveVisibility(
  fieldName: string,
  visibility: "public" | "private",
): Promise<ActionResult> {
  const allowed = [
    "age", "pronouns", "city", "headline", "bio", "worldview",
    "worldview_description", "children_preference", "date_parent_preference",
    "relationship_intention", "relationship_structure", "personality_type",
    "prompts", "interests", "photos",
  ];
  if (!allowed.includes(fieldName) || !["public", "private"].includes(visibility)) {
    return { error: "That visibility setting is not supported." };
  }

  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("profile_visibility")
    .upsert(
      { user_id: user.id, field_name: fieldName, visibility, updated_at: new Date().toISOString() },
      { onConflict: "user_id,field_name" },
    );
  if (error) return { error: "We couldn’t save that visibility setting." };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}

export async function savePreferences(
  values: {
    min_age: number;
    max_age: number;
    max_distance_km: number | null;
    relationship_intentions: string[];
    children_preferences: string[];
  },
): Promise<ActionResult> {
  const allowedIntentions = ["long_term", "casual", "friendship", "open_to_see"];
  const allowedChildren = [
    "childfree",
    "wants_children",
    "unsure",
    "open_to_discussing",
    "prefer_not_to_say",
  ];
  if (
    !values ||
    typeof values !== "object" ||
    !Array.isArray(values.relationship_intentions) ||
    !Array.isArray(values.children_preferences) ||
    !Number.isInteger(values.min_age) ||
    !Number.isInteger(values.max_age) ||
    values.min_age < 18 ||
    values.max_age > 99 ||
    values.min_age > values.max_age ||
    (values.max_distance_km !== null &&
      (!Number.isInteger(values.max_distance_km) ||
        values.max_distance_km < 1 ||
        values.max_distance_km > 1000)) ||
    values.relationship_intentions.some((item) => !allowedIntentions.includes(item)) ||
    values.children_preferences.some((item) => !allowedChildren.includes(item))
  ) {
    return { error: "Check your age, distance, and preference selections." };
  }

  const { supabase, user } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (error) return { error: "We couldn’t save your preferences." };
  if (!data) return { error: "Your preferences could not be found. Reload and try again." };

  revalidatePath("/settings/preferences");
  return { success: true };
}

export async function saveUserSetting(
  field: string,
  value: boolean | string,
): Promise<ActionResult> {
  const booleanFields = [
    "notify_likes",
    "notify_matches",
    "notify_messages",
    "notify_product_updates",
    "email_notifications",
    "push_notifications",
  ];
  const valid = booleanFields.includes(field)
    ? typeof value === "boolean"
    : field === "theme" && ["system", "light", "dark"].includes(String(value));
  if (!valid) return { error: "That setting is not supported." };

  const { supabase, user } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("user_settings")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (error) return { error: "We couldn’t save that setting." };
  if (!data) return { error: "Your settings could not be found. Reload and try again." };

  revalidatePath("/settings");
  return { success: true };
}

export async function unblockUser(userId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(userId)) {
    return { error: "That blocked account could not be identified." };
  }

  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_user_id", userId);
  if (error) return { error: "We couldn’t remove that block." };

  revalidatePath("/settings/privacy");
  return { success: true };
}

export async function blockUser(userId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(userId)) {
    return { error: "That account could not be identified." };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (user.id === userId) return { error: "You can’t block your own account." };

  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: user.id, blocked_user_id: userId });
  if (error?.code === "23505") return { success: true };
  if (error) return { error: "We couldn’t block that account. Please try again." };

  revalidatePath("/settings/privacy");
  revalidatePath(`/profile/${userId}`);
  return { success: true };
}

export async function submitProfileReport(
  reportedUserId: string,
  category: string,
  details: string,
): Promise<ActionResult> {
  const categories = ["safety", "harassment", "spam", "fake_profile", "other"];
  if (
    !UUID_PATTERN.test(reportedUserId) ||
    !categories.includes(category) ||
    typeof details !== "string" ||
    details.length > 2000
  ) {
    return { error: "Check the report details and try again." };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (user.id === reportedUserId) {
    return { error: "You can’t report your own account." };
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    category,
    details: details.trim() || null,
  });
  if (error) return { error: "We couldn’t submit your report. Please try again." };
  return { success: true };
}

export async function saveInterests(
  interestIds: number[],
  customNames: string[],
): Promise<ActionResult> {
  if (
    !Array.isArray(interestIds) ||
    !Array.isArray(customNames) ||
    interestIds.some((id) => !Number.isInteger(id) || id < 1) ||
    customNames.some(
      (name) =>
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 40,
    ) ||
    interestIds.length + customNames.length > 20
  ) {
    return { error: "Choose up to 20 valid interests." };
  }

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("replace_profile_interests", {
    selected_interest_ids: interestIds,
    custom_interest_names: customNames.map((name) => name.trim()),
  });
  if (error) return { error: "We couldn’t save your interests. Please try again." };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}

export async function registerProfilePhoto(
  storagePath: string,
): Promise<{ error?: string; photoId?: string }> {
  const { supabase, user } = await getAuthenticatedClient();
  if (
    typeof storagePath !== "string" ||
    !storagePath.startsWith(`${user.id}/`) ||
    storagePath.includes("..") ||
    storagePath.length > 200
  ) {
    return { error: "That photo path is not valid for your account." };
  }
  const { error: storageCheckError } = await supabase.storage
    .from("profile-photos")
    .createSignedUrl(storagePath, 60);
  if (storageCheckError) {
    return { error: "The uploaded photo could not be verified. Upload it again and retry." };
  }

  const { count, error: countError } = await supabase
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { error: "We couldn’t check your existing photos." };
  if ((count ?? 0) >= 20) return { error: "You can add up to 20 profile photos." };

  const { data: lastPhoto, error: orderError } = await supabase
    .from("profile_photos")
    .select("display_order")
    .eq("user_id", user.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) return { error: "We couldn’t prepare your photo list." };

  const { data, error } = await supabase
    .from("profile_photos")
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      display_order: (lastPhoto?.display_order ?? -1) + 1,
      is_primary: (count ?? 0) === 0,
    })
    .select("id")
    .single();
  if (error) return { error: "The photo uploaded, but we couldn’t save its profile entry." };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { photoId: data.id };
}

export async function setPrimaryPhoto(photoId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(photoId)) {
    return { error: "That photo could not be identified." };
  }
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("set_primary_profile_photo", {
    photo_id: photoId,
  });
  if (error) return { error: "We couldn’t change the primary photo." };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}

export async function reorderProfilePhotos(photoIds: string[]): Promise<ActionResult> {
  if (
    !Array.isArray(photoIds) ||
    photoIds.length > 20 ||
    photoIds.some((id) => !UUID_PATTERN.test(id))
  ) {
    return { error: "That photo order is not valid." };
  }
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("reorder_profile_photos", {
    photo_ids: photoIds,
  });
  if (error) return { error: "We couldn’t reorder your photos." };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}

export async function reorderInterests(interestIds: string[]): Promise<ActionResult> {
  if (
    !Array.isArray(interestIds) ||
    interestIds.length > 20 ||
    interestIds.some((id) => !UUID_PATTERN.test(id))
  ) {
    return { error: "That interest order is not valid." };
  }
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("reorder_profile_interests", {
    interest_ids: interestIds,
  });
  if (error) return { error: "We couldn’t reorder your interests." };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}

export async function removeProfilePhoto(photoId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(photoId)) {
    return { error: "That photo could not be identified." };
  }
  const { supabase, user } = await getAuthenticatedClient();
  const { data: photo, error: findError } = await supabase
    .from("profile_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (findError) return { error: "We couldn’t find that photo." };
  if (!photo) return { error: "That photo no longer exists." };

  const { error: storageError } = await supabase.storage
    .from("profile-photos")
    .remove([photo.storage_path]);
  if (storageError) return { error: "We couldn’t remove the photo file." };

  const { error: deleteError } = await supabase
    .from("profile_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", user.id);
  if (deleteError) {
    return {
      error: "The image file was removed, but its saved photo entry could not be cleared. Reload and contact support if it remains.",
    };
  }

  const { data: remaining, error: listError } = await supabase
    .from("profile_photos")
    .select("id")
    .eq("user_id", user.id)
    .order("display_order");
  if (listError) return { error: "Photo removed, but the remaining order could not be refreshed." };
  if (remaining.length) {
    const { error: reorderError } = await supabase.rpc("reorder_profile_photos", {
      photo_ids: remaining.map((entry) => entry.id),
    });
    if (reorderError) return { error: "Photo removed, but the remaining order could not be updated." };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { success: true };
}
