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

## Deploying on Vercel

The root `proxy.ts` initializes Supabase for every application request, so the
app will return HTTP 500 on page routes if its public Supabase configuration is
missing or invalid. In Vercel, open **Project → Settings → Environment
Variables** and set both variables below for the environment being deployed:

- `NEXT_PUBLIC_SUPABASE_URL` — the Supabase project base URL, such as
  `https://<project-ref>.supabase.co`; do not include `/rest/v1/`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable key from that same
  Supabase project.

Vercel deployment URLs on a branch/preview deployment use the **Preview**
environment. Set these values for **Preview** as well as **Production** (or
select **All Environments** if the same Supabase project should serve both).
After changing either value, trigger a fresh deployment because `NEXT_PUBLIC_`
variables are included during the build. Never use a service-role key here.

Make sure the Supabase project referenced by the Vercel URL is the project
where the profile and Discover migrations were applied. A local `.env` or
`.env.local` does not configure Vercel. If the pages still return HTTP 500,
inspect **Vercel → Project → Logs** for the deployment; the error from
`proxy.ts` or Supabase Auth identifies whether configuration is missing,
malformed, or unable to reach the configured project.

## Auth routes

- `/signup` — email/password registration and social sign-in.
- `/login` — email/password and social sign-in.
- `/verify-email` — resend email verification.
- `/forgot-password` and `/reset-password` — password recovery.
- `/auth/callback` — server-side code/OTP exchange for OAuth and email links.
- `/home` — authenticated home; requires a verified email for email/password
  accounts.

## Dating profiles and settings

The dating profile is separate from Supabase Auth identity. Profile details,
private discovery preferences, account settings, blocks, and reports are stored
in their own tables. Passwords and session tokens are never copied into those
tables. Date of birth is private and public profile responses expose only a
calculated age. New profiles are not discoverable until their owner opts in;
age and profile photos are initially visible, and other optional profile fields
are private by default.

Before using profile editing or settings in a Supabase project:

1. Review and apply
   [`supabase/migrations/202610140001_twin_profiles.sql`](./supabase/migrations/202610140001_twin_profiles.sql)
   using the Supabase SQL Editor (or your normal migration workflow). It
   provisions the profile tables, RLS policies, interest catalog, private
   `profile-photos` Storage bucket, and signup trigger/backfill for existing
   auth users. Paste the SQL file's contents into the editor, not its filename.
   Because this migration creates database objects rather than returning query
   rows, Supabase showing **Success. No rows returned** is expected.
2. Confirm that the API schema exposes the tables by running this as a separate
   query:

   ```sql
   select table_name
   from information_schema.tables
   where table_schema = 'public'
     and table_name in (
       'profiles', 'profile_visibility', 'user_preferences', 'user_settings',
       'profile_photos', 'profile_interests', 'interests', 'blocked_users',
       'reports'
     )
   order by table_name;
   ```

   It should return nine rows. If SQL reports the objects exist but the app
   still reports a missing table, refresh the API schema cache:

   ```sql
   notify pgrst, 'reload schema';
   ```

3. Keep the `profile-photos` bucket private. The migration creates the bucket
   with a 5 MB limit and JPG, PNG, and WebP MIME types and installs owner and
   visibility-aware Storage policies. Do not make it public or remove those
   policies.
4. Optionally deploy secure account deletion from the repository root with
   `supabase functions deploy delete-account`. Keep JWT verification enabled.
   The Edge Function validates the signed-in user, removes their private
   profile-photo files, and uses the server-side Supabase service-role secret
   supplied to Edge Functions to delete that same Auth user. It never accepts
   a user ID from the browser. Account deletion stays unavailable until this
   function is deployed; no service-role key belongs in `.env.local` or the
   web app.

5. Apply
   [`supabase/migrations/202610150001_discover_profiles.sql`](./supabase/migrations/202610150001_discover_profiles.sql)
   after the profile migration. It adds the authenticated Discover feed RPC.
   The function returns only active, discoverable profiles, omits users blocked
   in either direction, and delegates field-level privacy to
   `get_public_profile`. Refresh the Supabase API schema cache after applying
   it if the app reports that the function is missing.

The authenticated app includes profile creation/editing, account settings,
public profile pages, and a paginated Discover listing. Users appear to others
only after they explicitly activate discoverability; each profile field,
including the six optional prompt answers, respects its visibility setting.
The settings UI saves notification preferences but does not yet deliver email
or push notifications.

## One-to-one text chat

Chat requests are sent from eligible public profiles. The recipient must accept
before a conversation is created. Messages are text-only, private to the two
members, limited to 2,000 characters, and paginated; Supabase Realtime notifies
the open conversation about new database messages. The inbox includes pending
incoming requests and accepted conversations. No matching, media attachments,
presence, or read receipts are included.

Before using chat in a Supabase project:

1. Apply
   [`supabase/migrations/202610150002_twin_chat.sql`](./supabase/migrations/202610150002_twin_chat.sql)
   after the profile and Discover migrations. Paste the full SQL file contents
   into the SQL Editor (not its filename). **Success. No rows returned** is
   expected. The migration creates the chat tables, indexes, row-level
   security policies, RPCs, and database-side validation/rate limits. Its
   table/index/policy/trigger setup tolerates a retry when this migration was
   previously run manually before Supabase recorded its migration version.
2. The migration adds `public.chat_messages` to the existing
   `supabase_realtime` publication when that publication is present. In
   **Database → Replication**, confirm `chat_messages` is listed for Realtime.
   If it is not, enable it there. No additional environment variables or
   Storage bucket are required for chat.
3. Apply
   [`supabase/migrations/202610150003_fix_chat_message_send.sql`](./supabase/migrations/202610150003_fix_chat_message_send.sql)
   to existing deployments. It fixes a PostgreSQL `42702` ambiguous-column
   failure in idempotent message inserts by targeting the named unique
   constraint directly. Paste only this migration's contents if applying it
   manually; do not rerun the full schema setup.
4. If the application reports that a chat RPC/table is missing after running
   the migration, refresh the Supabase API schema cache:

   ```sql
   notify pgrst, 'reload schema';
   ```

If a Supabase deployment reports `relation "chat_conversations" already
exists`, do not drop the chat tables or delete conversation data. This means
the database already has at least part of the chat schema while the migration
runner is trying to apply its migration. The migration can now be safely
retried for the schema created by this file. For a persistent project where
you already ran the full migration manually and verified all four chat tables,
record that version as applied instead of executing it again:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration repair 202610150002 --status applied --linked
```

Only mark the version applied if the entire migration succeeded previously;
otherwise, rerun the updated migration so it can finish installing missing
objects. Apply migration `202610150003` after the earlier migrations. In
Supabase Dashboard, find the project ref in the project URL or
Project Settings → General. Supabase Preview uses its own branch database and
must have the same migration history/schema consistency.

For a functional check, use two separate verified accounts whose profiles are
active and discoverable. From account A, open B’s public profile and send a
chat request. Confirm it appears in B’s `/chats` inbox; decline it and verify
that no conversation is created. Send a new request, accept it as B, then send
messages from each account and verify they appear live and remain after
refreshing. Also verify an unrelated third account cannot open that
conversation, and block the other participant from **Account Settings** to
confirm the conversation and its history become inaccessible. These checks
require the migration to be applied to the same Supabase project as the
application; they are not run by the local build.
