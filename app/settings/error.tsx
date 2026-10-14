"use client";

import { ProfileLoadError } from "@/components/profile/profile-load-error";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ProfileLoadError area="Account settings" error={error} reset={reset} />;
}
