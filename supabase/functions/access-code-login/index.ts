import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function db() {
  const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    k.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

Deno.serve(async (r) => {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  if (r.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: H });
  }

  try {
    const { accessCode, deviceId, deviceName } = await r.json();
    if (!accessCode) {
      return Response.json({ error: "accessCode required" }, { status: 400, headers: H });
    }

    const c = db();
    const now = new Date().toISOString();
    const h = hash(String(accessCode).trim().toUpperCase());

    const { data: a } = await c
      .from("subscription_access_codes")
      .select("*")
      .eq("code_hash", h)
      .eq("status", "active")
      .maybeSingle();

    if (!a || new Date(a.starts_at) > new Date() || (a.expires_at && a.expires_at <= now)) {
      return Response.json({ error: "invalid_or_expired_code" }, { status: 403, headers: H });
    }

    // Device limits are intentionally disabled. The access code itself is the
    // entitlement credential, so an authorized purchaser can recover access
    // after changing/reinstalling devices without being blocked by a stale
    // subscription_devices row.
    //
    // Keep accepting deviceId/deviceName for backwards compatibility with
    // existing clients, but do not create/count/enforce device records.

    return Response.json({
      ok: true,
      externalCustomerId: a.external_customer_id,
      email: a.account_email,
      startsAt: a.starts_at,
      expiresAt: a.expires_at,
    }, { headers: H });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "access_code_login_failed" }, { status: 500, headers: H });
  }
});