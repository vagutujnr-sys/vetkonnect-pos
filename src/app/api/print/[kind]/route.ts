import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { writeAudit } from "@/server/audit";
import { sendEscPos } from "@/lib/print/escpos";

const paths: Record<string, { documentType: string; url: (id: string) => string; entity: string }> = {
  receipt: { documentType: "RECEIPT", url: (id) => `/receipts/${id}`, entity: "Sale" },
  prescription: { documentType: "PRESCRIPTION", url: (id) => `/prescriptions/${id}`, entity: "Prescription" },
  "vaccination-certificate": { documentType: "CERTIFICATE", url: (id) => `/certificates/${id}`, entity: "Patient" },
};

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session || session.role === "PLATFORM_ADMIN") return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { kind } = await context.params;
  const spec = paths[kind];
  if (!spec) return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  const body = (await request.json()) as { entityId?: string; reprint?: boolean };
  if (!body.entityId) return NextResponse.json({ error: "Missing document." }, { status: 400 });
  const client = supabaseAdmin();
  const { data: userData, error: userError } = await client.from("users").select("id,organization_id,branch_id,active")
    .eq("organization_id", session.organizationId).eq("id", session.id).maybeSingle();
  throwDatabaseError(userError);
  if (!userData) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = fromDatabase<{ id: string; organizationId: string; branchId: string; active: boolean }>(userData);
  const { data: organization, error: organizationError } = await client.from("organizations").select("id,status")
    .eq("id", user.organizationId).maybeSingle();
  throwDatabaseError(organizationError);
  if (!user.active || organization?.status !== "ACTIVE") return NextResponse.json({ error: "Practice access is inactive." }, { status: 403 });
  const { data: printerData, error: printerError } = await client.from("printer_configs").select("*")
    .eq("organization_id", user.organizationId).eq("branch_id", user.branchId)
    .eq("document_type", spec.documentType).eq("is_default", true).maybeSingle();
  throwDatabaseError(printerError);
  const printer = printerData ? fromDatabase<{ id: string; adapter: string; target: string | null }>(printerData) : null;
  await writeAudit({
    organizationId: user.organizationId,
    branchId: user.branchId,
    userId: user.id,
    action: body.reprint ? "REPRINT" : "PRINT",
    entity: spec.entity,
    entityId: body.entityId,
    details: { documentType: spec.documentType, adapter: printer?.adapter ?? "BROWSER" },
  });
  if (printer?.adapter === "ESCPOS") {
    const direct = await sendEscPos(printer.target);
    return NextResponse.json({
      mode: "browser",
      url: spec.url(body.entityId),
      message: direct.reason,
    });
  }
  return NextResponse.json({ mode: "browser", url: spec.url(body.entityId) });
}
