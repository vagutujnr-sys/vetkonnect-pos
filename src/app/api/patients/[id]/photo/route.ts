import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { dataRoot } from "@/lib/files";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "PLATFORM_ADMIN") return new NextResponse("Sign in required", { status: 401 });
  const client = supabaseAdmin();
  const { data: userData, error: userError } = await client.from("users").select("active")
    .eq("organization_id", session.organizationId).eq("id", session.id).maybeSingle();
  throwDatabaseError(userError);
  const user = userData ? fromDatabase<{ active: boolean }>(userData) : null;
  const { data: organization, error: organizationError } = await client.from("organizations").select("status")
    .eq("id", session.organizationId).maybeSingle();
  throwDatabaseError(organizationError);
  if (!user?.active || organization?.status !== "ACTIVE") return new NextResponse("Practice access is inactive", { status: 403 });
  const { id } = await context.params;
  const { data: patientData, error: patientError } = await client.from("patients").select("photo_path")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(patientError);
  const patient = patientData ? fromDatabase<{ photoPath: string | null }>(patientData) : null;
  if (!patient?.photoPath) return new NextResponse("No photo", { status: 404 });
  const file = path.join(dataRoot, patient.photoPath);
  if (!file.startsWith(dataRoot) || !fs.existsSync(file)) return new NextResponse("No photo", { status: 404 });
  const ext = path.extname(file).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(fs.readFileSync(file), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
}
