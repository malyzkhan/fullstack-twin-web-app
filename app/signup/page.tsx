import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/forms";

export default function SignupPage() {
  return (
    <AuthShell
      description="Make room for a connection that feels like you."
      eyebrow="A good place to begin"
      footer={
        <p>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      }
      title="Meet Twin."
    >
      <Suspense fallback={<p className="loading-note">Preparing your account…</p>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
