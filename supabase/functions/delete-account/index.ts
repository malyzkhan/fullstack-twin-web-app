import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return respond(405, "Method not allowed.");

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, "Authentication required.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return respond(503, "Account deletion is not configured.");
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return respond(401, "Your session is invalid or expired.");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const storage = admin.storage.from("profile-photos");
  let batches = 0;
  while (true) {
    batches += 1;
    if (batches > 100) return respond(500, "Too many stored photos to delete safely in one request.");
    const { data: files, error: listError } = await storage.list(auth.user.id, {
      limit: 1000,
      offset: 0,
    });
    if (listError) return respond(500, "Could not prepare account data for deletion.");
    if (!files.length) break;

    const paths = files
      .filter((file) => file.name && file.name !== ".emptyFolderPlaceholder")
      .map((file) => `${auth.user.id}/${file.name}`);
    if (!paths.length) return respond(500, "Could not identify stored profile photos.");
    if (paths.length) {
      const { error: removeError } = await storage.remove(paths);
      if (removeError) return respond(500, "Could not remove all profile photos.");
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);
  if (deleteError) return respond(500, "Could not delete the Twin account.");
  return new Response(null, { status: 204, headers: corsHeaders });
});
