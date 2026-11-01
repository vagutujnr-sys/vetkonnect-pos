import { PosScreen } from "@/components/PosScreen";
import { getSession } from "@/lib/session";
import { ageLabel } from "@/lib/dates";
import { categoryLabel } from "@/lib/constants";
import { formatDate, isExpired } from "@/lib/dates";
import { getClinicSettings } from "@/lib/clinic";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; error?: string; saved?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const organizationId = session.organizationId;
  const query = await searchParams;
  const panels = ["stock", "patients", "users", "settings", "categories"] as const;
  const initialPanel = panels.find((panel) => panel === query.panel);
  const [servicesResult, medicinesResult, productsResult, patientsResult, allPatientsResult, methodsResult, settings, movementsResult, ownersResult, staffResult, suppliersResult, categoriesResult, subscriptionResult] = await Promise.all([
    supabaseAdmin().from("services").select("id,name,price,category").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabaseAdmin().from("medications").select("id,name,category,generic_name,manufacturer,formulation,strength,unit,pack_size,cost_price,selling_price,reorder_level,supplier_id,prescription_required,medication_batches(*)").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabaseAdmin().from("products").select("id,sku,barcode,brand,name,category,cost_price,selling_price,reorder_level,supplier_id").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabaseAdmin().from("patients").select("id,name,dob,estimated_age,owner_id,owner:owners(id,full_name)").eq("organization_id", organizationId).eq("status", "ACTIVE").order("name").limit(500),
    supabaseAdmin().from("patients").select("id,name,patient_number,owner_id,owner:owners(id,full_name)").eq("organization_id", organizationId).eq("status", "ACTIVE").order("name").limit(500),
    supabaseAdmin().from("payment_methods").select("name,sort_order").eq("organization_id", organizationId).or("active.eq.true,name.eq.VKWallet").order("sort_order"),
    getClinicSettings(organizationId),
    supabaseAdmin().from("stock_movements").select("item_type,item_id,batch_id,quantity").eq("organization_id", organizationId),
    supabaseAdmin().from("owners").select("id,full_name,mobile").eq("organization_id", organizationId).order("full_name").limit(500),
    supabaseAdmin().from("users").select("id,name,role,active").eq("organization_id", organizationId).order("name"),
    supabaseAdmin().from("suppliers").select("id,name").eq("organization_id", organizationId).order("name"),
    supabaseAdmin().from("inventory_categories").select("id,name").eq("organization_id", organizationId).order("name"),
    billingSupabaseAdmin().from("subscriptions").select("status,current_period_end").eq("organization_id", organizationId).maybeSingle(),
  ]);
  for (const result of [servicesResult, medicinesResult, productsResult, patientsResult, allPatientsResult, methodsResult, movementsResult, ownersResult, staffResult, suppliersResult, categoriesResult, subscriptionResult]) {
    throwDatabaseError(result.error);
  }
  const services = fromDatabase<{ id: string; name: string; price: number; category: string }[]>(servicesResult.data ?? []);
  const medicines = fromDatabase<{
    id: string;
    name: string;
    category: string;
    genericName: string | null;
    manufacturer: string | null;
    formulation: string | null;
    strength: string | null;
    sellingPrice: number;
    costPrice: number;
    reorderLevel: number;
    supplierId: string | null;
    prescriptionRequired: boolean;
    packSize: string | null;
    unit: string;
    medicationBatches: { id: string; batchNumber: string; expiryDate: Date }[];
  }[]>(medicinesResult.data ?? []);
  const products = fromDatabase<{ id: string; sku: string; barcode: string | null; brand: string | null; name: string; category: string; costPrice: number; sellingPrice: number; reorderLevel: number; supplierId: string | null }[]>(productsResult.data ?? []);
  const patients = fromDatabase<{
    id: string;
    name: string;
    dob: Date | null;
    estimatedAge: string | null;
    ownerId: string | null;
    owner: { id: string; fullName: string } | null;
  }[]>(patientsResult.data ?? []);
  const allPatients = fromDatabase<{
    id: string;
    name: string;
    patientNumber: string;
    ownerId: string | null;
    owner: { id: string; fullName: string } | null;
  }[]>(allPatientsResult.data ?? []);
  const methods = fromDatabase<{ name: string }[]>(methodsResult.data ?? []);
  const movements = fromDatabase<{ itemType: string; itemId: string; batchId: string | null; quantity: number }[]>(movementsResult.data ?? []);
  const owners = fromDatabase<{ id: string; fullName: string; mobile: string }[]>(ownersResult.data ?? []);
  const staff = fromDatabase<{ id: string; name: string; role: string; active: boolean }[]>(staffResult.data ?? []);
  const suppliers = fromDatabase<{ id: string; name: string }[]>(suppliersResult.data ?? []);
  const categories = fromDatabase<{ id: string; name: string }[]>(categoriesResult.data ?? []);
  const subscription = subscriptionResult.data ? {
    status: subscriptionResult.data.status,
    currentPeriodEnd: subscriptionResult.data.current_period_end,
  } : null;
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
      costPrice: medicine.costPrice,
      reorderLevel: medicine.reorderLevel,
      supplierId: medicine.supplierId,
      genericName: medicine.genericName,
      manufacturer: medicine.manufacturer,
      formulation: medicine.formulation,
      strength: medicine.strength,
      unit: medicine.unit,
      packSize: medicine.packSize,
      prescriptionRequired: medicine.prescriptionRequired,
      stockOnHand: stockFor("MEDICATION", medicine.id),
      detail: `${categoryLabel(medicine.category)} · ${stockFor("MEDICATION", medicine.id)} ${medicine.unit}`,
      category: medicine.category,
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
      sku: product.sku,
      barcode: product.barcode,
      brand: product.brand,
      costPrice: product.costPrice,
      reorderLevel: product.reorderLevel,
      supplierId: product.supplierId,
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
      clinicName={settings?.clinicName ?? "VetKonnect P.O.S"}
      symbol={settings?.currencySymbol ?? "$"}
      methods={methods.map((method) => method.name)}
      items={items}
      patients={patients.map((patient) => ({
        id: patient.id,
        name: patient.name,
        ownerId: patient.ownerId,
        label: `${patient.name} / ${patient.owner?.fullName ?? "No client"} · ${ageLabel(patient.dob, patient.estimatedAge)}`,
      }))}
      canManage={session.role === "SUPER_ADMIN"}
      categories={categories.map((category) => ({
        value: category.name,
        label: categoryLabel(category.name),
      }))}
      subscription={subscription}
      management={{
        initialPanel,
        error: query.error,
        saved: query.saved === "1",
        canStockTake: session.role === "VET" || session.role === "SUPER_ADMIN",
        owners,
        patients: allPatients.map((patient) => ({
          id: patient.id,
          name: patient.name,
          label: `${patient.name} / ${patient.owner?.fullName ?? "No client"} · ${patient.patientNumber}`,
        })),
        staff,
        suppliers,
        settings,
      }}
    />
  );
}
