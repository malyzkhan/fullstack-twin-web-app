import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";

export default function LoginPage() {
  return (
    <AuthShell
      description="Welcome back. Sign in to pick up where your story left off."
      eyebrow="Your next chapter"
      footer={
        <p>
          New to Twin? <Link href="/signup">Create an account</Link>
        </p>
      }
      title="Good to see you."
    >
      <Suspense fallback={<p className="loading-note">Preparing sign in…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
