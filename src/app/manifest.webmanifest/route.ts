import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export async function GET() {
  const requestHeaders = await headers();
  const practiceCode = requestHeaders.get("x-practice-code")
    ?? (await getSession())?.organizationSlug
    ?? null;

  let name = "VetKonnect P.O.S & Management";
  let startUrl = "/sign-in";
  let scope = "/";

  if (practiceCode) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(practiceCode)) {
      return new Response("Invalid practice URL.", { status: 400 });
    }
    const { data, error } = await supabaseAdmin()
      .from("organizations")
      .select("name")
      .eq("slug", practiceCode)
      .maybeSingle();
    throwDatabaseError(error);
    if (!data) return new Response("Practice not found.", { status: 404 });
    name = fromDatabase<{ name: string }>(data).name;
    startUrl = `/practice/${practiceCode}/pos`;
    scope = `/practice/${practiceCode}/`;
  }

  return Response.json({
    id: startUrl,
    name: `${name} · VetKonnect POS`,
    short_name: name.slice(0, 12),
    description: `VetKonnect point of sale and practice management for ${name}.`,
    start_url: startUrl,
    scope,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#f4f1ea",
    theme_color: "#143d26",
    orientation: "any",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
