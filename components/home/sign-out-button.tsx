"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ menuItem = false }: { menuItem?: boolean }) {
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
    <div className={menuItem ? "signout-wrap signout-menu-item" : "signout-wrap"}>
      <button
        className={menuItem ? "profile-menu-item profile-menu-logout" : "button button-secondary"}
        disabled={busy}
        onClick={() => void signOut()}
        type="button"
      >
        {busy ? "Signing out…" : "Logout"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
