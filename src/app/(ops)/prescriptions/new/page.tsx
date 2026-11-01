import { notFound, redirect } from "next/navigation";
import { PrescriptionForm } from "@/components/PrescriptionForm";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export default async function NewPrescriptionPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const session = await getSession();
  if (session?.role === "ADMIN") redirect("/home");
  const { patientId } = await searchParams;
  if (!patientId) redirect("/patients");
  const { data, error } = await supabaseAdmin().from("patients").select("id,name,owner_id")
    .eq("organization_id", session?.organizationId ?? "").eq("id", patientId).maybeSingle();
  throwDatabaseError(error);
  if (!data || !session) notFound();
  const patient = fromDatabase<{ id: string; name: string; ownerId: string }>(data);
  const { data: ownerData, error: ownerError } = await supabaseAdmin().from("owners").select("full_name")
    .eq("organization_id", session.organizationId).eq("id", patient.ownerId).maybeSingle();
  throwDatabaseError(ownerError);
  if (!ownerData) notFound();
  return <PrescriptionForm patientId={patient.id} patientName={`${patient.name} · ${ownerData.full_name}`} />;
}
