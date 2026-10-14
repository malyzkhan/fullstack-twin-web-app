import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { HomeNavbar } from "@/components/home/home-navbar";
import {
  getDiscoverableProfiles,
  getProfileBundle,
} from "@/lib/profile/data";
import { formatProfileValue } from "@/lib/profile/presentation";

const pageSize = 24;

async function DiscoverContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await connection();
  const { page: rawPage } = await searchParams;
  const requestedPage = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const pageNumber = /^\d+$/.test(requestedPage ?? "")
    ? Math.min(Math.max(Number(requestedPage), 1), 209)
    : 1;
  const offset = (pageNumber - 1) * pageSize;
  const [profiles, bundle] = await Promise.all([
    getDiscoverableProfiles(offset),
    getProfileBundle(),
  ]);
  const hasNextPage = profiles.length > pageSize;
  const visibleProfiles = profiles.slice(0, pageSize);
  const ownProfileReady =
    bundle.profile.profile_status === "active" &&
    bundle.profile.is_discoverable;

  return (
    <main className="home-page">
      <HomeNavbar name={bundle.profile.display_name || "Your profile"} />
      <section aria-labelledby="discover-title" className="discover-page">
        <header className="discover-heading">
          <div>
            <p className="eyebrow">Thoughtful connections</p>
            <h1 id="discover-title">Discover</h1>
            <p>
              Meet people who are open to being seen. Read their profiles and
              get a feel for the person behind the first impression.
            </p>
          </div>
          <Link className="button button-secondary" href="/profile">
            View your profile
          </Link>
        </header>

        {!ownProfileReady ? (
          <aside className="discover-profile-note">
            <div>
              <strong>Your profile isn’t listed yet.</strong>
              <p>
                Finish your profile and turn on discoverability when you’re
                ready. Only active profiles you choose to share appear here.
              </p>
            </div>
            <Link className="button button-primary" href="/profile/edit?section=visibility">
              Set up discoverability
            </Link>
          </aside>
        ) : null}

        {visibleProfiles.length ? (
          <>
            <p className="discover-result-count" aria-live="polite">
              {visibleProfiles.length === 1
                ? "1 profile"
                : `${visibleProfiles.length} profiles`}
              {hasNextPage || pageNumber > 1 ? ` · Page ${pageNumber}` : ""}
            </p>
            <div className="discover-grid">
              {visibleProfiles.map((profile) => {
                const primaryPhoto =
                  profile.photos.find((photo) => photo.is_primary) ??
                  profile.photos[0];
                const interests = profile.interests.slice(0, 4);
                return (
                  <article className="discover-card" key={profile.id}>
                    <Link
                      aria-label={`View ${profile.display_name}'s profile`}
                      className="discover-card-link"
                      href={`/profile/${profile.id}`}
                    >
                      <div className="discover-card-photo">
                        {primaryPhoto?.signed_url ? (
                          <Image
                            alt={`${profile.display_name}'s profile`}
                            className="discover-card-image"
                            fill
                            sizes="(max-width: 620px) 100vw, (max-width: 980px) 50vw, 33vw"
                            src={primaryPhoto.signed_url}
                            unoptimized
                          />
                        ) : (
                          <span aria-hidden="true" className="discover-card-monogram">
                            {profile.display_name.trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="discover-card-content">
                        <div className="discover-card-title">
                          <h2>{profile.display_name}</h2>
                          {profile.age ? <span>{profile.age}</span> : null}
                        </div>
                        {profile.city ? (
                          <p className="discover-card-location">{profile.city}</p>
                        ) : null}
                        {profile.headline ? (
                          <p className="discover-card-headline">{profile.headline}</p>
                        ) : null}
                        {profile.bio ? (
                          <p className="discover-card-bio">{profile.bio}</p>
                        ) : null}
                        {interests.length ? (
                          <ul aria-label="Interests" className="discover-card-interests">
                            {interests.map((interest) => (
                              <li key={`${interest.display_order}-${interest.name}`}>
                                {interest.name}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {profile.relationship_intention ? (
                          <p className="discover-card-intention">
                            {formatProfileValue(profile.relationship_intention)}
                          </p>
                        ) : null}
                        <span className="discover-card-open">Read profile <span aria-hidden="true">→</span></span>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
            {pageNumber > 1 || hasNextPage ? (
              <nav aria-label="Discover pages" className="discover-pagination">
                {pageNumber > 1 ? (
                  <Link
                    className="button button-secondary"
                    href={pageNumber === 2 ? "/discover" : `/discover?page=${pageNumber - 1}`}
                  >
                    Previous
                  </Link>
                ) : <span />}
                {hasNextPage ? (
                  <Link
                    className="button button-secondary"
                    href={`/discover?page=${pageNumber + 1}`}
                  >
                    More profiles
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : (
          <div className="discover-empty-state">
            <span aria-hidden="true" className="empty-state-mark">✳</span>
            <h2>No profiles to show just yet.</h2>
            <p>
              New people appear here when they finish their profile and choose
              to be discoverable. Try again later, or review your own profile.
            </p>
            <Link className="text-link" href="/profile/edit">
              Continue building your profile
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Finding profiles…</p></main>}>
      <DiscoverContent searchParams={searchParams} />
    </Suspense>
  );
}
