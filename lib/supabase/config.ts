export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to use authentication.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid project URL.");
  }

  if (
    !["https:", "http:"].includes(parsedUrl.protocol) ||
    (parsedUrl.protocol === "http:" &&
      !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) ||
    !["", "/"].includes(parsedUrl.pathname) ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be the project base URL, without a path, query, or fragment.",
    );
  }

  return { url: parsedUrl.origin, publishableKey };
}
