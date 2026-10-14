"use client";

import Link from "next/link";
import { PROFILE_SCHEMA_NOT_READY } from "@/lib/profile/errors";

export function ProfileLoadError({
  error,
  reset,
  area,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  area: string;
}) {
  const schemaMissing = error.message === PROFILE_SCHEMA_NOT_READY;

  return (
    <main className="home-page">
      <section aria-labelledby="profile-load-error-title" className="profile-load-error" role="alert">
        <p className="eyebrow">{area}</p>
        <h1 id="profile-load-error-title">
          {schemaMissing ? "Profile setup is not finished" : `We couldn’t load ${area.toLowerCase()}`}
        </h1>
        {schemaMissing ? (
          <>
            <p>
              The profile database setup is missing from your Supabase project.
              Apply the Twin profile migration, then reload this page.
            </p>
            <ol>
              <li>Open the project’s Supabase Dashboard and choose SQL Editor.</li>
              <li>Run <code>supabase/migrations/202610140001_twin_profiles.sql</code> from this project.</li>
              <li>If Supabase still reports missing tables, run <code>NOTIFY pgrst, &apos;reload schema&apos;;</code>, wait briefly, then retry.</li>
            </ol>
            <p className="profile-field-help">
              The migration must finish successfully. It creates the profile tables,
              row-level security policies, and private photo storage bucket.
            </p>
          </>
        ) : (
          <p>Try again. If this keeps happening, contact Twin support.</p>
        )}
        <div className="profile-load-error-actions">
          <button className="button button-primary" onClick={reset} type="button">Try again</button>
          <Link className="button button-secondary" href="/home">Back to Twin</Link>
        </div>
      </section>
    </main>
  );
}
