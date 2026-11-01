import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getClinicSettings } from "@/lib/clinic";
import { IntegrationIdField } from "@/components/IntegrationIdField";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import {
  removeDemoAction,
  saveMedicationAction,
  savePrinterAction,
  saveProductAction,
  saveServiceAction,
  saveSettingsAction,
  saveSupplierAction,
  saveUserAction,
} from "@/server/actions";
import { checkSupabaseConnection } from "@/server/sync";
import { inventoryView } from "@/server/queries";

async function loadRows<T>(table: string, organizationId: string, order: string, limit = 50) {
  const { data, error } = await supabaseAdmin().from(table).select("*")
    .eq("organization_id", organizationId).order(order).limit(limit);
  throwDatabaseError(error);
  return fromDatabase<T[]>(data ?? []);
}

export default async function AdminSection({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const organizationId = session.organizationId;
  const client = supabaseAdmin();
  if (section === "patients") {
    const q = query.q ?? "";
    let patientQuery = client.from("patients").select("*").eq("organization_id", organizationId).order("name").limit(50);
    if (q) {
      const escaped = q.replace(/[\\%_,()]/g, "\\$&");
      patientQuery = patientQuery.or(`name.ilike.%${escaped}%,patient_number.ilike.%${escaped}%`);
    }
    const { data, error } = await patientQuery;
    throwDatabaseError(error);
    const patients = fromDatabase<{ id: string; patientNumber: string; name: string; ownerId: string; species: string; status: string }[]>(data ?? []);
    const ownerIds = [...new Set(patients.map((row) => row.ownerId))];
    const { data: ownerData, error: ownerError } = ownerIds.length
      ? await client.from("owners").select("id,full_name").eq("organization_id", organizationId).in("id", ownerIds)
      : { data: [], error: null };
    throwDatabaseError(ownerError);
    const owners = fromDatabase<{ id: string; fullName: string }[]>(ownerData ?? []);
    return (
      <div>
        <h1>Patients</h1>
        <form><input name="q" defaultValue={q} placeholder="Search" /></form>
        <Table heads={["Patient", "Owner", "Species", "Status"]} rows={patients.map((row) => [row.patientNumber + " " + row.name, owners.find((owner) => owner.id === row.ownerId)?.fullName ?? "—", row.species, row.status])} />
      </div>
    );
  }
  if (section === "consultations") {
    const rows = await loadRows<{ id: string; updatedAt: Date; patientId: string; presentingComplaint: string | null; status: string }>("visits", organizationId, "updated_at", 200);
    const completed = rows.filter((row) => row.status === "COMPLETED").slice(-50).reverse();
    const patientIds = [...new Set(completed.map((row) => row.patientId))];
    const { data, error } = patientIds.length
      ? await client.from("patients").select("id,name").eq("organization_id", organizationId).in("id", patientIds)
      : { data: [], error: null };
    throwDatabaseError(error);
    const patients = fromDatabase<{ id: string; name: string }[]>(data ?? []);
    return <div><h1>Consultations</h1><Table heads={["When", "Patient", "Complaint"]} rows={completed.map((row) => [formatDateTime(row.updatedAt), patients.find((patient) => patient.id === row.patientId)?.name ?? "—", row.presentingComplaint || "—"])} /></div>;
  }
  if (section === "sales") {
    const rows = await loadRows<{ receiptNumber: string; createdAt: Date; total: number; status: string }>("sales", organizationId, "created_at");
    return <div><h1>Sales</h1><Table heads={["Receipt", "When", "Total", "Status"]} rows={rows.map((row) => [row.receiptNumber, formatDateTime(row.createdAt), formatMoney(row.total), row.status])} /></div>;
  }
  if (section === "vaccinations") {
    const rows = await loadRows<{ id: string; administeredAt: Date; patientId: string; vaccineName: string; batchNumber: string | null }>("vaccinations", organizationId, "administered_at");
    const patientIds = [...new Set(rows.map((row) => row.patientId))];
    const { data, error } = patientIds.length ? await client.from("patients").select("id,name").eq("organization_id", organizationId).in("id", patientIds) : { data: [], error: null };
    throwDatabaseError(error);
    const patients = fromDatabase<{ id: string; name: string }[]>(data ?? []);
    return <div><h1>Vaccinations</h1><Table heads={["Date", "Patient", "Vaccine", "Batch"]} rows={rows.map((row) => [formatDate(row.administeredAt), patients.find((patient) => patient.id === row.patientId)?.name ?? "—", row.vaccineName, row.batchNumber || "—"])} /></div>;
  }
  if (section === "prescriptions") {
    const rows = await loadRows<{ number: string; patientId: string; createdAt: Date }>("prescriptions", organizationId, "created_at");
    const patientIds = [...new Set(rows.map((row) => row.patientId))];
    const { data, error } = patientIds.length ? await client.from("patients").select("id,name").eq("organization_id", organizationId).in("id", patientIds) : { data: [], error: null };
    throwDatabaseError(error);
    const patients = fromDatabase<{ id: string; name: string }[]>(data ?? []);
    return <div><h1>Prescriptions</h1><Table heads={["Number", "Patient", "Date"]} rows={rows.map((row) => [row.number, patients.find((patient) => patient.id === row.patientId)?.name ?? "—", formatDate(row.createdAt)])} /></div>;
  }
  if (section === "inventory") {
    const rows = await inventoryView("ALL", "ALL");
    return <div><h1>Inventory</h1><Table heads={["Item", "Batch", "Stock", "Status"]} rows={rows.map((row) => [row.name, row.batch || "—", String(row.stock), row.status])} /></div>;
  }
  if (section === "audit") {
    const rows = await loadRows<{ createdAt: Date; userId: string | null; action: string; entity: string }>("audit_logs", organizationId, "created_at", 80);
    const users = await loadRows<{ id: string; name: string }>("users", organizationId, "name", 500);
    return <div><h1>Audit log</h1><p className="sub">This history cannot be edited.</p><Table heads={["When", "User", "Action", "Entity"]} rows={rows.map((row) => [formatDateTime(row.createdAt), users.find((user) => user.id === row.userId)?.name || "—", row.action, row.entity])} /></div>;
  }
  if (section === "staff") {
    const users = await loadRows<{ id: string; name: string; role: string; active: boolean }>("users", organizationId, "name", 500);
    return (
      <div>
        <h1>Staff</h1>
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        <Table heads={["Name", "Role", "Active"]} rows={users.map((user) => [user.name, user.role, user.active ? "Yes" : "No"])} />
        <h2>Add staff</h2>
        <form action={saveUserAction}>
          <label className="field"><span>Name</span><input name="name" /></label>
          <label className="field"><span>Role</span><select name="role"><option value="VET">Veterinarian</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super Admin</option></select></label>
          <label className="field"><span>4-digit PIN</span><input name="pin" inputMode="numeric" maxLength={4} /></label>
          <label className="field"><span>Registration number</span><input name="registrationNumber" /></label>
          <label className="field"><span>Active</span><input name="active" type="checkbox" defaultChecked /></label>
          <button className="btn btn-primary" type="submit">Save staff</button>
        </form>
      </div>
    );
  }
  if (section === "settings") {
    const settings = await getClinicSettings();
    if (!settings) notFound();
    return (
      <div>
        <h1>Settings</h1>
        {query.saved ? <p className="banner ok">Saved.</p> : null}
        {query.cleared ? <p className="banner ok">Training clinical data removed. Staff accounts remain. Change the PINs.</p> : null}
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        <form action={saveSettingsAction}>
          <IntegrationIdField integrationId={settings.integrationId} />
          <label className="field"><span>Clinic name</span><input name="clinicName" defaultValue={settings.clinicName} /></label>
          <label className="field"><span>Tagline</span><input name="tagline" defaultValue={settings.tagline} /></label>
          <label className="field"><span>Address</span><input name="address" defaultValue={settings.address} /></label>
          <div className="grid-2">
            <label className="field"><span>Phone</span><input name="phone" defaultValue={settings.phone} /></label>
            <label className="field"><span>Email</span><input name="email" defaultValue={settings.email} /></label>
          </div>
          <div className="grid-2">
            <label className="field"><span>Currency symbol</span><input name="currencySymbol" defaultValue={settings.currencySymbol} /></label>
            <label className="field"><span>Lock after minutes</span><input name="lockTimeoutMinutes" defaultValue={settings.lockTimeoutMinutes} /></label>
          </div>
          <label className="field"><span>Receipt footer</span><textarea name="receiptFooter" defaultValue={settings.receiptFooter ?? ""} /></label>
          <button className="btn btn-primary" type="submit">Save settings</button>
        </form>
        <form action={removeDemoAction} style={{ marginTop: 20 }}>
          <button className="btn btn-danger" type="submit">Remove training data</button>
          <p className="sub">Removes training owners, patients, medicines, products, services and their stock. Staff stay.</p>
        </form>
      </div>
    );
  }
  if (section === "printers") {
    const printers = await loadRows<{ id: string; documentType: string; name: string; adapter: string; target: string | null }>("printer_configs", organizationId, "document_type", 100);
    return (
      <div>
        <h1>Printers</h1>
        {query.saved ? <p className="banner ok">Saved.</p> : null}
        {printers.map((printer) => (
          <form key={printer.id} action={savePrinterAction} className="list" style={{ padding: 12, marginBottom: 10 }}>
            <input type="hidden" name="documentType" value={printer.documentType} />
            <strong>{printer.documentType}</strong>
            <label className="field"><span>Name</span><input name="name" defaultValue={printer.name} /></label>
            <label className="field"><span>Adapter</span>
              <select name="adapter" defaultValue={printer.adapter}><option value="BROWSER">Browser / system print</option><option value="ESCPOS">ESC/POS</option></select>
            </label>
            <label className="field"><span>Target</span><input name="target" defaultValue={printer.target ?? ""} placeholder="Printer name or IP" /></label>
            <button className="btn" type="submit">Save</button>
          </form>
        ))}
      </div>
    );
  }
  if (section === "sync") {
    const connection = await checkSupabaseConnection();
    return (
      <div>
        <h1>Sync</h1>
        <p>{connection.message}</p>
        <p>Connection: {connection.connected ? "Connected" : "Unavailable"}</p>
        <p>Offline POS caching has not been enabled yet.</p>
      </div>
    );
  }
  if (section === "backups") {
    return (
      <div>
        <h1>Backups</h1>
        <p>Manage database backups from the Supabase Dashboard.</p>
      </div>
    );
  }
  if (section === "services") {
    const services = await loadRows<{ name: string; category: string; price: number; active: boolean }>("services", organizationId, "name", 500);
    const meds = await loadRows<{ id: string; name: string }>("medications", organizationId, "name", 500);
    return (
      <div>
        <h1>Services</h1>
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        <Table heads={["Service", "Category", "Price", "Active"]} rows={services.map((row) => [row.name, row.category, formatMoney(row.price), row.active ? "Yes" : "No"])} />
        <h2>Add service</h2>
        <form action={saveServiceAction}>
          <label className="field"><span>Name</span><input name="name" /></label>
          <label className="field"><span>Category</span><input name="category" /></label>
          <label className="field"><span>Price</span><input name="price" /></label>
          <label className="field"><span>Duration minutes</span><input name="durationMinutes" /></label>
          <label className="field"><span>Suggested medicine</span><select name="medicationId"><option value="">None</option>{meds.map((med) => <option key={med.id} value={med.id}>{med.name}</option>)}</select></label>
          <label className="field"><span>Active</span><input type="checkbox" name="active" defaultChecked /></label>
          <button className="btn btn-primary" type="submit">Save service</button>
        </form>
      </div>
    );
  }
  if (section === "products") {
    const suppliers = await loadRows<{ id: string; name: string }>("suppliers", organizationId, "name", 500);
    return (
      <div>
        <h1>Feed and accessories</h1>
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        <form action={saveProductAction}>
          <label className="field"><span>SKU</span><input name="sku" /></label>
          <label className="field"><span>Barcode</span><input name="barcode" /></label>
          <label className="field"><span>Name</span><input name="name" /></label>
          <label className="field"><span>Brand</span><input name="brand" /></label>
          <label className="field"><span>Category</span><select name="category">{PRODUCT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field"><span>Cost</span><input name="costPrice" /></label>
          <label className="field"><span>Price</span><input name="sellingPrice" /></label>
          <label className="field"><span>Reorder level</span><input name="reorderLevel" /></label>
          <label className="field"><span>Supplier</span><select name="supplierId"><option value="">None</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Active</span><input type="checkbox" name="active" defaultChecked /></label>
          <button className="btn btn-primary" type="submit">Save product</button>
        </form>
      </div>
    );
  }
  if (section === "pharmacy") {
    const meds = await loadRows<{ name: string; sellingPrice: number; reorderLevel: number }>("medications", organizationId, "name", 500);
    return (
      <div>
        <h1>Pharmacy catalogue</h1>
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        <Table heads={["Medicine", "Price", "Reorder"]} rows={meds.map((row) => [row.name, formatMoney(row.sellingPrice), String(row.reorderLevel)])} />
        <h2>Add medicine</h2>
        <form action={saveMedicationAction}>
          <label className="field"><span>Name</span><input name="name" /></label>
          <label className="field"><span>Generic name</span><input name="genericName" /></label>
          <label className="field"><span>Category</span><input name="category" /></label>
          <label className="field"><span>Strength</span><input name="strength" /></label>
          <label className="field"><span>Unit</span><input name="unit" defaultValue="dose" /></label>
          <label className="field"><span>Cost</span><input name="costPrice" /></label>
          <label className="field"><span>Price</span><input name="sellingPrice" /></label>
          <label className="field"><span>Reorder</span><input name="reorderLevel" /></label>
          <label className="field"><span>Prescription required</span><input type="checkbox" name="prescriptionRequired" /></label>
          <label className="field"><span>Active</span><input type="checkbox" name="active" defaultChecked /></label>
          <button className="btn btn-primary" type="submit">Save medicine</button>
        </form>
      </div>
    );
  }
  if (section === "suppliers") {
    const suppliers = await loadRows<{ name: string; phone: string | null; email: string | null }>("suppliers", organizationId, "name", 500);
    return (
      <div>
        <h1>Suppliers</h1>
        <Table heads={["Name", "Phone", "Email"]} rows={suppliers.map((row) => [row.name, row.phone || "—", row.email || "—"])} />
        <form action={saveSupplierAction}>
          <h2>Add supplier</h2>
          <label className="field"><span>Name</span><input name="name" /></label>
          <label className="field"><span>Contact</span><input name="contact" /></label>
          <label className="field"><span>Phone</span><input name="phone" /></label>
          <label className="field"><span>Email</span><input name="email" /></label>
          <label className="field"><span>Address</span><input name="address" /></label>
          <label className="field"><span>Notes</span><textarea name="notes" /></label>
          <button className="btn btn-primary" type="submit">Save supplier</button>
        </form>
      </div>
    );
  }
  notFound();
}

function Table({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
