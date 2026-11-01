"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Boxes, PawPrint, Plus, Settings, Tags, Trash2, UsersRound, X } from "lucide-react";
import { addInventoryCategoryAction, removeInventoryCategoryAction } from "@/server/actions";
import { SEXES, SPECIES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { IntegrationIdField } from "./IntegrationIdField";
import {
  createPatientAction,
  receiveAction,
  saveMedicationAction,
  saveProductAction,
  saveServiceAction,
  saveSettingsAction,
  saveUserAction,
  stockTakeAction,
} from "@/server/actions";

type PosItem = {
  key: string;
  itemType: "SERVICE" | "MEDICATION" | "PRODUCT";
  itemId: string;
  name: string;
  price: number;
  detail?: string;
  category?: string;
  sku?: string;
  barcode?: string | null;
  brand?: string | null;
  costPrice?: number;
  reorderLevel?: number;
  supplierId?: string | null;
  genericName?: string | null;
  manufacturer?: string | null;
  formulation?: string | null;
  strength?: string | null;
  unit?: string;
  packSize?: string | null;
  prescriptionRequired?: boolean;
  stockOnHand?: number;
  batches?: { id: string; batchNumber: string; onHand: number }[];
};

type Patient = { id: string; name: string; label: string };
type Owner = { id: string; fullName: string; mobile: string | null };
type Staff = { id: string; name: string; role: string; active: boolean };
type Supplier = { id: string; name: string };
type Category = { value: string; label: string };
type Subscription = { status: string; currentPeriodEnd: string | null } | null;
type Settings = {
  clinicName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  integrationId?: string | null;
  currencySymbol: string;
  lockTimeoutMinutes: number;
  receiptFooter: string | null;
};
type Section = "stock" | "patients" | "users" | "settings" | "categories";

export function ManagementDrawer({
  open,
  section,
  onClose,
  onOpen,
  canManage,
  canStockTake,
  categories,
  subscription,
  items,
  patients,
  owners,
  staff,
  suppliers,
  settings,
  error,
  saved,
}: {
  open: boolean;
  section: Section;
  onClose: () => void;
  onOpen: (section: Section) => void;
  canManage: boolean;
  canStockTake: boolean;
  categories: Category[];
  subscription: Subscription;
  items: PosItem[];
  patients: Patient[];
  owners: Owner[];
  staff: Staff[];
  suppliers: Supplier[];
  settings: Settings | null;
  error?: string;
  saved?: boolean;
}) {
  const [patientQuery, setPatientQuery] = useState("");
  const [stockTab, setStockTab] = useState<"receive" | "count" | "catalog">("receive");
  const [catalogType, setCatalogType] = useState<"medication" | "product" | "service">("product");
  const [editingItem, setEditingItem] = useState<PosItem | null>(null);
  const [countItem, setCountItem] = useState("");
  const [countActual, setCountActual] = useState("");
  const [countError, setCountError] = useState("");
  const [countSaved, setCountSaved] = useState("");
  const [countBusy, setCountBusy] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const router = useRouter();
  const filteredPatients = useMemo(() => {
    const query = patientQuery.trim().toLowerCase();
    return query ? patients.filter((patient) => `${patient.name} ${patient.label}`.toLowerCase().includes(query)) : patients;
  }, [patientQuery, patients]);

  if (!open) return null;

  const title = {
    stock: "Stock management",
    patients: "Kennel management",
    users: "Staff access",
    settings: "Practice settings",
    categories: "Stock categories",
  }[section];

  return (
    <div className="management-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside id="management-drawer" className="management-drawer" role="dialog" aria-modal="true" aria-labelledby="management-title">
        <header className="management-head">
          <div>
            <span className="management-eyebrow">PRACTICE MANAGEMENT</span>
            <h2 id="management-title">{title}</h2>
          </div>
          <button type="button" className="management-close" aria-label="Close management drawer" onClick={onClose}><X size={20} /></button>
        </header>
        <section className="management-subscription" aria-label="Practice subscription">
          <span className="management-subscription-icon"><Tags size={17} /></span>
          <span className="management-subscription-copy">
            <strong>Practice plan · $5 / month</strong>
            <small>
              {subscription
                ? `${subscription.status.replace(/_/g, " ")}${subscription.currentPeriodEnd ? ` · Expires ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(subscription.currentPeriodEnd))}` : ""}`
                : "Subscription details unavailable"}
            </small>
          </span>
        </section>
        <nav className="management-tabs" aria-label="Management sections">
          <button type="button" className={section === "stock" ? "active" : ""} onClick={() => onOpen("stock")}><Boxes size={16} />Stock</button>
          {canManage ? <button type="button" className={section === "categories" ? "active" : ""} onClick={() => onOpen("categories")}><Tags size={16} />Categories</button> : null}
          <button type="button" className={section === "patients" ? "active" : ""} onClick={() => onOpen("patients")}><PawPrint size={16} />Kennel</button>
          <button type="button" className={section === "users" ? "active" : ""} onClick={() => onOpen("users")}><UsersRound size={16} />Staff</button>
          <button type="button" className={section === "settings" ? "active" : ""} onClick={() => onOpen("settings")}><Settings size={16} />Settings</button>
        </nav>
        <nav className="management-quicklinks" aria-label="Practice overview">
          <Link href="/reports?type=daily">Daily sales</Link>
          <Link href="/owners">Clients</Link>
        </nav>
        <div className="management-content">
          {error ? <p className="banner danger">{error}</p> : null}
          {saved ? <p className="banner ok">Saved successfully.</p> : null}

          {section === "stock" ? (
            <section>
              <div className="management-subtabs">
                <button type="button" className={stockTab === "receive" ? "active" : ""} onClick={() => { setEditingItem(null); setStockTab("receive"); }}>Stock on hand</button>
                <button type="button" className={stockTab === "count" ? "active" : ""} onClick={() => { setEditingItem(null); setStockTab("count"); }}>Count stock</button>
                <button type="button" className={stockTab === "catalog" ? "active" : ""} onClick={() => { setEditingItem(null); setStockTab("catalog"); }}>Add stock item</button>
              </div>
              {stockTab === "receive" ? (
                <>
                  <div className="management-list">
                    {items.filter((item) => item.itemType !== "SERVICE").map((item) => (
                      <div className="management-row" key={item.key}>
                        <span><strong>{item.name}</strong><small>{item.detail || item.category}</small></span>
                        <span className="management-row-actions">
                          <b>{formatMoney(item.price)}</b>
                          {canManage ? <button type="button" className="management-edit-button" onClick={() => {
                            setEditingItem(item);
                            setCatalogType(item.itemType === "MEDICATION" ? "medication" : "product");
                            setStockTab("catalog");
                          }}>Edit</button> : null}
                        </span>
                      </div>
                    ))}
                    {!items.some((item) => item.itemType !== "SERVICE") ? <p className="management-empty">No stock items in the catalogue yet.</p> : null}
                  </div>
                  <details className="management-form-disclosure">
                    <summary>Receive medicine or product stock</summary>
                    <div className="management-form-stack">
                      <form action={receiveAction} className="management-form">
                        <input type="hidden" name="kind" value="MEDICATION" />
                        <input type="hidden" name="returnTo" value="pos" />
                        <strong>Medicine batch</strong>
                        <label className="field"><span>Medicine</span><select name="medicationId" required defaultValue=""><option value="" disabled>Select medicine</option>{items.filter((item) => item.itemType === "MEDICATION").map((item) => <option key={item.key} value={item.itemId}>{item.name}</option>)}</select></label>
                        <div className="grid-2">
                          <label className="field"><span>Batch number</span><input name="batchNumber" required /></label>
                          <label className="field"><span>Expiry date</span><input name="expiryDate" type="date" required /></label>
                        </div>
                        <div className="grid-2">
                          <label className="field"><span>Quantity received</span><input name="quantity" type="number" min="0.001" step="any" required /></label>
                          <label className="field"><span>Cost per unit</span><input name="costPrice" type="number" min="0" step="0.01" /></label>
                        </div>
                        <label className="field"><span>Supplier</span><select name="supplierId" defaultValue=""><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                        <button className="btn btn-primary" type="submit">Receive medicine</button>
                      </form>
                      <form action={receiveAction} className="management-form">
                        <input type="hidden" name="kind" value="PRODUCT" />
                        <input type="hidden" name="returnTo" value="pos" />
                        <strong>Food or accessories</strong>
                        <label className="field"><span>Product</span><select name="productId" required defaultValue=""><option value="" disabled>Select product</option>{items.filter((item) => item.itemType === "PRODUCT").map((item) => <option key={item.key} value={item.itemId}>{item.name}</option>)}</select></label>
                        <div className="grid-2">
                          <label className="field"><span>Quantity received</span><input name="quantity" type="number" min="0.001" step="any" required /></label>
                          <label className="field"><span>Cost per unit</span><input name="costPrice" type="number" min="0" step="0.01" /></label>
                        </div>
                        <label className="field"><span>Supplier</span><select name="supplierId" defaultValue=""><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                        <button className="btn btn-primary" type="submit">Receive product</button>
                      </form>
                    </div>
                  </details>
                </>
              ) : stockTab === "count" ? (
                canStockTake ? (
                  <form className="management-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    setCountError("");
                    setCountSaved("");
                    const [itemType, itemId, batchId] = countItem.split("|");
                    if ((itemType !== "PRODUCT" && itemType !== "MEDICATION") || !itemId || (itemType === "MEDICATION" && !batchId)) {
                      setCountError("Select a product or medicine batch.");
                      return;
                    }
                    setCountBusy(true);
                    try {
                      const result = await stockTakeAction({
                        itemType,
                        itemId,
                        batchId,
                        actual: Number(countActual),
                        reason: String(new FormData(event.currentTarget).get("reason") ?? ""),
                      });
                      if (!result.ok) {
                        setCountError(result.error);
                        return;
                      }
                      setCountSaved(result.variance ? `Count saved. Stock adjusted by ${result.variance}.` : "Count saved. Stock matches the recorded quantity.");
                      router.refresh();
                    } catch (error) {
                      setCountError(error instanceof Error ? error.message : "Could not save the stock count.");
                    } finally {
                      setCountBusy(false);
                    }
                  }}>
                    <p className="management-empty">Choose the item or medicine batch, enter the physical count, and give a reason if it differs from the recorded quantity.</p>
                    <label className="field"><span>Item / batch</span><select value={countItem} onChange={(event) => {
                      const option = event.currentTarget.selectedOptions[0];
                      setCountItem(event.target.value);
                      setCountActual(option?.dataset.onHand ?? "");
                      setCountError("");
                      setCountSaved("");
                    }} required>
                      <option value="" disabled>Select stock item</option>
                      {items.filter((item) => item.itemType === "PRODUCT").map((item) => <option key={item.key} value={`PRODUCT|${item.itemId}`} data-on-hand={item.stockOnHand ?? 0}>{item.name} · {item.detail}</option>)}
                      {items.filter((item) => item.itemType === "MEDICATION").flatMap((item) => (item.batches ?? []).map((batch) => (
                        <option key={batch.id} value={`MEDICATION|${item.itemId}|${batch.id}`} data-on-hand={batch.onHand}>{item.name} · {batch.batchNumber} · {batch.onHand} on hand</option>
                      )))}
                    </select></label>
                    <label className="field"><span>Physical quantity</span><input name="actual" type="number" min="0" step="any" value={countActual} onChange={(event) => setCountActual(event.target.value)} required /></label>
                    <label className="field"><span>Reason for variance</span><input name="reason" placeholder="Required only when count differs" /></label>
                    {countError ? <p className="management-inline-error" role="alert">{countError}</p> : null}
                    {countSaved ? <p className="management-inline-success" role="status">{countSaved}</p> : null}
                    <button className="btn btn-primary" type="submit" disabled={countBusy}>{countBusy ? "Saving count..." : "Save stock count"}</button>
                  </form>
                ) : <p className="management-empty">Stock counts and adjustments are available to veterinarians and Super Admins.</p>
              ) : (
                <>
                  <div className="management-subtabs">
                    <button type="button" className={catalogType === "medication" ? "active" : ""} onClick={() => { setEditingItem(null); setCatalogType("medication"); }}>Medicine</button>
                    <button type="button" className={catalogType === "product" ? "active" : ""} onClick={() => { setEditingItem(null); setCatalogType("product"); }}>Product</button>
                    <button type="button" className={catalogType === "service" ? "active" : ""} onClick={() => { setEditingItem(null); setCatalogType("service"); }}>Service</button>
                  </div>
                  {editingItem ? <p className="management-empty">Editing {editingItem.name}. Update its details and save to stay on the POS.</p> : null}
                  {!canManage ? <p className="management-empty">Only a Super Admin can change stock items.</p> : null}
                  {canManage && catalogType === "medication" ? (
                    <form action={saveMedicationAction} className="management-form">
                      <input type="hidden" name="returnTo" value="pos" />
                      {editingItem?.itemType === "MEDICATION" ? <input type="hidden" name="id" value={editingItem.itemId} /> : null}
                      <input type="hidden" name="active" value="on" />
                      <label className="field"><span>Medicine name</span><input name="name" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.name : ""} required /></label>
                      <div className="grid-2">
                        <label className="field"><span>Category</span><select name="category" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.category : categories[0]?.value ?? ""} required disabled={!categories.length}>
                          <option value="" disabled>{categories.length ? "Select category" : "Add a category first"}</option>
                          {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                        </select></label>
                        <label className="field"><span>Strength</span><input name="strength" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.strength ?? "" : ""} /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Generic name</span><input name="genericName" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.genericName ?? "" : ""} /></label>
                        <label className="field"><span>Manufacturer</span><input name="manufacturer" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.manufacturer ?? "" : ""} /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Formulation</span><input name="formulation" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.formulation ?? "" : ""} /></label>
                        <label className="field"><span>Pack size</span><input name="packSize" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.packSize ?? "" : ""} /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Unit</span><input name="unit" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.unit : "dose"} required /></label>
                        <label className="field"><span>Selling price</span><input name="sellingPrice" type="number" min="0" step="0.01" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.price : ""} required /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Cost price</span><input name="costPrice" type="number" min="0" step="0.01" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.costPrice : ""} required /></label>
                        <label className="field"><span>Reorder level</span><input name="reorderLevel" type="number" min="0" step="any" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.reorderLevel : 0} required /></label>
                      </div>
                      <label className="field"><span>Supplier</span><select name="supplierId" defaultValue={editingItem?.itemType === "MEDICATION" ? editingItem.supplierId ?? "" : ""}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                      <label className="management-checkbox"><input type="checkbox" name="prescriptionRequired" defaultChecked={editingItem?.itemType === "MEDICATION" ? editingItem.prescriptionRequired : false} />Prescription required</label>
                      <button className="btn btn-primary" type="submit" disabled={!categories.length}>{editingItem?.itemType === "MEDICATION" ? "Save medicine" : "Add medicine"}</button>
                    </form>
                  ) : null}
                  {canManage && catalogType === "product" ? (
                    <form action={saveProductAction} className="management-form">
                      <input type="hidden" name="returnTo" value="pos" />
                      <input type="hidden" name="id" value={editingItem?.itemType === "PRODUCT" ? editingItem.itemId : ""} />
                      <input type="hidden" name="sku" value={editingItem?.itemType === "PRODUCT" ? editingItem.sku ?? "" : ""} />
                      <input type="hidden" name="barcode" value={editingItem?.itemType === "PRODUCT" ? editingItem.barcode ?? "" : ""} />
                      <input type="hidden" name="brand" value={editingItem?.itemType === "PRODUCT" ? editingItem.brand ?? "" : ""} />
                      <input type="hidden" name="active" value="on" />
                      <label className="field"><span>Product name</span><input name="name" defaultValue={editingItem?.itemType === "PRODUCT" ? editingItem.name : ""} required /></label>
                      <div className="grid-2">
                        <label className="field"><span>Category</span><select name="category" defaultValue={editingItem?.itemType === "PRODUCT" ? editingItem.category : categories[0]?.value ?? ""} required disabled={!categories.length}>
                          <option value="" disabled>{categories.length ? "Select category" : "Add a category first"}</option>
                          {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                        </select></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Cost price</span><input name="costPrice" type="number" min="0" step="0.01" defaultValue={editingItem?.itemType === "PRODUCT" ? editingItem.costPrice : ""} required /></label>
                        <label className="field"><span>Selling price</span><input name="sellingPrice" type="number" min="0" step="0.01" defaultValue={editingItem?.itemType === "PRODUCT" ? editingItem.price : ""} required /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Reorder level</span><input name="reorderLevel" type="number" min="0" step="any" defaultValue={editingItem?.itemType === "PRODUCT" ? editingItem.reorderLevel : 0} required /></label>
                        <label className="field"><span>Supplier</span><select name="supplierId" defaultValue={editingItem?.itemType === "PRODUCT" ? editingItem.supplierId ?? "" : ""}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={!categories.length}>{editingItem?.itemType === "PRODUCT" ? "Save stock item" : "Add stock item"}</button>
                    </form>
                  ) : null}
                  {canManage && catalogType === "service" ? (
                    <form action={saveServiceAction} className="management-form">
                      <input type="hidden" name="returnTo" value="pos" />
                      <label className="field"><span>Service name</span><input name="name" required /></label>
                      <div className="grid-2">
                        <label className="field"><span>Category</span><input name="category" defaultValue="General" /></label>
                        <label className="field"><span>Price</span><input name="price" type="number" min="0" step="0.01" required /></label>
                      </div>
                      <label className="field"><span>Duration in minutes</span><input name="durationMinutes" type="number" min="0" step="1" /></label>
                      <input type="hidden" name="active" value="on" />
                      <button className="btn btn-primary" type="submit">Add service</button>
                    </form>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {section === "patients" ? (
            <section>
              <label className="field"><span>Search patients</span><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Name, owner or patient number" /></label>
              <div className="management-list">
                {filteredPatients.map((patient) => <a className="management-row" href={`/patients/${patient.id}`} key={patient.id}><span><strong>{patient.name}</strong><small>{patient.label}</small></span><b>View</b></a>)}
                {!filteredPatients.length ? <p className="management-empty">No patients found.</p> : null}
              </div>
              <details className="management-form-disclosure">
                <summary>Register a patient</summary>
                <form action={createPatientAction} className="management-form">
                  <input type="hidden" name="returnTo" value="pos" />
                  <label className="field"><span>Existing owner (optional)</span><select name="ownerId" defaultValue=""><option value="">Create new owner below</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName}{owner.mobile ? ` · ${owner.mobile}` : ""}</option>)}</select></label>
                  <div className="grid-2">
                    <label className="field"><span>Owner name</span><input name="ownerName" /></label>
                    <label className="field"><span>Owner mobile</span><input name="ownerMobile" inputMode="tel" /></label>
                  </div>
                  <label className="field"><span>Patient name</span><input name="name" required /></label>
                  <div className="grid-2">
                    <label className="field"><span>Species</span><select name="species" defaultValue="Dog">{SPECIES.map((species) => <option key={species}>{species}</option>)}</select></label>
                    <label className="field"><span>Sex</span><select name="sex" defaultValue="Unknown">{SEXES.map((sex) => <option key={sex}>{sex}</option>)}</select></label>
                  </div>
                  <div className="grid-2">
                    <label className="field"><span>Breed</span><input name="breed" /></label>
                    <label className="field"><span>Date of birth</span><input name="dob" type="date" /></label>
                  </div>
                  <button className="btn btn-primary" type="submit">Save patient</button>
                </form>
              </details>
            </section>
          ) : null}

          {section === "users" ? (
            <section>
              {!canManage ? <p className="management-empty">Only a Super Admin can manage staff accounts.</p> : (
                <>
                  <div className="management-list">
                    {staff.map((user) => <div className="management-row" key={user.id}><span><strong>{user.name}</strong><small>{user.role.replace("_", " ")} · {user.active ? "Active" : "Inactive"}</small></span></div>)}
                    {!staff.length ? <p className="management-empty">No staff accounts found.</p> : null}
                  </div>
                  <details className="management-form-disclosure" open>
                    <summary>Add staff member</summary>
                    <form action={saveUserAction} className="management-form">
                      <input type="hidden" name="returnTo" value="pos" />
                      <label className="field"><span>Name</span><input name="name" required minLength={2} /></label>
                      <div className="grid-2">
                        <label className="field"><span>Role</span><select name="role"><option value="VET">Veterinarian</option><option value="ADMIN">General staff</option></select></label>
                        <label className="field"><span>4-digit PIN</span><input name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required /></label>
                      </div>
                      <label className="field"><span>Registration number (vets)</span><input name="registrationNumber" /></label>
                      <input type="hidden" name="active" value="on" />
                      <button className="btn btn-primary" type="submit">Add staff</button>
                    </form>
                  </details>
                </>
              )}
            </section>
          ) : null}

          {section === "settings" ? (
            <section>
              {!canManage ? <p className="management-empty">Only a Super Admin can change practice settings.</p> : !settings ? <p className="management-empty">Practice settings are unavailable.</p> : (
                <form action={saveSettingsAction} className="management-form">
                  <input type="hidden" name="returnTo" value="pos" />
                  <IntegrationIdField integrationId={settings.integrationId} />
                  <label className="field"><span>Practice name</span><input name="clinicName" defaultValue={settings.clinicName} required /></label>
                  <label className="field"><span>Tagline</span><input name="tagline" defaultValue={settings.tagline} /></label>
                  <label className="field"><span>Address</span><input name="address" defaultValue={settings.address} /></label>
                  <div className="grid-2">
                    <label className="field"><span>Phone</span><input name="phone" defaultValue={settings.phone} /></label>
                    <label className="field"><span>Email</span><input name="email" type="email" defaultValue={settings.email} /></label>
                  </div>
                  <div className="grid-2">
                    <label className="field"><span>Currency</span><input name="currencySymbol" defaultValue={settings.currencySymbol} /></label>
                    <label className="field"><span>Lock after (min)</span><input name="lockTimeoutMinutes" type="number" min="1" max="60" defaultValue={settings.lockTimeoutMinutes} /></label>
                  </div>
                  <section className="whatsapp-receipt-status" aria-label="WhatsApp receipting status">
                    <strong>WhatsApp Receipting</strong>
                    <span>Pending VetKonnect Integration</span>
                  </section>
                  <label className="field"><span>Receipt footer</span><textarea name="receiptFooter" defaultValue={settings.receiptFooter ?? ""} /></label>
                  <button className="btn btn-primary" type="submit">Save settings</button>
                </form>
              )}
            </section>
          ) : null}

          {section === "categories" ? (
            <section>
              <p className="management-empty">Categories organize medicine and product filters on the POS. A category in use cannot be removed.</p>
              {categoryError ? <p className="management-inline-error" role="alert">{categoryError}</p> : null}
              {categoryMessage ? <p className="management-inline-success" role="status">{categoryMessage}</p> : null}
              <form className="management-form category-add-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                setCategoryError("");
                setCategoryMessage("");
                setCategoryBusy(true);
                try {
                  const result = await addInventoryCategoryAction(categoryName);
                  if (!result.ok) {
                    setCategoryError(result.error);
                    return;
                  }
                  setCategoryName("");
                  setCategoryMessage(`${result.category.label} added.`);
                  router.refresh();
                } catch (error) {
                  setCategoryError(error instanceof Error ? error.message : "Could not add the category.");
                } finally {
                  setCategoryBusy(false);
                }
              }}>
                <label className="field"><span>New category</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} minLength={2} maxLength={40} required placeholder="e.g. Bird food" /></label>
                <button className="btn btn-primary" type="submit" disabled={categoryBusy}><Plus size={17} />{categoryBusy ? "Adding…" : "Add category"}</button>
              </form>
              <div className="management-list">
                {categories.map((category) => (
                  <div className="management-row" key={category.value}>
                    <span><strong>{category.label}</strong><small>POS category</small></span>
                    <button type="button" className="management-remove-button" disabled={categoryBusy} aria-label={`Remove ${category.label}`} onClick={async () => {
                      setCategoryError("");
                      setCategoryMessage("");
                      setCategoryBusy(true);
                      try {
                        const result = await removeInventoryCategoryAction(category.value);
                        if (!result.ok) {
                          setCategoryError(result.error);
                          return;
                        }
                        setCategoryMessage(`${category.label} removed.`);
                        router.refresh();
                      } catch (error) {
                        setCategoryError(error instanceof Error ? error.message : "Could not remove the category.");
                      } finally {
                        setCategoryBusy(false);
                      }
                    }}><Trash2 size={16} /><span>Remove</span></button>
                  </div>
                ))}
                {!categories.length ? <p className="management-empty">No categories yet. Add one above.</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
