const AUTH_ROUTES = new Set([
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/home",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://twin.invalid");
    if (url.origin !== "https://twin.invalid" || AUTH_ROUTES.has(url.pathname)) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getCallbackUrl(origin: string, next: string) {
  const callbackUrl = new URL("/auth/callback", origin);
  const safeNext =
    next === "/reset-password" ? next : getSafeRedirectPath(next);
  callbackUrl.searchParams.set("next", safeNext);
  return callbackUrl.toString();
}
