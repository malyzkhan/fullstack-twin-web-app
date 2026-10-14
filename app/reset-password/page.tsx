import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      description="Choose a new password to keep your account protected."
      eyebrow="Account recovery"
      title="Set a new password."
    >
      <Suspense fallback={<p className="loading-note">Checking your recovery link…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
