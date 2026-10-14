"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  savePreferences,
  saveProfileSection,
  saveUserSetting,
  saveVisibility,
  unblockUser,
} from "@/app/profile/edit/actions";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type {
  ProfileVisibilityRecord,
  UserPreferenceRecord,
  UserSettingsRecord,
} from "@/lib/profile/types";
import type { BlockedProfile } from "@/lib/profile/settings-data";

type Notice = { kind: "success" | "error"; text: string } | null;

function NoticeMessage({ notice }: { notice: Notice }) {
  return notice ? (
    <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      {notice.text}
    </p>
  ) : null;
}

const notificationOptions = [
  ["notify_likes", "Likes", "When someone likes your profile."],
  ["notify_matches", "Matches", "When a new match is available."],
  ["notify_messages", "Messages", "When you receive a message."],
  ["notify_product_updates", "Product updates", "Occasional Twin product news."],
  ["email_notifications", "Email notifications", "Allow account notifications by email."],
  ["push_notifications", "Push notifications", "Allow browser or device notifications."],
] as const satisfies readonly (readonly [keyof UserSettingsRecord, string, string])[];

export function NotificationSettingsForm({ settings }: { settings: UserSettingsRecord }) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [busy, setBusy] = useState<keyof UserSettingsRecord | "">("");
  const [notice, setNotice] = useState<Notice>(null);

  async function update<K extends keyof UserSettingsRecord>(key: K, value: UserSettingsRecord[K]) {
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: value }));
    setBusy(key);
    setNotice(null);
    try {
      const result = await saveUserSetting(key, value);
      if (result.error) {
        setValues((current) => ({ ...current, [key]: previous }));
        setNotice({ kind: "error", text: result.error });
      } else {
        setNotice({ kind: "success", text: "Your setting was saved." });
        router.refresh();
      }
    } catch {
      setValues((current) => ({ ...current, [key]: previous }));
      setNotice({ kind: "error", text: "We couldn’t save that setting. Try again." });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="settings-form-stack">
      <p className="profile-field-help">
        These preferences are saved to your account. Message delivery and browser push
        notifications are not connected until those services are configured.
      </p>
      {notificationOptions.map(([key, title, description]) => (
        <label className="settings-toggle-row" key={key}>
          <span><strong>{title}</strong><small>{description}</small></span>
          <input
            aria-label={title}
            checked={values[key] as boolean}
            disabled={busy === key}
            onChange={(event) => void update(key, event.target.checked)}
            type="checkbox"
          />
        </label>
      ))}
      <NoticeMessage notice={notice} />
    </div>
  );
}

const intentionOptions = [
  ["long_term", "Long-term relationship"],
  ["casual", "Casual dating"],
  ["friendship", "Friendship"],
  ["open_to_see", "Open to seeing where it goes"],
] as const;
const childrenOptions = [
  ["childfree", "Childfree"],
  ["wants_children", "Wants children"],
  ["unsure", "Unsure"],
  ["open_to_discussing", "Open to discussing"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;

export function DiscoveryPreferencesForm({ preferences }: { preferences: UserPreferenceRecord }) {
  const router = useRouter();
  const [values, setValues] = useState(preferences);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  function toggleArrayValue(
    key: "relationship_intentions" | "children_preferences",
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
    setNotice(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await savePreferences(values);
      if (result.error) setNotice({ kind: "error", text: result.error });
      else {
        setNotice({ kind: "success", text: "Discovery preferences saved." });
        router.refresh();
      }
    } catch {
      setNotice({ kind: "error", text: "We couldn’t save your preferences. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings-form-stack" onSubmit={submit}>
      <p className="profile-field-help">These are private preferences for future discovery features. The minimum age is 18.</p>
      <div className="settings-number-grid">
        <label className="settings-field">
          <span>Minimum age</span>
          <input max={99} min={18} onChange={(event) => setValues((current) => ({ ...current, min_age: Number(event.target.value) }))} required type="number" value={values.min_age} />
        </label>
        <label className="settings-field">
          <span>Maximum age</span>
          <input max={99} min={18} onChange={(event) => setValues((current) => ({ ...current, max_age: Number(event.target.value) }))} required type="number" value={values.max_age} />
        </label>
        <label className="settings-field">
          <span>Maximum distance (km)</span>
          <input max={1000} min={1} onChange={(event) => setValues((current) => ({ ...current, max_distance_km: event.target.value ? Number(event.target.value) : null }))} placeholder="Any distance" type="number" value={values.max_distance_km ?? ""} />
        </label>
      </div>
      <fieldset className="settings-choice-group">
        <legend>Relationship intentions</legend>
        {intentionOptions.map(([value, label]) => (
          <label key={value}><input checked={values.relationship_intentions.includes(value)} onChange={() => toggleArrayValue("relationship_intentions", value)} type="checkbox" />{label}</label>
        ))}
      </fieldset>
      <fieldset className="settings-choice-group">
        <legend>Family preferences</legend>
        {childrenOptions.map(([value, label]) => (
          <label key={value}><input checked={values.children_preferences.includes(value)} onChange={() => toggleArrayValue("children_preferences", value)} type="checkbox" />{label}</label>
        ))}
      </fieldset>
      <NoticeMessage notice={notice} />
      <button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save preferences"}</button>
    </form>
  );
}

export function PrivacySettingsForm({
  visibility,
  discoverable,
  profileStatus,
  blockedProfiles,
}: {
  visibility: ProfileVisibilityRecord[];
  discoverable: boolean;
  profileStatus: "draft" | "active" | "paused";
  blockedProfiles: BlockedProfile[];
}) {
  const router = useRouter();
  const [visibleFields, setVisibleFields] = useState(
    Object.fromEntries(visibility.map((item) => [item.field_name, item.visibility])) as Record<string, "public" | "private">,
  );
  const [isDiscoverable, setIsDiscoverable] = useState(discoverable && profileStatus === "active");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  async function updateVisibility(field: string, value: "public" | "private") {
    const previous = visibleFields[field] ?? (field === "age" || field === "photos" ? "public" : "private");
    setVisibleFields((current) => ({ ...current, [field]: value }));
    setBusy(field);
    setNotice(null);
    try {
      const result = await saveVisibility(field, value);
      if (result.error) {
        setVisibleFields((current) => ({ ...current, [field]: previous }));
        setNotice({ kind: "error", text: result.error });
      } else {
        setNotice({ kind: "success", text: "Privacy setting saved." });
        router.refresh();
      }
    } catch {
      setVisibleFields((current) => ({ ...current, [field]: previous }));
      setNotice({ kind: "error", text: "We couldn’t save that privacy setting." });
    } finally {
      setBusy("");
    }
  }

  async function updateDiscoverability(value: boolean) {
    setBusy("discoverability");
    setNotice(null);
    try {
      const result = await saveProfileSection("visibility", {
        is_discoverable: value,
        profile_status: value ? "active" : "paused",
      });
      if (result.error) setNotice({ kind: "error", text: result.error });
      else {
        setIsDiscoverable(value);
        setNotice({ kind: "success", text: value ? "Your profile is discoverable." : "Your profile is paused." });
        router.refresh();
      }
    } catch {
      setNotice({ kind: "error", text: "We couldn’t update discoverability." });
    } finally {
      setBusy("");
    }
  }

  async function unblock(id: string) {
    setBusy(id);
    setNotice(null);
    try {
      const result = await unblockUser(id);
      if (result.error) setNotice({ kind: "error", text: result.error });
      else {
        setNotice({ kind: "success", text: "Account unblocked." });
        router.refresh();
      }
    } catch {
      setNotice({ kind: "error", text: "We couldn’t remove that block." });
    } finally {
      setBusy("");
    }
  }

  const fields = [
    ["age", "Age"],
    ["photos", "Photos"],
    ["pronouns", "Pronouns"],
    ["city", "City"],
    ["headline", "Headline"],
    ["bio", "About me"],
    ["worldview", "Worldview"],
    ["worldview_description", "Worldview details"],
    ["children_preference", "Family preferences"],
    ["date_parent_preference", "Dating someone with children"],
    ["relationship_intention", "Relationship intention"],
    ["relationship_structure", "Relationship structure"],
    ["personality_type", "Social preference"],
    ["prompts", "Profile prompts"],
    ["interests", "Interests"],
  ];

  return (
    <div className="settings-form-stack">
      <p className="profile-field-help">Your profile starts private except for age and photos. You control each item separately.</p>
      {fields.map(([field, label]) => (
        <label className="settings-toggle-row" key={field}>
          <span><strong>{label}</strong><small>Choose whether this appears on your profile.</small></span>
          <select
            aria-label={`${label} visibility`}
            disabled={busy === field}
            onChange={(event) => void updateVisibility(field, event.target.value as "public" | "private")}
            value={visibleFields[field] ?? (field === "age" || field === "photos" ? "public" : "private")}
          >
            <option value="public">Visible</option>
            <option value="private">Private</option>
          </select>
        </label>
      ))}
      <label className="settings-toggle-row">
        <span><strong>Profile discoverability</strong><small>Only active profiles can appear in discovery.</small></span>
        <input checked={isDiscoverable} disabled={busy === "discoverability"} onChange={(event) => void updateDiscoverability(event.target.checked)} type="checkbox" />
      </label>
      <section className="settings-subsection">
        <h3>Blocked accounts</h3>
        {blockedProfiles.length ? (
          <ul className="blocked-profile-list">
            {blockedProfiles.map((blocked) => (
              <li key={blocked.blocked_user_id}>
                <span>{blocked.display_name || "Twin member"}</span>
                <button className="button button-secondary" disabled={busy === blocked.blocked_user_id} onClick={() => void unblock(blocked.blocked_user_id)} type="button">
                  {busy === blocked.blocked_user_id ? "Removing…" : "Unblock"}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="profile-field-help">You haven’t blocked any accounts.</p>}
      </section>
      <NoticeMessage notice={notice} />
    </div>
  );
}

export function SecuritySettingsForm({
  email,
  provider,
}: {
  email: string;
  provider: string;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  async function changeEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("email");
    setNotice(null);
    try {
      const { error } = await createClient().auth.updateUser(
        { email: newEmail.trim() },
        {
          emailRedirectTo: new URL(
            "/auth/callback?next=/settings/security",
            window.location.origin,
          ).toString(),
        },
      );
      if (error) setNotice({ kind: "error", text: error.message });
      else {
        setNewEmail("");
        setNotice({ kind: "success", text: "If the address is eligible, Supabase will send the required confirmation email." });
      }
    } catch {
      setNotice({ kind: "error", text: "We couldn’t request an email change. Try again." });
    } finally {
      setBusy("");
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10) {
      setNotice({ kind: "error", text: "Use a password with at least 10 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setNotice({ kind: "error", text: "The passwords do not match." });
      return;
    }
    setBusy("password");
    setNotice(null);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setNotice({ kind: "error", text: error.message });
      else {
        setPassword("");
        setConfirmPassword("");
        setNotice({ kind: "success", text: "Your password was updated." });
      }
    } catch {
      setNotice({ kind: "error", text: "We couldn’t update your password. Try again." });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="settings-form-stack">
      <div className="settings-account-summary">
        <span>Signed in as</span>
        <strong>{email || "Email unavailable"}</strong>
        <small>Sign-in provider: {provider}</small>
      </div>
      {provider === "email" ? (
        <>
          <form className="settings-inline-form" onSubmit={changeEmail}>
            <h3>Change email address</h3>
            <label className="settings-field"><span>New email</span><input autoComplete="email" onChange={(event) => setNewEmail(event.target.value)} required type="email" value={newEmail} /></label>
            <button className="button button-secondary" disabled={busy !== ""} type="submit">{busy === "email" ? "Requesting…" : "Request email change"}</button>
          </form>
          <form className="settings-inline-form" onSubmit={changePassword}>
            <h3>Change password</h3>
            <p className="profile-field-help">Use at least 10 characters. Keep it unique to Twin.</p>
            <label className="settings-field"><span>New password</span><input autoComplete="new-password" minLength={10} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
            <label className="settings-field"><span>Confirm new password</span><input autoComplete="new-password" minLength={10} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
            <button className="button button-primary" disabled={busy !== ""} type="submit">{busy === "password" ? "Updating…" : "Update password"}</button>
          </form>
        </>
      ) : (
        <p className="profile-field-help">Your account uses {provider} sign-in. Manage its password and recovery methods with that provider.</p>
      )}
      <Link className="text-link" href="/forgot-password">Use the password recovery flow</Link>
      <NoticeMessage notice={notice} />
      <p className="profile-field-help">Password changes require a valid signed-in Supabase session. Never share a verification link or password.</p>
      {busy === "email" ? <span className="visually-hidden" aria-live="polite">Requesting email update</span> : null}
    </div>
  );
}

export function AccountDeletionForm() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function deleteAccount() {
    if (!confirmed) return;
    setBusy(true);
    setNotice(null);
    try {
      const client = createClient();
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError || !data.session) {
        setNotice({ kind: "error", text: "Your session expired. Sign in again before deleting your account." });
        return;
      }
      const { url, publishableKey } = getSupabaseConfig();
      const response = await fetch(`${url}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!response.ok) {
        setNotice({
          kind: "error",
          text: response.status === 404
            ? "Account deletion is not deployed yet. Ask the Twin administrator to deploy the secure deletion function."
            : "We couldn’t delete your account. Your data has not been confirmed deleted; contact support.",
        });
        return;
      }
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) {
        setNotice({ kind: "error", text: "Your account was deleted, but this browser could not clear its local session. Close this tab and sign in again only if you create a new account." });
        return;
      }
      router.replace("/login?accountDeleted=1");
    } catch {
      setNotice({ kind: "error", text: "We couldn’t complete account deletion. Contact support before trying again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-danger-zone">
      <p>Your account, profile, interests, and uploaded photos will be permanently removed. This cannot be undone.</p>
      <label className="settings-confirm-delete">
        <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
        <span>I understand this permanently deletes my Twin account.</span>
      </label>
      <button className="button button-danger" disabled={!confirmed || busy} onClick={() => void deleteAccount()} type="button">
        {busy ? "Deleting account…" : "Delete my account"}
      </button>
      <NoticeMessage notice={notice} />
    </section>
  );
}

export function ProfileSafetyActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState("safety");
  const [details, setDetails] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function block() {
    if (!window.confirm("Block this account? Their profile will no longer be available to you.")) return;
    setBusy(true);
    setNotice(null);
    try {
      const { blockUser } = await import("@/app/profile/edit/actions");
      const result = await blockUser(userId);
      if (result.error) setNotice({ kind: "error", text: result.error });
      else router.replace("/home");
    } catch {
      setNotice({ kind: "error", text: "We couldn’t block this account. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function report(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const { submitProfileReport } = await import("@/app/profile/edit/actions");
      const result = await submitProfileReport(userId, category, details);
      if (result.error) setNotice({ kind: "error", text: result.error });
      else {
        setNotice({ kind: "success", text: "Thank you. Your report was sent to the Twin team." });
        setReportOpen(false);
        setDetails("");
      }
    } catch {
      setNotice({ kind: "error", text: "We couldn’t submit the report. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-safety-actions" aria-label="Profile safety">
      <button className="button button-secondary" disabled={busy} onClick={() => void block()} type="button">Block</button>
      <button className="text-link-button" onClick={() => setReportOpen((current) => !current)} type="button">Report profile</button>
      {reportOpen ? (
        <form className="settings-inline-form" onSubmit={report}>
          <label className="settings-field">
            <span>Reason</span>
            <select onChange={(event) => setCategory(event.target.value)} value={category}>
              <option value="safety">Safety concern</option>
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="fake_profile">Fake profile</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="settings-field"><span>Details (optional)</span><textarea maxLength={2000} onChange={(event) => setDetails(event.target.value)} rows={4} value={details} /></label>
          <button className="button button-primary" disabled={busy} type="submit">{busy ? "Sending…" : "Send report"}</button>
        </form>
      ) : null}
      <NoticeMessage notice={notice} />
    </section>
  );
}
