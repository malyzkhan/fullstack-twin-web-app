import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/home/sign-out-button";
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
      <header className="site-header">
        <Link aria-label="Twin home" className="wordmark" href="/home">
          twin<span>.</span>
        </Link>
        <SignOutButton />
      </header>
      <section aria-labelledby="home-title" className="home-welcome">
        <p className="eyebrow">Your space</p>
        <h1 id="home-title">Welcome, {displayName}.</h1>
        <p>
          Your Twin account is ready. Thoughtful connections start with being
          yourself rn app is under construction, but we&apos;re excited to have you here. We&apos;ll be adding more features soon, so stay tuned for updates and new ways to connect with others.
        </p>
        <div className="empty-state">
          <span aria-hidden="true" className="empty-state-mark">✳</span>
          <h2>Your story starts here.</h2>
          <p>
            We&apos;re making space for meaningful connections. There&apos;s
            nothing to explore just yet.
          </p>
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
