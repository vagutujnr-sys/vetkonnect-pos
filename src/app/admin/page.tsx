import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { lanAddresses } from "@/lib/network";

export default async function AdminHome() {
  const session = await getSession();
  if (!session) return null;
  const client = supabaseAdmin();
  const [patients, visits, sales, vaccines] = await Promise.all([
    client.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", session.organizationId),
    client.from("visits").select("id", { count: "exact", head: true }).eq("organization_id", session.organizationId).eq("status", "COMPLETED"),
    client.from("sales").select("id", { count: "exact", head: true }).eq("organization_id", session.organizationId),
    client.from("vaccinations").select("id", { count: "exact", head: true }).eq("organization_id", session.organizationId),
  ]);
  for (const result of [patients, visits, sales, vaccines]) throwDatabaseError(result.error);
  const ips = lanAddresses();
  return (
    <div>
      <h1>Overview</h1>
      <div className="stats">
        <div className="stat"><b>{patients.count ?? 0}</b><span>Patients</span></div>
        <div className="stat"><b>{visits.count ?? 0}</b><span>Consultations</span></div>
        <div className="stat"><b>{sales.count ?? 0}</b><span>Sales</span></div>
        <div className="stat"><b>{vaccines.count ?? 0}</b><span>Vaccinations</span></div>
      </div>
      <h2>LAN</h2>
      <div className="list">
        {ips.map((ip) => <div key={ip} className="row"><span>http://{ip}:3000</span></div>)}
      </div>
      <p><Link href="/home">Open the surgery app</Link></p>
    </div>
  );
}
