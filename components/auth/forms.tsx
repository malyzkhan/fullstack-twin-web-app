"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { getCallbackUrl, getSafeRedirectPath } from "@/lib/auth/redirect";
import {
  validateEmail,
  validateFullName,
  validatePassword,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";
import { FieldError } from "./auth-shell";
import { OAuthButtons } from "./oauth-buttons";

type FieldErrors = Record<string, string>;

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className="password-control">
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          id={id}
          maxLength={128}
          onChange={(event) => onChange(event.target.value)}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <FieldError id={error ? errorId : undefined}>{error}</FieldError>
    </div>
  );
}

function EmailField({
  value,
  onChange,
  error,
  id = "email",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>Email address</label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="email"
        id={id}
        maxLength={254}
        onChange={(event) => onChange(event.target.value)}
        required
        type="email"
        value={value}
      />
      <FieldError id={error ? errorId : undefined}>{error}</FieldError>
    </div>
  );
}

function FormMessage({
  children,
  kind = "error",
}: {
  children?: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  if (!children) return null;
  return (
    <p
      className={`form-message form-message-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function ProviderErrorNotice() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  if (!error) return null;

  const message =
    error === "invalid-link"
      ? "That sign-in or verification link is invalid or has expired. Request a fresh link and try again."
      : "We couldn’t complete sign-in. Please try again.";
  return <FormMessage>{message}</FormMessage>;
}

function ResendVerificationForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      setMessage("");
      return;
    }
    if (cooldown > 0) return;

    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: getCallbackUrl(window.location.origin, "/home"),
        },
      });

      if (resendError) {
        setError("We couldn’t send a message right now. Please wait a moment and try again.");
        return;
      }

      setMessage(
        "If an account needs verification, a fresh link will arrive shortly. Check your inbox and spam folder.",
      );
      setCooldown(60);
    } catch {
      setError("We couldn’t send a message right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <EmailField
        error={error}
        onChange={(value) => {
          setEmail(value);
          setError("");
          setMessage("");
        }}
        value={email}
      />
      <FormMessage kind="success">{message}</FormMessage>
      <button className="button button-primary" disabled={busy || cooldown > 0} type="submit">
        {busy
          ? "Sending…"
          : cooldown > 0
            ? `Try again in ${cooldown}s`
            : "Resend verification email"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = getSafeRedirectPath(searchParams.get("next"));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    nextErrors.fullName = validateFullName(fullName);
    nextErrors.email = validateEmail(email);
    nextErrors.password = validatePassword(password);
    if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords do not match.";
    if (!acceptedTerms) nextErrors.terms = "Please accept the Terms and Privacy Policy.";
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: getCallbackUrl(window.location.origin, destination),
        },
      });
      if (error) {
        setFormError("We couldn’t create your account. Please check your details and try again.");
        return;
      }
      if (data.session) {
        router.replace(destination);
        router.refresh();
        return;
      }
      setVerificationEmail(email.trim());
    } catch {
      setFormError("We couldn’t create your account right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (verificationEmail) {
    return (
      <div className="verification-pending">
        <div aria-hidden="true" className="mail-mark">
          <span />
        </div>
        <h2>Check your inbox</h2>
        <p>
          If <strong>{verificationEmail}</strong> can be registered, we’ve sent a
          verification link. Open it to confirm your email and continue to Twin.
        </p>
        <ResendVerificationForm initialEmail={verificationEmail} />
        <p className="small-note">
          Already verified? <Link href="/login">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="full-name">Full name</label>
          <input
            aria-describedby={errors.fullName ? "full-name-error" : undefined}
            aria-invalid={Boolean(errors.fullName)}
            autoComplete="name"
            id="full-name"
            maxLength={80}
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
          <FieldError
            id={errors.fullName ? "full-name-error" : undefined}
          >
            {errors.fullName}
          </FieldError>
        </div>
        <EmailField
          error={errors.email}
          onChange={(value) => setEmail(value)}
          value={email}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.password}
          id="password"
          label="Password"
          onChange={setPassword}
          value={password}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.confirmPassword}
          id="confirm-password"
          label="Confirm password"
          onChange={setConfirmPassword}
          value={confirmPassword}
        />
        <div className="terms-field">
          <label className="checkbox-label" htmlFor="terms">
            <input
              aria-describedby={errors.terms ? "terms-error" : undefined}
              aria-invalid={Boolean(errors.terms)}
              checked={acceptedTerms}
              id="terms"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              type="checkbox"
            />
            <span>
              I agree to Twin&apos;s Terms of Service and Privacy Policy.
            </span>
          </label>
          <FieldError id={errors.terms ? "terms-error" : undefined}>
            {errors.terms}
          </FieldError>
        </div>
        <FormMessage>{formError}</FormMessage>
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
      <OAuthButtons next={destination} />
    </>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = getSafeRedirectPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    nextErrors.email = validateEmail(email);
    if (!password) nextErrors.password = "Enter your password.";
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError(
          error.code === "email_not_confirmed"
            ? "Please verify your email before signing in. You can request a new verification link."
            : "We couldn’t sign you in with those details. Check your email and password and try again.",
        );
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setFormError("We couldn’t sign you in right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ProviderErrorNotice />
      <form className="auth-form" onSubmit={submit} noValidate>
        <EmailField
          error={errors.email}
          onChange={setEmail}
          value={email}
        />
        <div className="field">
          <div className="field-topline">
            <label htmlFor="password">Password</label>
            <Link className="text-link" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <PasswordField
            autoComplete="current-password"
            error={errors.password}
            id="password"
            label=""
            onChange={setPassword}
            value={password}
          />
        </div>
        {formError ? (
          <div className="form-error-block">
            <FormMessage>{formError}</FormMessage>
            {formError.startsWith("Please verify") ? (
              <Link className="text-link" href="/verify-email">
                Resend verification email
              </Link>
            ) : null}
          </div>
        ) : null}
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <OAuthButtons next={destination} />
    </>
  );
}

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const hadCallbackError = searchParams.has("error");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: getCallbackUrl(window.location.origin, "/reset-password"),
        },
      );
      if (resetError) {
        setError("We couldn’t process that request right now. Please try again later.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("We couldn’t process that request right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="verification-pending">
        <div aria-hidden="true" className="mail-mark">
          <span />
        </div>
        <h2>Check your inbox</h2>
        <p>
          If an account exists for <strong>{email.trim()}</strong>, you&apos;ll
          receive a password reset link shortly.
        </p>
        <p className="small-note">
          The link may take a minute to arrive. Check your spam folder too.
        </p>
        <Link className="button button-secondary button-full" href="/login">
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      {hadCallbackError ? (
        <FormMessage>
          That recovery link is invalid or expired. You can request another below.
        </FormMessage>
      ) : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <EmailField
          error={error}
          onChange={(value) => setEmail(value)}
          value={email}
        />
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </>
  );
}

export function VerifyEmailForm() {
  return <ResendVerificationForm />;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.has("error");
  const [checking, setChecking] = useState(!callbackError);
  const [canReset, setCanReset] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (callbackError) return;
    let active = true;
    void createClient()
      .auth.getUser()
      .then(({ data, error }) => {
        if (!active) return;
        setCanReset(Boolean(data.user) && !error);
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        setFormError("We couldn’t validate the recovery session. Request a new reset link.");
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [callbackError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    nextErrors.password = validatePassword(password);
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setFormError("We couldn’t update your password. Request a new reset link and try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setFormError("We couldn’t update your password right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <p className="loading-note" role="status">Checking your recovery link…</p>;
  }

  if (success) {
    return (
      <div className="verification-pending">
        <div aria-hidden="true" className="success-mark">✓</div>
        <h2>Password updated</h2>
        <p>Your password has been changed. You can continue to your account.</p>
        <button
          className="button button-primary"
          onClick={() => {
            router.replace("/home");
            router.refresh();
          }}
          type="button"
        >
          Continue to Twin
        </button>
      </div>
    );
  }

  if (!canReset) {
    return (
      <div className="verification-pending">
        <FormMessage>
          {formError ||
            "This recovery link is invalid, expired, or already used. Request a new one to continue."}
        </FormMessage>
        <Link className="button button-primary button-full" href="/forgot-password">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <PasswordField
        autoComplete="new-password"
        error={errors.password}
        id="password"
        label="New password"
        onChange={setPassword}
        value={password}
      />
      <PasswordField
        autoComplete="new-password"
        error={errors.confirmPassword}
        id="confirm-password"
        label="Confirm new password"
        onChange={setConfirmPassword}
        value={confirmPassword}
      />
      <p className="small-note">Use at least 12 characters.</p>
      <FormMessage>{formError}</FormMessage>
      <button className="button button-primary" disabled={busy} type="submit">
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
