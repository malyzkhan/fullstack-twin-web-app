"use client";

import Link from "next/link";
import {
  DISCOVER_SCHEMA_NOT_READY,
  PROFILE_SCHEMA_NOT_READY,
} from "@/lib/profile/errors";

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const discoverFunctionMissing = error.message === DISCOVER_SCHEMA_NOT_READY;
  const profileSchemaMissing = error.message === PROFILE_SCHEMA_NOT_READY;

  return (
    <main className="home-page">
      <section aria-labelledby="discover-error-title" className="profile-load-error" role="alert">
        <p className="eyebrow">Discover</p>
        <h1 id="discover-error-title">
          {discoverFunctionMissing || profileSchemaMissing
            ? "Supabase setup is incomplete"
            : "We couldn’t load Discover"}
        </h1>
        {discoverFunctionMissing ? (
          <>
            <p>
              The Discover feed function is missing from the Supabase project
              connected to this app.
            </p>
            <ol>
              <li>Open the correct project in Supabase Dashboard and choose SQL Editor.</li>
              <li>
                Open <code>supabase/migrations/202610150001_discover_profiles.sql</code> in
                this project, copy the entire file contents, and run them in SQL Editor.
              </li>
              <li>
                If it succeeds but Discover still reports a missing function, run{" "}
                <code>NOTIFY pgrst, &apos;reload schema&apos;;</code>, wait briefly, then retry.
              </li>
            </ol>
            <p className="profile-field-help">
              This migration requires the profile migration
              <code>202610140001_twin_profiles.sql</code> to have been applied first.
              “Success. No rows returned” is normal for these SQL changes.
            </p>
          </>
        ) : profileSchemaMissing ? (
          <>
            <p>
              The profile tables or functions are missing from the connected
              Supabase project. Apply the profile migration first.
            </p>
            <ol>
              <li>Open the project’s Supabase Dashboard and choose SQL Editor.</li>
              <li>
                Run the full contents of{" "}
                <code>supabase/migrations/202610140001_twin_profiles.sql</code>.
              </li>
              <li>
                Then run the Discover migration
                <code>supabase/migrations/202610150001_discover_profiles.sql</code>.
              </li>
              <li>
                If needed, run <code>NOTIFY pgrst, &apos;reload schema&apos;;</code>,
                wait briefly, then retry.
              </li>
            </ol>
          </>
        ) : (
          <p>
            Please try again. If the problem continues, check the app’s server
            logs for the underlying Supabase error.
          </p>
        )}
        <div className="profile-load-error-actions">
          <button className="button button-primary" onClick={reset} type="button">
            Try again
          </button>
          <Link className="button button-secondary" href="/home">
            Back to Twin
          </Link>
        </div>
      </section>
    </main>
  );
}
