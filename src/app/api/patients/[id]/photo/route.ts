import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { downloadPatientPhoto } from "@/lib/supabase-storage";

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
  const expectedPrefix = `${session.organizationId}/${id}/`;
  if (!patient?.photoPath || !patient.photoPath.startsWith(expectedPrefix)) {
    return new NextResponse("No photo", { status: 404 });
  }
  const { data, error } = await downloadPatientPhoto(patient.photoPath);
  if (error) {
    if (error.statusCode === "404") return new NextResponse("No photo", { status: 404 });
    throw new Error(`Could not load patient photo: ${error.message}`);
  }
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
