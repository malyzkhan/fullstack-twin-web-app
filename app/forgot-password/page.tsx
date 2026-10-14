import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="We’ll send a secure reset link if there’s an account for that address."
      eyebrow="Account recovery"
      footer={
        <p>
          Remembered it? <Link href="/login">Back to sign in</Link>
        </p>
      }
      title="Reset your password."
    >
      <Suspense fallback={<p className="loading-note">Loading recovery form…</p>}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
