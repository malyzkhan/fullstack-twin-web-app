"use client";

import Link from "next/link";

export default function ChatsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const migrationRequired =
    error.message === "TWIN_CHAT_SCHEMA_NOT_READY" ||
    error.name === "ChatSchemaNotReadyError";

  return (
    <main className="home-page">
      <section aria-labelledby="chat-error-title" className="profile-load-error" role="alert">
        <p className="eyebrow">Twin chats</p>
        <h1 id="chat-error-title">
          {migrationRequired ? "Chat setup is not finished" : "We couldn’t load your chats"}
        </h1>
        {migrationRequired ? (
          <>
            <p>
              Apply the chat database migration to the Supabase project used by
              this deployment.
            </p>
            <ol>
              <li>Open Supabase Dashboard → SQL Editor for the correct project.</li>
              <li>
                Run the full contents of{" "}
                <code>supabase/migrations/202610150002_twin_chat.sql</code>.
              </li>
              <li>
                Confirm the <code>chat_messages</code> table is enabled in the{" "}
                <code>supabase_realtime</code> publication. The migration adds it
                automatically when that publication exists.
              </li>
            </ol>
            <p className="profile-field-help">
              Apply the profile and Discover migrations first. “Success. No rows
              returned” is expected for these schema changes.
            </p>
          </>
        ) : (
          <p>Please try again. Your saved messages are not removed when a page fails to load.</p>
        )}
        <div className="profile-load-error-actions">
          <button className="button button-primary" onClick={reset} type="button">Try again</button>
          <Link className="button button-secondary" href="/home">Back to Twin</Link>
        </div>
      </section>
    </main>
  );
}
