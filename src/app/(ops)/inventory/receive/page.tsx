import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { receiveAction } from "@/server/actions";

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await getSession();
  if (!session) return null;
  const client = supabaseAdmin();
  const [medicationResult, productResult, supplierResult] = await Promise.all([
    client.from("medications").select("id,name").eq("organization_id", session.organizationId).eq("active", true).order("name"),
    client.from("products").select("id,name").eq("organization_id", session.organizationId).eq("active", true).order("name"),
    client.from("suppliers").select("id,name").eq("organization_id", session.organizationId).order("name"),
  ]);
  for (const result of [medicationResult, productResult, supplierResult]) throwDatabaseError(result.error);
  const medications = fromDatabase<{ id: string; name: string }[]>(medicationResult.data ?? []);
  const products = fromDatabase<{ id: string; name: string }[]>(productResult.data ?? []);
  const suppliers = fromDatabase<{ id: string; name: string }[]>(supplierResult.data ?? []);
  return (
    <form action={receiveAction}>
      <h1>Receive stock</h1>
      {error ? <p className="banner danger">{error}</p> : null}
      <label className="field"><span>Type</span>
        <select name="kind"><option value="MEDICATION">Medication</option><option value="PRODUCT">Feed or accessory</option></select>
      </label>
      <label className="field"><span>Medicine</span>
        <select name="medicationId">{medications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="field"><span>Product</span>
        <select name="productId">{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="field"><span>Batch / lot</span><input name="batchNumber" /></label>
      <label className="field"><span>Expiry</span><input type="date" name="expiryDate" /></label>
      <label className="field"><span>Quantity</span><input name="quantity" inputMode="decimal" /></label>
      <label className="field"><span>Supplier</span>
        <select name="supplierId"><option value="">None</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="field"><span>Cost price</span><input name="costPrice" inputMode="decimal" /></label>
      <label className="field"><span>Note</span><input name="reason" /></label>
      <button className="btn btn-primary btn-block" type="submit">Receive</button>
    </form>
  );
}
