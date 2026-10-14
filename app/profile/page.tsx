import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HomeNavbar } from "@/components/home/home-navbar";
import { getProfileBundle } from "@/lib/profile/data";
import { formatProfileValue } from "@/lib/profile/presentation";
import { getAnsweredPrompts } from "@/lib/profile/prompts";

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age;
}

async function ProfileContent() {
  const bundle = await getProfileBundle();
  const { profile } = bundle;
  const completeness = [
    Boolean(profile.display_name.trim()),
    Boolean(profile.headline?.trim()),
    Boolean(profile.bio?.trim()),
    bundle.photos.length > 0,
    bundle.interests.length > 0,
  ].filter(Boolean).length;
  const age = calculateAge(profile.date_of_birth);
  const answeredPrompts = getAnsweredPrompts(profile.profile_prompts);

  return (
    <main className="home-page">
      <HomeNavbar name={profile.display_name || "Your profile"} />
      <div className="profile-page-content">
        <div className="profile-page-heading">
          <div>
            <p className="eyebrow">Your Twin profile</p>
            <h1>{profile.display_name || "Your profile"}</h1>
            <p className="profile-subtitle">
              {age ? `${age}` : ""}
              {age && profile.city ? " · " : ""}
              {profile.city || ""}
              {profile.pronouns ? ` · ${profile.pronouns}` : ""}
            </p>
          </div>
          <Link className="button button-secondary" href="/profile/edit">
            Edit profile
          </Link>
        </div>

        <div className="profile-completion">
          <div className="profile-completion-copy">
            <span>Profile essentials</span>
            <span>{completeness} of 5</span>
          </div>
          <div
            aria-label={`Profile essentials ${completeness} of 5`}
            className="profile-completion-track"
            role="img"
          >
            <span style={{ width: `${(completeness / 5) * 100}%` }} />
          </div>
          <p>Share only what feels right. Sensitive details are private unless you choose otherwise.</p>
        </div>

        {bundle.photos.length ? (
          <div className="profile-photo-grid">
            {bundle.photos.map((photo) => (
              <div className="profile-photo-frame" key={photo.id}>
                <Image
                  alt={photo.is_primary ? "Primary profile photo" : "Profile photo"}
                  className="profile-photo-image"
                  fill
                  sizes="(max-width: 600px) 45vw, 280px"
                  src={photo.signedUrl}
                  unoptimized
                />
                {photo.is_primary ? <span className="primary-photo-label">Primary</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-photo-empty">
            <p>Your profile photo will appear here.</p>
            <Link href="/profile/edit?section=photos">Add a photo</Link>
          </div>
        )}

        {profile.headline ? <h2 className="profile-headline">{profile.headline}</h2> : null}
        {profile.bio ? (
          <section className="profile-content-section">
            <h2>About me</h2>
            <p>{profile.bio}</p>
          </section>
        ) : null}

        {bundle.interests.length ? (
          <section className="profile-content-section">
            <h2>Things I enjoy</h2>
            <ul className="interest-tags">
              {bundle.interests.map((interest) => (
                <li key={interest.id}>{interest.name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {profile.worldview || profile.worldview_description ? (
          <section className="profile-content-section">
            <h2>Worldview</h2>
            {profile.worldview ? <p>{formatProfileValue(profile.worldview)}</p> : null}
            {profile.worldview_description ? <p>{profile.worldview_description}</p> : null}
          </section>
        ) : null}

        {profile.children_preference || profile.date_parent_preference ? (
          <section className="profile-content-section">
            <h2>Children and family</h2>
            <dl className="profile-fact-list">
              {profile.children_preference ? (
                <div><dt>Your thoughts about children</dt><dd>{formatProfileValue(profile.children_preference)}</dd></div>
              ) : null}
              {profile.date_parent_preference ? (
                <div><dt>Dating someone with children</dt><dd>{formatProfileValue(profile.date_parent_preference)}</dd></div>
              ) : null}
            </dl>
          </section>
        ) : null}

        {profile.relationship_intention || profile.relationship_structure ? (
          <section className="profile-content-section">
            <h2>Relationship information</h2>
            <dl className="profile-fact-list">
              {profile.relationship_intention ? (
                <div><dt>Looking for</dt><dd>{formatProfileValue(profile.relationship_intention)}</dd></div>
              ) : null}
              {profile.relationship_structure ? (
                <div><dt>Relationship structure</dt><dd>{formatProfileValue(profile.relationship_structure)}</dd></div>
              ) : null}
            </dl>
          </section>
        ) : null}

        {profile.personality_type ? (
          <section className="profile-content-section">
            <h2>Social preference</h2>
            <p>{formatProfileValue(profile.personality_type)}</p>
          </section>
        ) : null}

        {answeredPrompts.length ? (
          <section className="profile-content-section profile-prompt-section">
            <h2>Optional prompts</h2>
            <div className="profile-prompt-list">
              {answeredPrompts.map(({ key, question, answer }) => (
                <article className="profile-prompt-card" key={key}>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Loading your profile…</p></main>}>
      <ProfileContent />
    </Suspense>
  );
}
