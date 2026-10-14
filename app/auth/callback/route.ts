import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const otpTypes = new Set<EmailOtpType>([
  "signup",
  "email",
  "email_change",
  "recovery",
]);

function callbackErrorDestination(next: string) {
  const page =
    next === "/reset-password"
      ? "/reset-password"
      : next === "/settings/security"
        ? "/settings/security"
        : "/login";
  const destination = new URL(page, "https://twin.invalid");
  destination.searchParams.set("error", "invalid-link");
  return `${destination.pathname}${destination.search}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const requestedNext = requestUrl.searchParams.get("next");
  const next =
    requestedNext === "/reset-password"
      ? requestedNext
      : getSafeRedirectPath(requestedNext);
  const errorParam = requestUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(callbackErrorDestination(next), request.url),
    );
  }

  const supabase = await createClient();
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(callbackErrorDestination(next), request.url),
      );
    }
  } else if (tokenHash && type && otpTypes.has(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(callbackErrorDestination(next), request.url),
      );
    }
  } else {
    return NextResponse.redirect(
      new URL(callbackErrorDestination(next), request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
