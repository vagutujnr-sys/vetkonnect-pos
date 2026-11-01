import { id } from "@/lib/ids";
import { fromDatabase, supabaseAdmin, throwDatabaseError, toDatabase } from "@/lib/supabase-admin";
import { writeAudit } from "./audit";
import type { Actor } from "./commerce";
import { quantityOnHand } from "./stock";

function org(actor: Actor) {
  return { organizationId: actor.organizationId, branchId: actor.branchId };
}

export async function receiveMedication(
  actor: Actor,
  input: {
    medicationId: string; batchNumber: string; expiryDate: string; quantity: number;
    supplierId?: string; costPrice?: number | null; reason?: string;
  },
) {
  const batchNumber = input.batchNumber.trim();
  if (!batchNumber) throw new Error("Enter the batch number.");
  if (!input.expiryDate) throw new Error("Enter the expiry date.");
  if (input.quantity <= 0) throw new Error("Quantity must be greater than zero.");
  const client = supabaseAdmin();
  const { data: medicationData, error: medicationError } = await client.from("medications").select("*")
    .eq("organization_id", actor.organizationId).eq("id", input.medicationId).maybeSingle();
  throwDatabaseError(medicationError);
  if (!medicationData) throw new Error("Medicine not found.");
  const medication = fromDatabase<{ id: string; name: string; supplierId: string | null; costPrice: number }>(medicationData);
  const { data: existingData, error: batchError } = await client.from("medication_batches").select("*")
    .eq("organization_id", actor.organizationId).eq("medication_id", medication.id).eq("batch_number", batchNumber).maybeSingle();
  throwDatabaseError(batchError);
  let batch = existingData ? fromDatabase<{ id: string }>(existingData) : null;
  if (!batch) {
    const { data, error } = await client.from("medication_batches").insert(toDatabase({
      id: id(), organizationId: actor.organizationId, medicationId: medication.id, batchNumber,
      expiryDate: new Date(input.expiryDate), supplierId: input.supplierId || medication.supplierId,
      receivedAt: new Date(), costPrice: input.costPrice ?? medication.costPrice,
    }) as never).select("id").single();
    throwDatabaseError(error);
    batch = fromDatabase<{ id: string }>(data);
  }
  const { error: movementError } = await client.from("stock_movements").insert(toDatabase({
    id: id(), ...org(actor), itemType: "MEDICATION", itemId: medication.id, batchId: batch.id,
    quantity: input.quantity, movementType: "RECEIVED", relatedType: "RECEIPT", userId: actor.id,
    reason: input.reason?.trim() || "Stock received",
  }) as never);
  throwDatabaseError(movementError);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "STOCK_RECEIVED", entity: "MedicationBatch", entityId: batch.id,
    details: { name: medication.name, batchNumber, quantity: input.quantity },
  });
  return batch;
}

export async function receiveProduct(
  actor: Actor,
  input: { productId: string; quantity: number; supplierId?: string; costPrice?: number | null; reason?: string },
) {
  if (input.quantity <= 0) throw new Error("Quantity must be greater than zero.");
  const client = supabaseAdmin();
  const { data: productData, error } = await client.from("products").select("*")
    .eq("organization_id", actor.organizationId).eq("id", input.productId).maybeSingle();
  throwDatabaseError(error);
  if (!productData) throw new Error("Product not found.");
  const product = fromDatabase<{ id: string; name: string }>(productData);
  if (input.supplierId || input.costPrice != null) {
    const update: Record<string, unknown> = {};
    if (input.supplierId) update.supplier_id = input.supplierId;
    if (input.costPrice != null) update.cost_price = input.costPrice;
    const { error: updateError } = await client.from("products").update(update)
      .eq("organization_id", actor.organizationId).eq("id", product.id);
    throwDatabaseError(updateError);
  }
  const { error: movementError } = await client.from("stock_movements").insert(toDatabase({
    id: id(), ...org(actor), itemType: "PRODUCT", itemId: product.id, quantity: input.quantity,
    movementType: "RECEIVED", relatedType: "RECEIPT", userId: actor.id,
    reason: input.reason?.trim() || "Stock received",
  }) as never);
  throwDatabaseError(movementError);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "STOCK_RECEIVED", entity: "Product", entityId: product.id,
    details: { name: product.name, quantity: input.quantity },
  });
  return product;
}

export async function adjustStock(
  actor: Actor,
  input: {
    itemType: "MEDICATION" | "PRODUCT"; itemId: string; batchId?: string | null; actual: number; reason: string;
  },
) {
  if (actor.role !== "VET" && actor.role !== "SUPER_ADMIN") throw new Error("Stock taking is done by a veterinarian.");
  if (input.itemType !== "MEDICATION" && input.itemType !== "PRODUCT") throw new Error("Choose a valid stock item.");
  if (!Number.isFinite(input.actual) || input.actual < 0) throw new Error("Enter a valid actual quantity.");
  if (!input.itemId.trim()) throw new Error("Choose a stock item.");
  const reason = input.reason.trim();
  let batchId: string | null = null;
  const client = supabaseAdmin();
  if (input.itemType === "MEDICATION") {
    const selectedBatchId = input.batchId;
    if (!selectedBatchId) throw new Error("Choose a batch.");
    const { data, error } = await client.from("medication_batches").select("id")
      .eq("organization_id", actor.organizationId).eq("medication_id", input.itemId).eq("id", selectedBatchId).maybeSingle();
    throwDatabaseError(error);
    if (!data) throw new Error("Medicine batch not found.");
    batchId = selectedBatchId;
  } else {
    const { data, error } = await client.from("products").select("id")
      .eq("organization_id", actor.organizationId).eq("id", input.itemId).maybeSingle();
    throwDatabaseError(error);
    if (!data) throw new Error("Product not found.");
  }
  const expected = await quantityOnHand(input.itemType, input.itemId, batchId);
  const variance = Math.round((input.actual - expected) * 1000) / 1000;
  if (variance === 0) return { expected, actual: input.actual, variance, movementId: null };
  if (!reason) throw new Error("Enter a reason for the variance.");
  const movementId = id();
  const { error } = await supabaseAdmin().from("stock_movements").insert(toDatabase({
    id: movementId, ...org(actor), itemType: input.itemType, itemId: input.itemId, batchId,
    quantity: variance, movementType: "ADJUSTMENT", relatedType: "STOCK_TAKE",
    userId: actor.id, reason,
  }) as never);
  throwDatabaseError(error);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "STOCK_ADJUSTMENT",
    entity: input.itemType === "MEDICATION" ? "MedicationBatch" : "Product", entityId: batchId || input.itemId,
    details: { expected, actual: input.actual, variance, reason, confirmedBy: actor.name },
  });
  return { expected, actual: input.actual, variance, movementId };
}
