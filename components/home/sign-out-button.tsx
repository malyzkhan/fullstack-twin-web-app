"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) {
        setError("We couldn’t sign you out. Please try again.");
        setBusy(false);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("We couldn’t sign you out right now. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="signout-wrap">
      <button
        className="button button-secondary"
        disabled={busy}
        onClick={() => void signOut()}
        type="button"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
