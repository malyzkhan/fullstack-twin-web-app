import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeNavbar } from "@/components/home/home-navbar";
import { ChatRequestAction } from "@/components/chat/chat-request-controls";
import { ProfileSafetyActions } from "@/components/settings/settings-forms";
import { getChatRequestState } from "@/lib/chat/data";
import { getPublicProfile } from "@/lib/profile/data";
import { formatProfileValue } from "@/lib/profile/presentation";
import { getAnsweredPrompts } from "@/lib/profile/prompts";

async function PublicProfileContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) notFound();
  const profile = await getPublicProfile(id);
  const chatRequestState = profile.is_owner ? null : await getChatRequestState(id);
  const name = profile.display_name;
  const answeredPrompts = getAnsweredPrompts(profile.prompts);

  return (
    <main className="home-page">
      <HomeNavbar name={name} />
      <article className="public-profile">
        <Link className="text-link" href="/home">← Back</Link>
        <header className="public-profile-heading">
          <p className="eyebrow">Twin profile</p>
          <h1>{name}{profile.age ? `, ${profile.age}` : ""}</h1>
          {profile.pronouns ? <p>{profile.pronouns}</p> : null}
          {profile.city ? <p>{profile.city}</p> : null}
        </header>
        {!profile.is_owner && chatRequestState ? (
          <div className="public-profile-chat-action">
            <ChatRequestAction state={chatRequestState} targetUserId={id} />
          </div>
        ) : null}

        {profile.photos.length ? (
          <div className="profile-photo-grid">
            {profile.photos.map((photo) => (
              <div className="profile-photo-frame" key={photo.storage_path}>
                <Image
                  alt={photo.is_primary ? `${name}'s primary profile photo` : `${name}'s profile photo`}
                  className="profile-photo-image"
                  fill
                  sizes="(max-width: 600px) 45vw, 280px"
                  src={photo.signed_url ?? ""}
                  unoptimized
                />
                {photo.is_primary ? <span className="primary-photo-label">Primary</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {profile.headline ? <h2 className="profile-headline">{profile.headline}</h2> : null}
        {profile.bio ? (
          <section className="profile-content-section">
            <h2>About</h2>
            <p>{profile.bio}</p>
          </section>
        ) : null}
        {profile.interests.length ? (
          <section className="profile-content-section">
            <h2>Interests</h2>
            <ul className="interest-tags">
              {profile.interests.map((interest) => (
                <li key={`${interest.display_order}-${interest.name}`}>{interest.name}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {profile.worldview ? (
          <section className="profile-content-section">
            <h2>Worldview</h2>
            <p>{formatProfileValue(profile.worldview)}</p>
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
                <div><dt>Relationship structure</dt><dd>{formatProfileValue(profile.relationship_structure)}</dd> </div>
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
        {!profile.is_owner ? <ProfileSafetyActions userId={id} /> : null}
      </article>
    </main>
  );
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Loading profile…</p></main>}>
      <PublicProfileContent params={params} />
    </Suspense>
  );
}
