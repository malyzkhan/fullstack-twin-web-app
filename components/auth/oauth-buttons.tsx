"use client";

import { useState } from "react";
import { getCallbackUrl, getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "discord" | "github";

const providers: {
  id: OAuthProvider;
  label: string;
  icon: "google" | "discord" | "github";
}[] = [
  { id: "google", label: "Google", icon: "google" },
  { id: "discord", label: "Discord", icon: "discord" },
  { id: "github", label: "GitHub", icon: "github" },
];

function ProviderIcon({ icon }: { icon: "google" | "discord" | "github" }) {
  if (icon === "google") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
        <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
        <path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18l6.8-5.3Z" />
        <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.7 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z" />
      </svg>
    );
  }

  if (icon === "discord") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.7 5.2a18.7 18.7 0 0 0-4.6-1.4l-.6 1.3a17 17 0 0 0-5 0L8.9 3.8a18.7 18.7 0 0 0-4.6 1.4C1.4 9.4.6 13.5 1 17.6a18.8 18.8 0 0 0 5.7 2.9l1.2-2a12 12 0 0 1-1.9-.9l.5-.4a13.4 13.4 0 0 0 11 0l.5.4a12 12 0 0 1-1.9.9l1.2 2a18.8 18.8 0 0 0 5.7-2.9c.5-4.7-.8-8.8-3.3-12.4ZM8.4 15.6c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm7.2 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .8a11.2 11.2 0 0 0-3.5 21.8c.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.5-.3-5.2-1.3-5.2-5.6 0-1.2.4-2.1 1.1-2.9-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10.4 10.4 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.7 1.1 2.9 0 4.3-2.6 5.3-5.2 5.6.4.3.8 1 .8 2v3.4c0 .3.2.7.8.6A11.2 11.2 0 0 0 12 .8Z" />
    </svg>
  );
}

export function OAuthButtons({ next = "/home" }: { next?: string }) {
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  async function signIn(provider: OAuthProvider) {
    setBusyProvider(provider);
    setError("");
    try {
      const safeNext = getSafeRedirectPath(next);
      const { data, error: authError } = await createClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getCallbackUrl(window.location.origin, safeNext),
        },
      });

      if (authError || !data.url) {
        setError("We couldn’t connect to that provider. Please try again.");
        setBusyProvider(null);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("We couldn’t connect to that provider. Please try again.");
      setBusyProvider(null);
    }
  }

  return (
    <div className="social-group">
      <div className="divider-label">
        <span>or continue with</span>
      </div>
      <div className="social-buttons">
        {providers.map(({ id, label, icon }) => (
          <button
            aria-label={`Continue with ${label}`}
            className="social-button"
            disabled={busyProvider !== null}
            key={id}
            onClick={() => void signIn(id)}
            type="button"
          >
            <ProviderIcon icon={icon} />
            <span>{busyProvider === id ? "Connecting…" : label}</span>
          </button>
        ))}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
