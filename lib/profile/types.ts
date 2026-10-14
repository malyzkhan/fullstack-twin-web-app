export type ProfileRecord = {
  id: string;
  display_name: string;
  date_of_birth: string | null;
  pronouns: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  worldview: string | null;
  worldview_description: string | null;
  children_preference: string | null;
  date_parent_preference: string | null;
  relationship_intention: string | null;
  relationship_structure: string | null;
  personality_type: string | null;
  profile_prompts: Record<string, string>;
  profile_status: "draft" | "active" | "paused";
  is_discoverable: boolean;
};

export type ProfileVisibilityRecord = {
  field_name: string;
  visibility: "public" | "private";
};

export type UserPreferenceRecord = {
  min_age: number;
  max_age: number;
  max_distance_km: number | null;
  relationship_intentions: string[];
  children_preferences: string[];
};

export type UserSettingsRecord = {
  notify_likes: boolean;
  notify_matches: boolean;
  notify_messages: boolean;
  notify_product_updates: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  theme: "system" | "light" | "dark";
  language: "en";
  distance_units: "km" | "mi";
};

export type ProfileInterestRecord = {
  id: string;
  interest_id: number | null;
  custom_name: string | null;
  display_order: number;
};

export type InterestRecord = {
  id: number;
  name: string;
  category: string;
};

export type ProfilePhotoRecord = {
  id: string;
  storage_path: string;
  display_order: number;
  is_primary: boolean;
};

export type ProfileBundle = {
  profile: ProfileRecord;
  visibility: ProfileVisibilityRecord[];
  preferences: UserPreferenceRecord;
  settings: UserSettingsRecord;
  interests: Array<ProfileInterestRecord & { name: string; category: string }>;
  interestCatalog: InterestRecord[];
  photos: Array<ProfilePhotoRecord & { signedUrl: string }>;
  blockedUsers: Array<{ blocked_user_id: string; created_at: string }>;
};

export type PublicProfile = {
  is_owner?: boolean;
  display_name: string;
  age: number | null;
  pronouns: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  worldview: string | null;
  worldview_description: string | null;
  children_preference: string | null;
  date_parent_preference: string | null;
  relationship_intention: string | null;
  relationship_structure: string | null;
  personality_type: string | null;
  prompts: Record<string, string>;
  interests: Array<{ name: string; category: string | null; display_order: number }>;
  photos: Array<{
    storage_path: string;
    display_order: number;
    is_primary: boolean;
    signed_url?: string;
  }>;
};

export type DiscoverableProfile = PublicProfile & { id: string };
