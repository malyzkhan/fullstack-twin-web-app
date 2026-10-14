import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/forms";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      description="A verified email helps keep your account safe."
      eyebrow="One more step"
      footer={
        <p>
          Ready to sign in? <Link href="/login">Return to sign in</Link>
        </p>
      }
      title="Verify your email."
    >
      <p className="body-copy">
        Enter the address you registered with and we&apos;ll send a fresh
        verification link if it needs one.
      </p>
      <Suspense fallback={<p className="loading-note">Loading…</p>}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
