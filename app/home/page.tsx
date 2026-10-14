import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HomeNavbar } from "@/components/home/home-navbar";
import { createClient } from "@/lib/supabase/server";

function HomeLoading() {
  return (
    <main className="home-page">
      <p className="loading-note" role="status">Loading your account…</p>
    </main>
  );
}

async function AuthenticatedHome() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    throw error;
  }
  if (!data.user) redirect("/login");

  const provider = data.user.app_metadata.provider;
  if (provider === "email" && !data.user.email_confirmed_at) {
    redirect("/verify-email");
  }

  const metadataName = data.user.user_metadata.full_name;
  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : data.user.email || "Your account";

  return (
    <main className="home-page">
      <HomeNavbar name={displayName} />
      <section aria-labelledby="home-title" className="home-welcome">
        <p className="eyebrow">Your space</p>
        <h1 id="home-title">Welcome, {displayName}.</h1>
        <p>
          Thoughtful connections start with being yourself. Create a profile
          that reflects what matters to you, then explore the people who are
          ready to meet.
        </p>
        <div className="home-start-actions">
          <Link className="button button-primary" href="/profile/edit">
            Create or edit your profile
          </Link>
          <Link className="button button-secondary" href="/discover">
            Discover people
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <AuthenticatedHome />
    </Suspense>
  );
}
