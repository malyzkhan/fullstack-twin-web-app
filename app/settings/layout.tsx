import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/settings/settings-shell";
import { createClient } from "@/lib/supabase/server";

async function VerifiedSettings({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) redirect("/login");
  if (
    data.user.app_metadata.provider === "email" &&
    !data.user.email_confirmed_at
  ) {
    redirect("/verify-email");
  }

  return <SettingsShell>{children}</SettingsShell>;
}

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Loading account settings…</p></main>}>
      <VerifiedSettings>{children}</VerifiedSettings>
    </Suspense>
  );
}
