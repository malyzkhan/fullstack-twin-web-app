# Twin

Twin is a Next.js App Router application with Supabase Auth for email/password
accounts, Google, Discord, GitHub, email verification, and password recovery.

## Local development

1. Use Node.js 22 or later.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable
   key from the Supabase project’s **Connect** dialog. Use the base project URL,
   not a `/rest/v1/` URL.
3. Install dependencies with `pnpm install`.
4. Start the app with `pnpm dev`.

The application uses `@supabase/ssr` browser and cookie-backed server clients.
Next.js 16’s root `proxy.ts` refreshes Supabase sessions and handles initial
route screening. The `/home` page independently validates the user on the
server before showing authenticated content.

## Supabase dashboard setup

Complete these steps in the Supabase project before testing authentication:

1. Under **Authentication → Sign In / Providers**, enable **Email** and
   **Confirm email**. Set the minimum password length to at least 12 characters
   to match the app’s registration and reset validation.
2. Set the project **Site URL** to the deployed app origin. For local
   development, use `http://localhost:3000`; update it for production.
3. Add these application callback URLs to **Authentication → URL
   Configuration → Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://127.0.0.1:3000/auth/callback` (if you open the local app using
     `127.0.0.1` instead of `localhost`)
   - `https://YOUR_PRODUCTION_HOST/auth/callback` (replace with the real app
     hostname; do not include a trailing slash)
4. Under **Authentication → Sign In / Providers**, enable and configure Google,
   Discord, and GitHub. For each provider, copy the exact callback/redirect URI
   displayed by Supabase into that provider’s developer console. Do not use the
   application callback above as the provider callback unless Supabase itself
   displays that exact value.
5. Keep the default Supabase **Confirm signup** and **Reset password** email
   templates using `{{ .ConfirmationURL }}`. The app supplies its callback URL
   as the redirect destination and exchanges the returned code server-side.
6. Configure a production email delivery provider under **Project Settings →
   Authentication → SMTP Settings** (or the current email-provider settings
   shown in the project). Supabase’s default email service is rate-limited and
   intended for testing.
7. Publish reviewed Terms of Service and Privacy Policy pages before launch and
   link them from the account-creation consent. The app requires explicit
   acceptance; legal text and policy URLs must be supplied by Twin’s owner.

OAuth client secrets belong only in the Supabase provider settings. Never put
them in browser code or `NEXT_PUBLIC_` variables. The browser configuration
uses only `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Auth routes

- `/signup` — email/password registration and social sign-in.
- `/login` — email/password and social sign-in.
- `/verify-email` — resend email verification.
- `/forgot-password` and `/reset-password` — password recovery.
- `/auth/callback` — server-side code/OTP exchange for OAuth and email links.
- `/home` — authenticated home; requires a verified email for email/password
  accounts.

The app does not create a dating profile table or store passwords/auth tokens
in application tables. Supabase Auth is the identity source.
