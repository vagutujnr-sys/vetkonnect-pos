"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Boxes, PawPrint, Settings, UsersRound, X } from "lucide-react";
import { PRODUCT_CATEGORIES, SEXES, SPECIES } from "@/lib/constants";
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
  stockOnHand?: number;
  batches?: { id: string; batchNumber: string; onHand: number }[];
};

type Patient = { id: string; name: string; label: string };
type Owner = { id: string; fullName: string; mobile: string | null };
type Staff = { id: string; name: string; role: string; active: boolean };
type Supplier = { id: string; name: string };
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
type Section = "stock" | "patients" | "users" | "settings";

export function ManagementDrawer({
  open,
  section,
  onClose,
  onOpen,
  canManage,
  canStockTake,
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
  const [countItem, setCountItem] = useState("");
  const [countActual, setCountActual] = useState("");
  const [countError, setCountError] = useState("");
  const [countSaved, setCountSaved] = useState("");
  const [countBusy, setCountBusy] = useState(false);
  const router = useRouter();
  const filteredPatients = useMemo(() => {
    const query = patientQuery.trim().toLowerCase();
    return query ? patients.filter((patient) => `${patient.name} ${patient.label}`.toLowerCase().includes(query)) : patients;
  }, [patientQuery, patients]);

  if (!open) return null;

  const title = {
    stock: "Stock & catalogue",
    patients: "Kennel management",
    users: "Staff access",
    settings: "Practice settings",
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
        <nav className="management-tabs" aria-label="Management sections">
          <button type="button" className={section === "stock" ? "active" : ""} onClick={() => onOpen("stock")}><Boxes size={16} />Stock</button>
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
                <button type="button" className={stockTab === "receive" ? "active" : ""} onClick={() => setStockTab("receive")}>Stock on hand</button>
                <button type="button" className={stockTab === "count" ? "active" : ""} onClick={() => setStockTab("count")}>Count stock</button>
                <button type="button" className={stockTab === "catalog" ? "active" : ""} onClick={() => setStockTab("catalog")}>Add catalogue item</button>
              </div>
              {stockTab === "receive" ? (
                <>
                  <div className="management-list">
                    {items.filter((item) => item.itemType !== "SERVICE").map((item) => (
                      <div className="management-row" key={item.key}>
                        <span><strong>{item.name}</strong><small>{item.detail || item.category}</small></span>
                        <b>{formatMoney(item.price)}</b>
                      </div>
                    ))}
                    {!items.some((item) => item.itemType !== "SERVICE") ? <p className="management-empty">No stock items in the catalogue yet.</p> : null}
                  </div>
                  <details className="management-form-disclosure">
                    <summary>Receive medicine or product stock</summary>
                    <div className="management-form-stack">
                      <form action={receiveAction} className="management-form">
                        <input type="hidden" name="kind" value="MEDICATION" />
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
                    <button type="button" className={catalogType === "medication" ? "active" : ""} onClick={() => setCatalogType("medication")}>Medicine</button>
                    <button type="button" className={catalogType === "product" ? "active" : ""} onClick={() => setCatalogType("product")}>Food / accessory</button>
                    <button type="button" className={catalogType === "service" ? "active" : ""} onClick={() => setCatalogType("service")}>Service</button>
                  </div>
                  {!canManage ? <p className="management-empty">Only a Super Admin can change catalogue items.</p> : null}
                  {canManage && catalogType === "medication" ? (
                    <form action={saveMedicationAction} className="management-form">
                      <input type="hidden" name="active" value="on" />
                      <label className="field"><span>Medicine name</span><input name="name" required /></label>
                      <div className="grid-2">
                        <label className="field"><span>Category</span><input name="category" required /></label>
                        <label className="field"><span>Strength</span><input name="strength" /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Unit</span><input name="unit" defaultValue="dose" required /></label>
                        <label className="field"><span>Selling price</span><input name="sellingPrice" type="number" min="0" step="0.01" required /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Cost price</span><input name="costPrice" type="number" min="0" step="0.01" required /></label>
                        <label className="field"><span>Reorder level</span><input name="reorderLevel" type="number" min="0" step="any" defaultValue="0" required /></label>
                      </div>
                      <label className="field"><span>Supplier</span><select name="supplierId" defaultValue=""><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                      <button className="btn btn-primary" type="submit">Add medicine</button>
                    </form>
                  ) : null}
                  {canManage && catalogType === "product" ? (
                    <form action={saveProductAction} className="management-form">
                      <input type="hidden" name="active" value="on" />
                      <label className="field"><span>Product name</span><input name="name" required /></label>
                      <div className="grid-2">
                        <label className="field"><span>SKU</span><input name="sku" /></label>
                        <label className="field"><span>Category</span><select name="category">{PRODUCT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Cost price</span><input name="costPrice" type="number" min="0" step="0.01" required /></label>
                        <label className="field"><span>Selling price</span><input name="sellingPrice" type="number" min="0" step="0.01" required /></label>
                      </div>
                      <div className="grid-2">
                        <label className="field"><span>Reorder level</span><input name="reorderLevel" type="number" min="0" step="any" defaultValue="0" required /></label>
                        <label className="field"><span>Supplier</span><select name="supplierId" defaultValue=""><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                      </div>
                      <button className="btn btn-primary" type="submit">Add product</button>
                    </form>
                  ) : null}
                  {canManage && catalogType === "service" ? (
                    <form action={saveServiceAction} className="management-form">
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
        </div>
      </aside>
    </div>
  );
}
