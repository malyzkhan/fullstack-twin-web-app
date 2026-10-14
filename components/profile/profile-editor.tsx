"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProfileBundle, ProfileRecord } from "@/lib/profile/types";
import { saveProfileSection, saveVisibility } from "@/app/profile/edit/actions";
import { profilePrompts } from "@/lib/profile/prompts";
import { ProfilePhotosManager } from "./profile-photos-manager";
import { InterestsEditor } from "./interests-editor";

const sections = [
  ["basics", "Basics"],
  ["photos", "Photos"],
  ["about", "About me"],
  ["worldview", "Worldview"],
  ["family", "Children and family"],
  ["interests", "Personality and interests"],
  ["relationship", "Relationship information"],
  ["visibility", "Visibility and preview"],
] as const;

type Section = (typeof sections)[number][0];
type Message = { kind: "success" | "error"; text: string } | null;

const worldviewOptions = [
  ["", "Choose if you wish"],
  ["atheist", "Atheist"],
  ["agnostic", "Agnostic"],
  ["irreligious", "Irreligious"],
  ["humanist", "Humanist"],
  ["spiritual_but_not_religious", "Spiritual but not religious"],
  ["religious", "Religious"],
  ["questioning", "Questioning"],
  ["other", "Other"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const childOptions = [
  ["", "Choose if you wish"],
  ["childfree", "Childfree"],
  ["wants_children", "Wants children"],
  ["unsure", "Unsure"],
  ["open_to_discussing", "Open to discussing"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const dateParentOptions = [
  ["", "Choose if you wish"],
  ["yes", "Yes"],
  ["no", "No"],
  ["open_to_discussing", "Open to discussing"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const intentionOptions = [
  ["", "Choose if you wish"],
  ["long_term", "Long-term relationship"],
  ["casual", "Casual dating"],
  ["friendship", "Friendship"],
  ["open_to_see", "Open to seeing where it goes"],
];
const structureOptions = [
  ["", "Choose if you wish"],
  ["monogamy", "Monogamy"],
  ["consensual_non_monogamy", "Consensual non-monogamy"],
  ["open_to_discussing", "Open to discussing"],
  ["prefer_not_to_say", "Prefer not to say"],
];
const personalityOptions = [
  ["", "Choose if you wish"],
  ["introvert", "Introvert"],
  ["extrovert", "Extrovert"],
  ["ambivert", "Ambivert"],
  ["prefer_not_to_say", "Prefer not to say"],
];

function Field({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  help?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="profile-form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {help ? <p className="profile-field-help">{help}</p> : null}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  maxLength,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="profile-form-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
      <span className="character-count">{value.length}/{maxLength}</span>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="profile-form-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}

function ProfileMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={`form-message form-message-${message.kind}`} role="status">
      {message.text}
    </p>
  );
}

export function ProfileEditor({
  bundle,
  initialSection = "basics",
}: {
  bundle: ProfileBundle;
  initialSection?: Section;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord>(bundle.profile);
  const [savedProfile, setSavedProfile] = useState<ProfileRecord>(bundle.profile);
  const [section, setSection] = useState<Section>(initialSection);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [visibility, setVisibility] = useState(
    Object.fromEntries(bundle.visibility.map((item) => [item.field_name, item.visibility])) as Record<string, "public" | "private">,
  );
  const [visibilityBusy, setVisibilityBusy] = useState("");

  useEffect(() => {
    if (!dirty) return;
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  function chooseSection(next: Section) {
    if (next === section) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setProfile(savedProfile);
    setDirty(false);
    setMessage(null);
    setSection(next);
  }

  function update<K extends keyof ProfileRecord>(field: K, value: ProfileRecord[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage(null);
  }

  async function save(
    sectionToSave: Parameters<typeof saveProfileSection>[0],
    values: Partial<ProfileRecord>,
  ) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveProfileSection(sectionToSave, values);
      if (result.error) {
        if (sectionToSave === "visibility") {
          setProfile((current) => ({
            ...current,
            is_discoverable: savedProfile.is_discoverable,
            profile_status: savedProfile.profile_status,
          }));
          setDirty(false);
        }
        setMessage({ kind: "error", text: result.error });
      } else {
        setProfile((current) => ({ ...current, ...values }));
        setSavedProfile((current) => ({ ...current, ...values }));
        setDirty(false);
        setMessage({ kind: "success", text: "Changes saved." });
        router.refresh();
      }
    } catch {
      if (sectionToSave === "visibility") {
        setProfile((current) => ({
          ...current,
          is_discoverable: savedProfile.is_discoverable,
          profile_status: savedProfile.profile_status,
        }));
        setDirty(false);
      }
      setMessage({ kind: "error", text: "We couldn’t save these changes. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function changeVisibility(fieldName: string, isPublic: boolean) {
    setVisibilityBusy(fieldName);
    setMessage(null);
    const next = isPublic ? "public" : "private";
    try {
      const result = await saveVisibility(fieldName, next);
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
      } else {
        setVisibility((current) => ({ ...current, [fieldName]: next }));
        setMessage({ kind: "success", text: "Visibility updated." });
        router.refresh();
      }
    } catch {
      setMessage({ kind: "error", text: "We couldn’t update visibility. Try again." });
    } finally {
      setVisibilityBusy("");
    }
  }

  const identity = bundle.profile.display_name || "Your profile";
  const publicHref = `/profile/${bundle.profile.id}`;

  return (
    <main className="home-page">
      <header className="site-header profile-editor-header">
        <Link aria-label="Twin home" className="wordmark" href="/home">twin<span>.</span></Link>
        <div className="profile-editor-header-actions">
          <Link className="text-link" href="/profile">View profile</Link>
          <Link className="button button-secondary" href="/settings/profile">Account settings</Link>
        </div>
      </header>
      <div className="profile-editor-layout">
        <aside aria-label="Profile editing sections" className="profile-editor-nav">
          <p className="eyebrow">Your profile</p>
          <h1>Edit profile</h1>
          <p className="profile-editor-nav-copy">Build a profile that feels like you. Every section is optional except your display name.</p>
          <nav aria-label="Profile sections" className="profile-editor-section-list">
          {sections.map(([id, label], index) => (
            <button
              aria-current={section === id ? "step" : undefined}
              className={section === id ? "profile-editor-nav-item selected" : "profile-editor-nav-item"}
              key={id}
              onClick={() => chooseSection(id)}
              type="button"
            >
              <span aria-hidden="true" className="profile-editor-step-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{label}</span>
            </button>
          ))}
          </nav>
          <div className="profile-editor-nav-footer">
            <span className={profile.is_discoverable && profile.profile_status === "active" ? "profile-status-dot is-active" : "profile-status-dot"} />
            <span>{profile.is_discoverable && profile.profile_status === "active" ? "Discoverable" : "Not discoverable"}</span>
            <Link href="/profile/edit?section=visibility">Manage privacy</Link>
          </div>
        </aside>

        <section aria-labelledby="profile-section-title" className="profile-editor-panel">
          <div className="profile-editor-panel-heading">
            <div>
              <p className="eyebrow">Profile details</p>
              <h2 id="profile-section-title">{sections.find(([id]) => id === section)?.[1]}</h2>
            </div>
            <span className="profile-editor-section-count">
              {String(sections.findIndex(([id]) => id === section) + 1).padStart(2, "0")} <span>/ {String(sections.length).padStart(2, "0")}</span>
            </span>
          </div>
          <p className="profile-section-intro">
            {section === "visibility"
              ? "Choose which details appear on your profile. Personal preferences stay private."
              : "Share as much or as little as feels comfortable. You can change this any time."}
          </p>
          <ProfileMessage message={message} />

          {section === "basics" ? (
            <div className="profile-form-grid">
              <Field label="Display name" maxLength={80} onChange={(value) => update("display_name", value)} value={profile.display_name} />
              <Field
                help="Used only to calculate your age; your full birth date is never displayed."
                label="Date of birth"
                onChange={(value) => update("date_of_birth", value || null)}
                type="date"
                value={profile.date_of_birth ?? ""}
              />
              <Field label="Pronouns (optional)" maxLength={50} onChange={(value) => update("pronouns", value || null)} value={profile.pronouns ?? ""} />
              <Field label="City or general location" maxLength={100} onChange={(value) => update("city", value || null)} value={profile.city ?? ""} />
              <div className="profile-form-wide">
                <Field label="Profile headline" maxLength={120} onChange={(value) => update("headline", value || null)} value={profile.headline ?? ""} />
              </div>
              <div className="profile-editor-actions profile-form-wide">
                <button className="button button-primary" disabled={saving || !dirty} onClick={() => void save("basics", {
                  display_name: profile.display_name,
                  date_of_birth: profile.date_of_birth,
                  pronouns: profile.pronouns ?? "",
                  city: profile.city ?? "",
                  headline: profile.headline ?? "",
                })} type="button">{saving ? "Saving…" : "Save basics"}</button>
              </div>
            </div>
          ) : null}

          {section === "photos" ? <ProfilePhotosManager photos={bundle.photos} /> : null}

          {section === "about" ? (
            <div className="profile-editor-stack">
              <TextArea label="About me" maxLength={2000} onChange={(value) => update("bio", value || null)} value={profile.bio ?? ""} />
              <h3>Optional prompts</h3>
              {Object.entries(profilePrompts).map(([key, label]) => (
                <TextArea
                  key={key}
                  label={label}
                  maxLength={500}
                  onChange={(value) => update("profile_prompts", { ...profile.profile_prompts, [key]: value })}
                  rows={3}
                  value={profile.profile_prompts[key] ?? ""}
                />
              ))}
              <div className="profile-editor-actions">
                <button className="button button-primary" disabled={saving || !dirty} onClick={() => void save("about", {
                  bio: profile.bio ?? "",
                  profile_prompts: profile.profile_prompts,
                })} type="button">{saving ? "Saving…" : "Save about me"}</button>
              </div>
            </div>
          ) : null}

          {section === "worldview" ? (
            <div className="profile-editor-stack">
              <p className="profile-field-help">This is optional and private by default. You decide if it appears on your profile.</p>
              <SelectField label="Religious or philosophical identity" onChange={(value) => update("worldview", value || null)} options={worldviewOptions} value={profile.worldview ?? ""} />
              <TextArea label="A little more about your worldview (optional)" maxLength={500} onChange={(value) => update("worldview_description", value || null)} rows={4} value={profile.worldview_description ?? ""} />
              <div className="profile-editor-actions">
                <button className="button button-primary" disabled={saving || !dirty} onClick={() => void save("worldview", {
                  worldview: profile.worldview,
                  worldview_description: profile.worldview_description ?? "",
                })} type="button">{saving ? "Saving…" : "Save worldview"}</button>
              </div>
            </div>
          ) : null}

          {section === "family" ? (
            <div className="profile-editor-stack">
              <p className="profile-field-help">Family preferences are optional and private by default. They are not a judgment about anyone else’s family.</p>
              <SelectField label="Your thoughts about children" onChange={(value) => update("children_preference", value || null)} options={childOptions} value={profile.children_preference ?? ""} />
              <SelectField label="Open to dating someone who has children" onChange={(value) => update("date_parent_preference", value || null)} options={dateParentOptions} value={profile.date_parent_preference ?? ""} />
              <div className="profile-editor-actions">
                <button className="button button-primary" disabled={saving || !dirty} onClick={() => void save("family", {
                  children_preference: profile.children_preference,
                  date_parent_preference: profile.date_parent_preference,
                })} type="button">{saving ? "Saving…" : "Save family preferences"}</button>
              </div>
            </div>
          ) : null}

          {section === "interests" ? (
            <div className="profile-editor-stack">
              <InterestsEditor catalog={bundle.interestCatalog} interests={bundle.interests} />
              <SelectField label="Social preference (optional)" onChange={(value) => update("personality_type", value || null)} options={personalityOptions} value={profile.personality_type ?? ""} />
              <div className="profile-editor-actions">
                <button className="button button-primary" disabled={saving || profile.personality_type === savedProfile.personality_type} onClick={() => void save("interests", {
                  personality_type: profile.personality_type,
                })} type="button">{saving ? "Saving…" : "Save social preference"}</button>
              </div>
            </div>
          ) : null}

          {section === "relationship" ? (
            <div className="profile-editor-stack">
              <p className="profile-field-help">These details are optional and private unless you choose to share them below.</p>
              <SelectField label="Relationship intention" onChange={(value) => update("relationship_intention", value || null)} options={intentionOptions} value={profile.relationship_intention ?? ""} />
              <SelectField label="Relationship structure" onChange={(value) => update("relationship_structure", value || null)} options={structureOptions} value={profile.relationship_structure ?? ""} />
              <div className="profile-editor-actions">
                <button className="button button-primary" disabled={saving || !dirty} onClick={() => void save("relationship", {
                  relationship_intention: profile.relationship_intention,
                  relationship_structure: profile.relationship_structure,
                })} type="button">{saving ? "Saving…" : "Save relationship information"}</button>
              </div>
            </div>
          ) : null}

          {section === "visibility" ? (
            <div className="profile-editor-stack">
              <Link className="button button-secondary preview-profile-button" href={publicHref} target="_blank">
                Preview public profile
              </Link>
              <div className="profile-visibility-list">
                {[
                  ["age", "Age"],
                  ["photos", "Profile photos"],
                  ["pronouns", "Pronouns"],
                  ["city", "City"],
                  ["headline", "Headline"],
                  ["bio", "About me"],
                  ["worldview", "Worldview"],
                  ["worldview_description", "Worldview details"],
                  ["children_preference", "Children preferences"],
                  ["date_parent_preference", "Dating someone with children"],
                  ["relationship_intention", "Relationship intention"],
                  ["relationship_structure", "Relationship structure"],
                  ["personality_type", "Social preference"],
                  ["prompts", "Prompt answers"],
                  ["interests", "Interests"],
                ].map(([field, label]) => (
                  <label className="visibility-row" key={field}>
                    <span>
                      <strong>{label}</strong>
                      <small>{field === "age" || field === "photos" ? "Visible by default" : "Private by default"}</small>
                    </span>
                    <select
                      aria-label={`${label} visibility`}
                      disabled={visibilityBusy === field}
                      onChange={(event) => void changeVisibility(field, event.target.value === "public")}
                      value={visibility[field] ?? (field === "age" || field === "photos" ? "public" : "private")}
                    >
                      <option value="public">Visible on profile</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                ))}
              </div>
              <div className="profile-discovery-toggle">
                <div>
                  <strong>Profile discoverability</strong>
                  <p>Only active, discoverable profiles can appear in future discovery surfaces.</p>
                </div>
                <label className="switch-label">
                  <input
                    checked={profile.is_discoverable && profile.profile_status === "active"}
                    onChange={(event) => {
                      const discoverable = event.target.checked;
                      const status = discoverable ? "active" : "paused";
                      update("is_discoverable", discoverable);
                      update("profile_status", status);
                      void save("visibility", {
                        is_discoverable: discoverable,
                        profile_status: status,
                      });
                    }}
                    type="checkbox"
                  />
                  <span>{profile.is_discoverable && profile.profile_status === "active" ? "Discoverable" : "Paused"}</span>
                </label>
              </div>
            </div>
          ) : null}
          <p className="profile-editor-owner-note">Editing profile for {identity}. Your email and full birth date are never shown publicly.</p>
        </section>
      </div>
    </main>
  );
}
