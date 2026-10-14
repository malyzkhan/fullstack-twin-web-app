import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { getSupabaseConfig } from "@/lib/supabase/config";

const protectedPaths = ["/home", "/discover", "/chats", "/profile", "/settings"];
const guestOnlyPaths = ["/login", "/signup"];

function isPathWithin(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  if (error && error.name !== "AuthSessionMissingError") {
    throw error;
  }

  let destination: URL | null = null;
  if (isAuthenticated && isPathWithin(pathname, guestOnlyPaths)) {
    destination = new URL(
      getSafeRedirectPath(request.nextUrl.searchParams.get("next")),
      request.url,
    );
  } else if (!isAuthenticated && isPathWithin(pathname, protectedPaths)) {
    destination = new URL("/login", request.url);
    destination.searchParams.set(
      "next",
      getSafeRedirectPath(`${pathname}${request.nextUrl.search}`, "/home"),
    );
  }

  if (!destination) return response;

  const redirectResponse = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(name);
    if (value) redirectResponse.headers.set(name, value);
  }
  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
