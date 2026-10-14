"use client";

import { ProfileLoadError } from "@/components/profile/profile-load-error";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ProfileLoadError area="Your profile" error={error} reset={reset} />;
}
