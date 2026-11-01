import { PosScreen } from "@/components/PosScreen";
import { getSession } from "@/lib/session";
import { ageLabel } from "@/lib/dates";
import { categoryLabel } from "@/lib/constants";
import { formatDate, isExpired } from "@/lib/dates";
import { getClinicSettings } from "@/lib/clinic";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; error?: string; saved?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const organizationId = session.organizationId;
  const query = await searchParams;
  const panels = ["stock", "patients", "users", "settings"] as const;
  const initialPanel = panels.find((panel) => panel === query.panel);
  const [servicesResult, medicinesResult, productsResult, patientsResult, allPatientsResult, methodsResult, settings, movementsResult, ownersResult, staffResult, suppliersResult] = await Promise.all([
    supabaseAdmin().from("services").select("id,name,price,category").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabaseAdmin().from("medications").select("id,name,selling_price,unit,medication_batches(*)").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabaseAdmin().from("products").select("id,sku,name,category,selling_price").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabaseAdmin().from("patients").select("id,name,dob,estimated_age,owner:owners(full_name)").eq("organization_id", organizationId).eq("status", "ACTIVE").order("name").limit(80),
    supabaseAdmin().from("patients").select("id,name,patient_number,owner:owners(full_name)").eq("organization_id", organizationId).eq("status", "ACTIVE").order("name").limit(500),
    supabaseAdmin().from("payment_methods").select("name,sort_order").eq("organization_id", organizationId).or("active.eq.true,name.eq.VKWallet").order("sort_order"),
    getClinicSettings(organizationId),
    supabaseAdmin().from("stock_movements").select("item_type,item_id,batch_id,quantity").eq("organization_id", organizationId),
    supabaseAdmin().from("owners").select("id,full_name,mobile").eq("organization_id", organizationId).order("full_name").limit(500),
    supabaseAdmin().from("users").select("id,name,role,active").eq("organization_id", organizationId).order("name"),
    supabaseAdmin().from("suppliers").select("id,name").eq("organization_id", organizationId).order("name"),
  ]);
  for (const result of [servicesResult, medicinesResult, productsResult, patientsResult, allPatientsResult, methodsResult, movementsResult, ownersResult, staffResult, suppliersResult]) {
    throwDatabaseError(result.error);
  }
  const services = fromDatabase<{ id: string; name: string; price: number; category: string }[]>(servicesResult.data ?? []);
  const medicines = fromDatabase<{
    id: string;
    name: string;
    sellingPrice: number;
    unit: string;
    medicationBatches: { id: string; batchNumber: string; expiryDate: Date }[];
  }[]>(medicinesResult.data ?? []);
  const products = fromDatabase<{ id: string; sku: string; name: string; category: string; sellingPrice: number }[]>(productsResult.data ?? []);
  const patients = fromDatabase<{
    id: string;
    name: string;
    dob: Date | null;
    estimatedAge: string | null;
    owner: { fullName: string };
  }[]>(patientsResult.data ?? []);
  const allPatients = fromDatabase<{
    id: string;
    name: string;
    patientNumber: string;
    owner: { fullName: string };
  }[]>(allPatientsResult.data ?? []);
  const methods = fromDatabase<{ name: string }[]>(methodsResult.data ?? []);
  const movements = fromDatabase<{ itemType: string; itemId: string; batchId: string | null; quantity: number }[]>(movementsResult.data ?? []);
  const owners = fromDatabase<{ id: string; fullName: string; mobile: string }[]>(ownersResult.data ?? []);
  const staff = fromDatabase<{ id: string; name: string; role: string; active: boolean }[]>(staffResult.data ?? []);
  const suppliers = fromDatabase<{ id: string; name: string }[]>(suppliersResult.data ?? []);
  const stockFor = (itemType: string, itemId: string, batchId?: string | null) =>
    movements.reduce((total, movement) => {
      if (movement.itemType !== itemType || movement.itemId !== itemId) return total;
      if (batchId !== undefined && movement.batchId !== batchId) return total;
      return total + movement.quantity;
    }, 0);
  const items = [
    ...services.map((service) => ({
      key: `s-${service.id}`,
      itemType: "SERVICE" as const,
      itemId: service.id,
      name: service.name,
      price: service.price,
      detail: service.category,
      category: service.category,
    })),
    ...medicines.map((medicine) => ({
      key: `m-${medicine.id}`,
      itemType: "MEDICATION" as const,
      itemId: medicine.id,
      name: medicine.name,
      price: medicine.sellingPrice,
      stockOnHand: stockFor("MEDICATION", medicine.id),
      detail: `${stockFor("MEDICATION", medicine.id)} ${medicine.unit}`,
      category: "DRUGS",
      batches: medicine.medicationBatches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        onHand: stockFor("MEDICATION", medicine.id, batch.id),
        expired: isExpired(batch.expiryDate),
        expiry: formatDate(batch.expiryDate),
      })),
    })),
    ...products.map((product) => ({
      key: `p-${product.id}`,
      itemType: "PRODUCT" as const,
      itemId: product.id,
      name: product.name,
      price: product.sellingPrice,
      stockOnHand: stockFor("PRODUCT", product.id, null),
      detail: `${categoryLabel(product.category)} · ${stockFor("PRODUCT", product.id, null)} in stock`,
      category: product.category,
      searchText: product.sku,
    })),
  ];
  return (
    <PosScreen
      canCustom={session?.role === "VET" || session?.role === "SUPER_ADMIN"}
      userName={session?.name ?? ""}
      userId={session.id}
      clinicName={settings?.clinicName ?? "VetKonnect P.O.S"}
      organizationId={organizationId}
      symbol={settings?.currencySymbol ?? "$"}
      methods={methods.map((method) => method.name)}
      items={items}
      patients={patients.map((patient) => ({
        id: patient.id,
        name: patient.name,
        label: `${patient.name} / ${patient.owner.fullName} · ${ageLabel(patient.dob, patient.estimatedAge)}`,
      }))}
      canManage={session.role === "SUPER_ADMIN"}
      management={{
        initialPanel,
        error: query.error,
        saved: query.saved === "1",
        canStockTake: session.role === "VET" || session.role === "SUPER_ADMIN",
        owners,
        patients: allPatients.map((patient) => ({
          id: patient.id,
          name: patient.name,
          label: `${patient.name} / ${patient.owner.fullName} · ${patient.patientNumber}`,
        })),
        staff,
        suppliers,
        settings,
      }}
    />
  );
}
