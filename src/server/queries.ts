import { endOfDay, isExpired, isExpiringSoon, startOfDay } from "@/lib/dates";
import { productGroup } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { movementTotals, sumQty } from "./stock";

export async function searchPatients(q: string) {
  const query = q.trim();
  const organizationId = (await getSession())?.organizationId;
  if (!organizationId) return [];
  const client = supabaseAdmin();
  let patientIds: string[] | null = null;
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const [nameRows, numberRows, microchipRows, ownerRows] = await Promise.all([
      client.from("patients").select("id").eq("organization_id", organizationId).ilike("name", pattern),
      client.from("patients").select("id").eq("organization_id", organizationId).ilike("patient_number", pattern),
      client.from("patients").select("id").eq("organization_id", organizationId).ilike("microchip", pattern),
      Promise.all([
        client.from("owners").select("id").eq("organization_id", organizationId).ilike("full_name", pattern),
        client.from("owners").select("id").eq("organization_id", organizationId).ilike("mobile", pattern),
        client.from("owners").select("id").eq("organization_id", organizationId).ilike("alt_mobile", pattern),
      ]),
    ]);
    for (const result of [nameRows, numberRows, microchipRows, ...ownerRows]) throwDatabaseError(result.error);
    const ownerIds = [...new Set(ownerRows.flatMap((result) => ((result.data ?? []) as { id: string }[]).map((row) => row.id)))];
    let ownerPatientIds: string[] = [];
    if (ownerIds.length) {
      const { data, error } = await client.from("patients").select("id").eq("organization_id", organizationId).in("owner_id", ownerIds);
      throwDatabaseError(error);
      ownerPatientIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
    }
    const directPatientIds = [
      ...((nameRows.data ?? []) as { id: string }[]),
      ...((numberRows.data ?? []) as { id: string }[]),
      ...((microchipRows.data ?? []) as { id: string }[]),
    ].map((row) => row.id);
    patientIds = [...new Set([...directPatientIds, ...ownerPatientIds])];
    if (!patientIds.length) return [];
  }
  let patientsQuery = client.from("patients").select("*,owner:owners(*)").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(40);
  if (patientIds) patientsQuery = patientsQuery.in("id", patientIds);
  const { data, error } = await patientsQuery;
  throwDatabaseError(error);
  return fromDatabase<{
    id: string;
    name: string;
    status: string;
    breed: string | null;
    species: string;
    sex: string;
    dob: Date | null;
    estimatedAge: string | null;
    patientNumber: string;
    owner: { fullName: string; mobile: string };
  }[]>(data ?? []);
}

export async function searchOwners(q: string) {
  const query = q.trim();
  const organizationId = (await getSession())?.organizationId;
  if (!organizationId) return [];
  const client = supabaseAdmin();
  let ownerIds: string[] | null = null;
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const results = await Promise.all([
      client.from("owners").select("id").eq("organization_id", organizationId).ilike("full_name", pattern),
      client.from("owners").select("id").eq("organization_id", organizationId).ilike("mobile", pattern),
      client.from("owners").select("id").eq("organization_id", organizationId).ilike("alt_mobile", pattern),
    ]);
    for (const result of results) throwDatabaseError(result.error);
    ownerIds = [...new Set(results.flatMap((result) => ((result.data ?? []) as { id: string }[]).map((row) => row.id)))];
    if (!ownerIds.length) return [];
  }
  let ownersQuery = client.from("owners").select("*").eq("organization_id", organizationId).order("full_name").limit(40);
  if (ownerIds) ownersQuery = ownersQuery.in("id", ownerIds);
  const { data, error } = await ownersQuery;
  throwDatabaseError(error);
  const owners = fromDatabase<{ id: string; fullName: string; mobile: string }[]>(data ?? []);
  if (!owners.length) return [];
  const { data: patientRows, error: patientError } = await client
    .from("patients")
    .select("owner_id")
    .eq("organization_id", organizationId)
    .in("owner_id", owners.map((owner) => owner.id));
  throwDatabaseError(patientError);
  const counts = new Map<string, number>();
  for (const row of patientRows ?? []) {
    const ownerId = (row as { owner_id: string }).owner_id;
    counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
  }
  return owners.map((owner) => ({ ...owner, _count: { patients: counts.get(owner.id) ?? 0 } }));
}

export async function homeSnapshot() {
  const from = startOfDay();
  const to = endOfDay();
  const session = await getSession();
  if (!session) return { patients: 0, vaccinations: 0, sales: 0, attention: [] };
  const client = supabaseAdmin();
  const [visitResult, vaccinationResult, salesResult, medicationResult, batchResult, totals] = await Promise.all([
    client.from("visits").select("patient_id").eq("organization_id", session.organizationId)
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()).neq("status", "CANCELLED"),
    client.from("vaccinations").select("id", { count: "exact", head: true }).eq("organization_id", session.organizationId)
      .gte("administered_at", from.toISOString()).lte("administered_at", to.toISOString()).eq("administered_elsewhere", false),
    client.from("sales").select("total").eq("organization_id", session.organizationId)
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString()).eq("status", "COMPLETED"),
    client.from("medications").select("*").eq("organization_id", session.organizationId).eq("active", true),
    client.from("medication_batches").select("*").eq("organization_id", session.organizationId),
    movementTotals(),
  ]);
  for (const result of [visitResult, vaccinationResult, salesResult, medicationResult, batchResult]) throwDatabaseError(result.error);
  const visits = fromDatabase<{ patientId: string }[]>(visitResult.data ?? []);
  const medications = fromDatabase<{ id: string; name: string; unit: string; reorderLevel: number }[]>(medicationResult.data ?? []);
  const batches = fromDatabase<{ id: string; medicationId: string; expiryDate: Date }[]>(batchResult.data ?? []);
  const salesTotal = ((salesResult.data ?? []) as { total: number }[]).reduce((sum, row) => sum + row.total, 0);
  const attention: { title: string; detail: string; tone: "warn" | "danger" }[] = [];
  for (const medication of medications) {
    const onHand = sumQty(totals, "MEDICATION", medication.id);
    const medBatches = batches.filter((batch) => batch.medicationId === medication.id);
    const expired = medBatches.filter((batch) => sumQty(totals, "MEDICATION", medication.id, batch.id) > 0 && isExpired(batch.expiryDate));
    const expiring = medBatches.filter(
      (batch) => sumQty(totals, "MEDICATION", medication.id, batch.id) > 0 && isExpiringSoon(batch.expiryDate, 60),
    );
    if (onHand <= 0) {
      attention.push({ title: medication.name, detail: "Out of stock", tone: "danger" });
    } else if (onHand <= medication.reorderLevel) {
      attention.push({
        title: medication.name,
        detail: `${onHand} ${medication.unit}${onHand === 1 ? "" : "s"} remaining`,
        tone: "warn",
      });
    }
    if (expired.length) {
      attention.push({ title: medication.name, detail: "Expired batch on the shelf", tone: "danger" });
    } else if (expiring.length) {
      attention.push({ title: medication.name, detail: "Expires soon", tone: "warn" });
    }
  }
  return {
    patients: new Set(visits.map((visit) => visit.patientId)).size,
    vaccinations: vaccinationResult.count ?? 0,
    sales: salesTotal,
    attention: attention.slice(0, 6),
  };
}

export async function medicationCatalog() {
  const session = await getSession();
  if (!session) return [];
  const [medicationResult, totals] = await Promise.all([
    supabaseAdmin().from("medications").select("*,medication_batches(*)")
      .eq("organization_id", session.organizationId).eq("active", true).order("name"),
    movementTotals(),
  ]);
  throwDatabaseError(medicationResult.error);
  const medications = fromDatabase<{
    id: string;
    name: string;
    genericName: string | null;
    category: string;
    unit: string;
    strength: string | null;
    sellingPrice: number;
    reorderLevel: number;
    costPrice: number;
    medicationBatches: { id: string; batchNumber: string; expiryDate: Date; receivedAt: Date; supplierId: string | null; costPrice: number | null }[];
  }[]>(medicationResult.data ?? []);
  return medications.map((medication) => {
    const batches = medication.medicationBatches.map((batch) => ({
      ...batch,
      onHand: sumQty(totals, "MEDICATION", medication.id, batch.id),
    }));
    return {
      ...medication,
      onHand: sumQty(totals, "MEDICATION", medication.id),
      batches,
    };
  });
}

export async function inventoryView(kind: string, status: string) {
  const session = await getSession();
  if (!session) return [];
  const [medicationResult, productResult, totals] = await Promise.all([
    supabaseAdmin().from("medications").select("*,medication_batches(*)")
      .eq("organization_id", session.organizationId).order("name"),
    supabaseAdmin().from("products").select("*").eq("organization_id", session.organizationId).order("name"),
    movementTotals(),
  ]);
  throwDatabaseError(medicationResult.error);
  throwDatabaseError(productResult.error);
  const medications = fromDatabase<{
    id: string; name: string; category: string; reorderLevel: number; costPrice: number; sellingPrice: number; unit: string;
    medicationBatches: { id: string; batchNumber: string; expiryDate: Date }[];
  }[]>(medicationResult.data ?? []);
  const products = fromDatabase<{
    id: string; name: string; category: string; reorderLevel: number; costPrice: number; sellingPrice: number;
  }[]>(productResult.data ?? []);
  type Row = {
    key: string;
    kind: "MEDICATION" | "FEED" | "ACCESSORIES";
    name: string;
    category: string;
    batch?: string;
    batchId?: string;
    itemId: string;
    expiry?: Date | null;
    stock: number;
    reorder: number;
    cost: number;
    price: number;
    unit: string;
    status: string;
  };
  const rows: Row[] = [];
  for (const medication of medications) {
    const batches = medication.medicationBatches.length ? medication.medicationBatches : [null];
    for (const batch of batches) {
      const stock = batch
        ? sumQty(totals, "MEDICATION", medication.id, batch.id)
        : sumQty(totals, "MEDICATION", medication.id);
      let rowStatus = "IN STOCK";
      if (batch && isExpired(batch.expiryDate) && stock > 0) rowStatus = "EXPIRED";
      else if (stock <= 0) rowStatus = "OUT";
      else if (batch && isExpiringSoon(batch.expiryDate, 90)) rowStatus = "EXPIRING";
      else if (stock <= medication.reorderLevel) rowStatus = "LOW";
      rows.push({
        key: `${medication.id}-${batch?.id ?? "all"}`,
        kind: "MEDICATION",
        name: medication.name,
        category: medication.category,
        batch: batch?.batchNumber,
        batchId: batch?.id,
        itemId: medication.id,
        expiry: batch?.expiryDate,
        stock,
        reorder: medication.reorderLevel,
        cost: medication.costPrice,
        price: medication.sellingPrice,
        unit: medication.unit,
        status: rowStatus,
      });
    }
  }
  for (const product of products) {
    const stock = sumQty(totals, "PRODUCT", product.id, null);
    const group = productGroup(product.category) === "FEED" ? "FEED" : "ACCESSORIES";
    let rowStatus = "IN STOCK";
    if (stock <= 0) rowStatus = "OUT";
    else if (stock <= product.reorderLevel) rowStatus = "LOW";
    rows.push({
      key: product.id,
      kind: group,
      name: product.name,
      category: product.category,
      itemId: product.id,
      stock,
      reorder: product.reorderLevel,
      cost: product.costPrice,
      price: product.sellingPrice,
      unit: "each",
      status: rowStatus,
    });
  }
  return rows.filter((row) => {
    if (kind && kind !== "ALL" && row.kind !== kind) return false;
    if (status && status !== "ALL" && row.status !== status) return false;
    return true;
  });
}

export async function reportData(type: string, from: Date, to: Date) {
  const session = await getSession();
  if (!session) return [];
  const client = supabaseAdmin();
  const organizationId = session.organizationId;
  const start = from.toISOString();
  const end = to.toISOString();
  if (type === "staff") {
    const [salesResult, usersResult] = await Promise.all([
      client.from("sales").select("staff_id,total").eq("organization_id", organizationId)
        .gte("created_at", start).lte("created_at", end).eq("status", "COMPLETED"),
      client.from("users").select("id,name").eq("organization_id", organizationId),
    ]);
    throwDatabaseError(salesResult.error);
    throwDatabaseError(usersResult.error);
    const sales = fromDatabase<{ staffId: string; total: number }[]>(salesResult.data ?? []);
    const users = fromDatabase<{ id: string; name: string }[]>(usersResult.data ?? []);
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const sale of sales) {
      const name = users.find((user) => user.id === sale.staffId)?.name ?? "Staff";
      const row = map.get(sale.staffId) ?? { name, count: 0, total: 0 };
      row.count += 1;
      row.total += sale.total;
      map.set(sale.staffId, row);
    }
    return [...map.values()];
  }
  if (type === "service") {
    const { data: sales, error: salesError } = await client.from("sales").select("id")
      .eq("organization_id", organizationId).eq("status", "COMPLETED")
      .gte("created_at", start).lte("created_at", end);
    throwDatabaseError(salesError);
    const saleIds = (sales ?? []).map((sale) => sale.id);
    if (!saleIds.length) return [];
    const { data, error } = await client.from("sale_items").select("name,quantity,line_total")
      .eq("organization_id", organizationId).eq("item_type", "SERVICE").in("sale_id", saleIds);
    throwDatabaseError(error);
    const items = fromDatabase<{ name: string; quantity: number; lineTotal: number }[]>(data ?? []);
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const item of items) {
      const row = map.get(item.name) ?? { name: item.name, count: 0, total: 0 };
      row.count += item.quantity;
      row.total += item.lineTotal;
      map.set(item.name, row);
    }
    return [...map.values()];
  }
  if (type === "payments") {
    const { data: sales, error: salesError } = await client.from("sales").select("id")
      .eq("organization_id", organizationId).eq("status", "COMPLETED")
      .gte("created_at", start).lte("created_at", end);
    throwDatabaseError(salesError);
    const saleIds = (sales ?? []).map((sale) => sale.id);
    if (!saleIds.length) return [];
    const { data, error } = await client.from("payments").select("method,amount")
      .eq("organization_id", organizationId).in("sale_id", saleIds);
    throwDatabaseError(error);
    const payments = fromDatabase<{ method: string; amount: number }[]>(data ?? []);
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const payment of payments) {
      const row = map.get(payment.method) ?? { name: payment.method, count: 0, total: 0 };
      row.count += 1;
      row.total += payment.amount;
      map.set(payment.method, row);
    }
    return [...map.values()];
  }
  if (type === "consultations") {
    const { data, error } = await client.from("visits").select("*,patient:patients(*,owner:owners(*))")
      .eq("organization_id", organizationId).eq("status", "COMPLETED")
      .gte("updated_at", start).lte("updated_at", end).order("updated_at", { ascending: false });
    throwDatabaseError(error);
    return fromDatabase(data ?? []);
  }
  if (type === "vaccinations") {
    const { data, error } = await client.from("vaccinations").select("*,patient:patients(*)")
      .eq("organization_id", organizationId).gte("administered_at", start).lte("administered_at", end)
      .order("administered_at", { ascending: false });
    throwDatabaseError(error);
    return fromDatabase(data ?? []);
  }
  if (type === "usage") {
    const { data, error } = await client.from("stock_movements").select("*")
      .eq("organization_id", organizationId).gte("created_at", start).lte("created_at", end)
      .in("movement_type", ["DISPENSED", "SOLD"]).eq("item_type", "MEDICATION")
      .order("created_at", { ascending: false });
    throwDatabaseError(error);
    return fromDatabase(data ?? []);
  }
  if (type === "adjustments") {
    const { data, error } = await client.from("stock_movements").select("*")
      .eq("organization_id", organizationId).gte("created_at", start).lte("created_at", end)
      .eq("movement_type", "ADJUSTMENT").order("created_at", { ascending: false });
    throwDatabaseError(error);
    return fromDatabase(data ?? []);
  }
  if (type === "low" || type === "expiring" || type === "stock") {
    const rows = await inventoryView("ALL", "ALL");
    if (type === "low") return rows.filter((row) => row.status === "LOW" || row.status === "OUT");
    if (type === "expiring") return rows.filter((row) => row.status === "EXPIRING" || row.status === "EXPIRED");
    return rows;
  }
  const { data, error } = await client.from("sales").select("*,items:sale_items(*),payments(*)")
    .eq("organization_id", organizationId).gte("created_at", start).lte("created_at", end)
    .order("created_at", { ascending: false });
  throwDatabaseError(error);
  return fromDatabase(data ?? []);
}
