"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Boxes, ChevronDown, ChevronLeft, ChevronRight, Grid2X2, Package, PawPrint, Pill, Search, ShoppingCart, Stethoscope, UserRound, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { checkoutAction } from "@/server/actions";
import { LocalStatus } from "./LocalStatus";
import { ManagementDrawer } from "./ManagementDrawer";

type Item = {
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
  searchText?: string;
  batches?: { id: string; batchNumber: string; onHand: number; expired: boolean; expiry: string }[];
};

type CartLine = {
  key: string;
  itemType: Item["itemType"] | "CUSTOM";
  itemId: string;
  batchId?: string;
  name: string;
  price: number;
  quantity: number;
  max?: number;
};

type PosCategory = { value: string; label: string };
type Subscription = { status: string; currentPeriodEnd: string | null } | null;

export function PosScreen({
  symbol,
  methods,
  items,
  patients,
  canCustom,
  userName,
  clinicName,
  canManage,
  categories,
  subscription,
  management,
}: {
  symbol: string;
  methods: string[];
  items: Item[];
  patients: { id: string; label: string; name?: string; ownerId: string | null }[];
  canCustom?: boolean;
  userName: string;
  clinicName: string;
  canManage: boolean;
  categories: PosCategory[];
  subscription: Subscription;
  management: {
    initialPanel?: "stock" | "patients" | "users" | "settings" | "categories";
    error?: string;
    saved?: boolean;
    owners: { id: string; fullName: string; mobile: string | null }[];
    patients: { id: string; name: string; label: string }[];
    canStockTake: boolean;
    staff: { id: string; name: string; role: string; active: boolean }[];
    suppliers: { id: string; name: string }[];
    settings: {
      clinicName: string;
      tagline: string;
      address: string;
      phone: string;
      email: string;
      currencySymbol: string;
      lockTimeoutMinutes: number;
      receiptFooter: string | null;
    } | null;
  };
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(0);
  const [patientId, setPatientId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [method, setMethod] = useState(methods.includes("Cash") ? "Cash" : methods.find((item) => item !== "VKWallet") ?? "Cash");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [customName, setCustomName] = useState("Consultation");
  const [customFee, setCustomFee] = useState("");
  const [drawerSection, setDrawerSection] = useState<"stock" | "patients" | "users" | "settings" | "categories">(management.initialPanel ?? "stock");
  const [drawerOpen, setDrawerOpen] = useState(Boolean(management.initialPanel));
  const [online, setOnline] = useState(true);
  const [saleError, setSaleError] = useState("");
  const [saleMessage, setSaleMessage] = useState("");
  const [receiptLink, setReceiptLink] = useState("");
  const [savingSale, setSavingSale] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkConnection() {
      if (!navigator.onLine) {
        if (active) setOnline(false);
        return;
      }
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (active) setOnline(response.ok);
      } catch {
        if (active) setOnline(false);
      }
    }
    const wentOnline = () => { void checkConnection(); };
    const wentOffline = () => setOnline(false);
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    void checkConnection();
    const timer = window.setInterval(checkConnection, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen && !cartDrawerOpen && !customOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setCartDrawerOpen(false);
        setCustomOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cartDrawerOpen, customOpen, drawerOpen]);

  useEffect(() => {
    if (category !== "ALL" && category !== "SERVICES" && !categories.some((item) => item.value === category)) {
      setCategory("ALL");
    }
  }, [categories, category]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        category === "ALL" ||
        (category === "SERVICES" && item.itemType === "SERVICE") ||
        (category !== "SERVICES" && item.itemType !== "SERVICE" && item.category === category);
      return matchesCategory && (!q || `${item.name} ${item.detail ?? ""} ${item.searchText ?? ""}`.toLowerCase().includes(q));
    });
  }, [category, items, query]);

  const pageCount = Math.max(1, Math.ceil(results.length / 8));
  const activePage = Math.min(page, pageCount - 1);
  const pageItems = results.slice(activePage * 8, activePage * 8 + 8);

  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const change = Number(received || 0) - total;

  async function checkout() {
    if (!online) {
      setSaleError("A connection is required to save this sale online.");
      return;
    }
    if (!Number.isFinite(Number(received)) || Number(received) < total) {
      setSaleError(`${method === "Cash" ? "Amount received" : "Amount paid"} must cover the total.`);
      setCartDrawerOpen(true);
      return;
    }
    setSaleError("");
    setSaleMessage("");
    setReceiptLink("");
    const printWindow = window.open("about:blank", "_blank");
    setSavingSale(true);
    try {
      const result = await checkoutAction({
        ownerId: ownerId || undefined,
        patientId: patientId || undefined,
        method,
        received: Number(received),
        reference,
        lines: cart.map((line) => ({
          itemType: line.itemType,
          itemId: line.itemId || undefined,
          batchId: line.batchId,
          quantity: line.quantity,
          name: line.itemType === "CUSTOM" ? line.name : undefined,
          unitPrice: line.itemType === "CUSTOM" ? line.price : undefined,
        })),
      });
      if (!result.ok) {
        printWindow?.close();
        setSaleError(result.error);
        return;
      }
      const receiptUrl = `/receipts/${result.saleId}?auto=1`;
      if (printWindow && !printWindow.closed) printWindow.location.href = receiptUrl;
      else setReceiptLink(`/receipts/${result.saleId}`);
      setSaleMessage(`Sale saved online · ${result.receiptNumber}. Receipt opened for printing.`);
      setCart([]);
      setReceived("");
      setReference("");
      setPatientId("");
      setOwnerId("");
      setCartDrawerOpen(false);
    } catch (checkoutError) {
      printWindow?.close();
      setSaleError(checkoutError instanceof Error ? checkoutError.message : "Could not save this sale online.");
    } finally {
      setSavingSale(false);
    }
  }

  function changeQty(key: string, next: number) {
    const line = cart.find((row) => row.key === key);
    if (!line) return;
    if (line.max != null && next > line.max) {
      setError(`Only ${line.max} left of ${line.name}.`);
      return;
    }
    setError("");
    setCart((lines) => {
      if (next <= 0) return lines.filter((row) => row.key !== key);
      return lines.map((row) => (row.key === key ? { ...row, quantity: next } : row));
    });
  }

  function add(item: Item) {
    setError("");
    if (item.itemType === "MEDICATION") {
      const batch = item.batches?.find((row) => !row.expired && row.onHand > 0);
      if (!batch) {
        setError(`${item.name} has no usable batch.`);
        return;
      }
      const key = `${item.itemId}-${batch.id}`;
      const existing = cart.find((line) => line.key === key);
      if (existing && existing.quantity + 1 > batch.onHand) {
        setError(`Only ${batch.onHand} left in batch ${batch.batchNumber}.`);
        return;
      }
      setCart((lines) => {
        const current = lines.find((line) => line.key === key);
        if (current) {
          return lines.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line));
        }
        return [
          ...lines,
          {
            key,
            itemType: item.itemType,
            itemId: item.itemId,
            batchId: batch.id,
            name: `${item.name} · ${batch.batchNumber}`,
            price: item.price,
            quantity: 1,
            max: batch.onHand,
          },
        ];
      });
      return;
    }
    if (item.itemType === "PRODUCT") {
      const max = item.stockOnHand ?? 0;
      const existing = cart.find((line) => line.key === item.key);
      if (existing && existing.quantity + 1 > max) {
        setError(`Only ${max} left of ${item.name}.`);
        return;
      }
      if (!existing && max <= 0) {
        setError(`${item.name} is out of stock.`);
        return;
      }
      setCart((lines) => {
        const current = lines.find((line) => line.key === item.key);
        if (current) return lines.map((line) => (line.key === item.key ? { ...line, quantity: line.quantity + 1 } : line));
        return [...lines, { key: item.key, itemType: item.itemType, itemId: item.itemId, name: item.name, price: item.price, quantity: 1, max }];
      });
      return;
    }
    setCart((lines) => {
      const existing = lines.find((line) => line.key === item.key);
      if (existing) return lines.map((line) => (line.key === item.key ? { ...line, quantity: line.quantity + 1 } : line));
      return [...lines, { key: item.key, itemType: item.itemType, itemId: item.itemId, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function addCustom() {
    const fee = Number(customFee);
    const name = customName.trim();
    if (!name) {
      setError("Name the consult.");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setError("Enter the consult fee.");
      return;
    }
    setError("");
    setCart((lines) => [
      ...lines,
      {
        key: `custom-${Date.now()}`,
        itemType: "CUSTOM",
        itemId: "",
        name,
        price: fee,
        quantity: 1,
      },
    ]);
    setCustomFee("");
    setCustomOpen(false);
  }

  const cartCount = cart.reduce((count, line) => count + line.quantity, 0);
  return (
    <div className="pos-screen">
      <div className="pos-toolbar">
        <div className="pos-brand">
          <img src="/vetkonnect-logo.png" alt="" />
          <span><strong>VetKonnect <b>POS</b></strong><small>{clinicName}</small></span>
        </div>
        <label className="pos-search">
          <Search size={19} aria-hidden="true" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search products, SKUs, or services..." aria-label="Search products and services" />
        </label>
        <Link href="/patients" className="pos-patient-link">
          <PawPrint size={17} aria-hidden="true" />
          <span>Kennel management</span>
        </Link>
        <div className="pos-toolbar-actions">
          <Link href="/notifications" className="pos-icon" title="Notifications" aria-label="Notifications"><Bell size={21} /></Link>
          <button
            type="button"
            className="pos-avatar"
            aria-label={`Open practice menu for ${userName}`}
            aria-expanded={drawerOpen}
            aria-controls="management-drawer"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <UserRound size={19} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ManagementDrawer
        open={drawerOpen}
        section={drawerSection}
        onClose={() => setDrawerOpen(false)}
        onOpen={(section) => { setDrawerSection(section); setDrawerOpen(true); }}
        canManage={canManage}
        canStockTake={management.canStockTake}
        categories={categories}
        subscription={subscription}
        items={items}
        patients={management.patients}
        owners={management.owners}
        staff={management.staff}
        suppliers={management.suppliers}
        settings={management.settings}
        error={management.error}
        saved={management.saved}
      />

      <nav className="pos-categories" aria-label="Product categories">
        <div className="pos-category-tabs">
          {[{ value: "ALL", label: "All" }, ...categories, { value: "SERVICES", label: "Services" }].map((tab) => (
            <button key={tab.value} type="button" className={category === tab.value ? "active" : ""} onClick={() => { setCategory(tab.value); setPage(0); }}>
              {tab.value === "ALL" ? <Grid2X2 size={17} aria-hidden="true" /> : tab.value === "SERVICES" ? <Stethoscope size={17} aria-hidden="true" /> : <Boxes size={17} aria-hidden="true" />}{tab.label}
            </button>
          ))}
        </div>
      </nav>

      {error ? <p className="banner danger pos-error">{error}</p> : null}
      {!online ? <p className="banner pos-error">Offline · sales must be saved online. Reconnect before taking payment.</p> : null}
      {saleError ? <p className="banner danger pos-error" role="alert">{saleError}</p> : null}
      {saleMessage ? <p className="banner ok pos-error" role="status">{saleMessage}</p> : null}
      {receiptLink ? <p className="banner ok pos-error" role="status">Sale saved. <Link href={receiptLink} target="_blank">Print receipt</Link></p> : null}

      <div className="pos-workspace">
        <section className="pos-catalog" aria-labelledby="pos-catalog-title">
          <header className="pos-catalog-head">
            <h1 id="pos-catalog-title">Products &amp; Services</h1>
            <span>{results.length} items</span>
          </header>
          <div className="pos-product-grid">
              {Array.from({ length: 8 }, (_, slot) => {
                const item = pageItems[slot];
                if (!item) return <div key={`empty-${slot}`} className="pos-product-empty" aria-hidden="true" />;
                const inCart = cart.filter((line) => line.itemId === item.itemId && line.itemType === item.itemType);
                const qty = inCart.reduce((sum, line) => sum + line.quantity, 0);
                const Icon = item.itemType === "SERVICE" ? Stethoscope : item.itemType === "MEDICATION" ? Pill : Package;
                return (
                  <button key={item.key} type="button" className="pos-product" onClick={() => add(item)}>
                    <span className={`product-art ${item.itemType.toLowerCase()}`}><Icon size={34} strokeWidth={1.7} aria-hidden="true" /></span>
                    <strong>{item.name}</strong>
                    <span className="product-price">{formatMoney(item.price, symbol)}</span>
                    <span className="product-meta">{qty ? `${qty} in order` : item.detail || item.category}</span>
                    {qty > 0 ? <span className="product-count">{qty}</span> : null}
                  </button>
                );
              })}
          </div>
          {results.length === 0 ? <p className="pos-no-results"><Package size={17} /> No matching items</p> : null}
          <nav className="pos-pagination" aria-label="Product pages">
            <button type="button" aria-label="Previous page" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}><ChevronLeft size={23} /></button>
            <span>{activePage + 1} / {pageCount}</span>
            <button type="button" aria-label="Next page" disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)}><ChevronRight size={23} /></button>
          </nav>
          {canCustom ? <button className="pos-custom-trigger" type="button" onClick={() => setCustomOpen(true)}>Custom service</button> : null}
        </section>

        <aside className={`pos-cart${cartDrawerOpen ? " drawer-open" : ""}`} aria-label="Current order">
          <header className="pos-cart-head">
            <button type="button" className="pos-cart-toggle" aria-expanded={cartDrawerOpen} aria-controls="pos-cart-details" onClick={() => setCartDrawerOpen((open) => !open)}>
              <span className="pos-cart-title"><ShoppingCart size={21} /><h2>Cart</h2></span>
              <span className="pos-cart-count">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
              <ChevronDown className="pos-cart-chevron" size={19} aria-hidden="true" />
            </button>
          </header>
          <div id="pos-cart-details" className={`pos-cart-details${cartDrawerOpen ? " open" : ""}`} onClick={(event) => {
            if (event.target === event.currentTarget) setCartDrawerOpen(false);
          }}>
            <div className="pos-cart-details-panel">
              <header className="pos-mobile-drawer-head">
                <h2>Order details</h2>
                <button type="button" aria-label="Close cart details" onClick={() => setCartDrawerOpen(false)}><X size={21} /></button>
              </header>
              <label className="pos-pet-select">
                <span>Client</span>
                <select value={ownerId} onChange={(event) => {
                  const nextOwnerId = event.target.value;
                  setOwnerId(nextOwnerId);
                  if (patientId && nextOwnerId && patients.find((patient) => patient.id === patientId)?.ownerId !== nextOwnerId) {
                    setPatientId("");
                  }
                }}>
                  <option value="">Walk-in / no client</option>
                  {management.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName}{owner.mobile ? ` · ${owner.mobile}` : ""}</option>)}
                </select>
              </label>
              <label className="pos-pet-select">
                <span>Pet info</span>
                <select value={patientId} onChange={(event) => {
                  const nextPatientId = event.target.value;
                  setPatientId(nextPatientId);
                  const nextPatient = patients.find((patient) => patient.id === nextPatientId);
                  if (nextPatient?.ownerId) setOwnerId(nextPatient.ownerId);
                }}>
                  <option value="">Walk-in / no patient</option>
                  {patients.filter((patient) => !ownerId || patient.ownerId === ownerId).map((patient) => <option key={patient.id} value={patient.id}>{patient.label}</option>)}
                </select>
              </label>
              <div className="pos-cart-lines">
                {cart.length ? cart.map((line) => (
                  <div key={line.key} className="cart-line">
                    <span className="stack"><span className="row-title">{line.name}</span><span className="row-meta">{formatMoney(line.price * line.quantity, symbol)}</span></span>
                    <span className="stepper">
                      <button type="button" aria-label={`Decrease ${line.name}`} onClick={() => changeQty(line.key, line.quantity - 1)}>−</button>
                      <b>{line.quantity}</b>
                      <button type="button" aria-label={`Increase ${line.name}`} onClick={() => changeQty(line.key, line.quantity + 1)}>+</button>
                    </span>
                  </div>
                )) : <p className="pos-cart-empty">Your order is empty.</p>}
              </div>
              <div className="pos-payment-details">
                <div className="seg pos-payment-methods" aria-label="Payment method">
                  {methods.map((item) => (
                    <button key={item} className={`${method === item ? "on" : ""}${item === "VKWallet" ? " disabled-method" : ""}`} type="button" disabled={item === "VKWallet"} aria-label={item === "VKWallet" ? "VKWallet, coming soon" : item} onClick={() => setMethod(item)}>
                      {item}{item === "VKWallet" ? <small>Coming soon</small> : null}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>{method === "Cash" ? "Amount received" : "Amount paid"}</span>
                  <input type="number" inputMode="decimal" min={total} step="0.01" value={received} onChange={(event) => setReceived(event.target.value)} required />
                </label>
                {method !== "Cash" ? (
                  <>
                    <label className="field"><span>{method} reference (optional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
                    <p className="payment-note">Record the EcoCash payment here. VetKonnect does not process the funds.</p>
                  </>
                ) : null}
                {method === "Cash" ? <div className="pos-change"><span>Change</span><strong>{formatMoney(Math.max(0, change), symbol)}</strong></div> : null}
              </div>
            </div>
          </div>
          <div className="pos-cart-bottom">
            <div className="pos-cart-summary">
              <div className="totals"><span>Total</span><span>{formatMoney(total, symbol)}</span></div>
            </div>
            <div className="pos-checkout-actions">
              <button className="pos-clear" type="button" title="Clear order" aria-label="Clear order" disabled={!cart.length} onClick={() => setCart([])}><span>Clear</span></button>
              <button className="btn btn-primary" type="button" disabled={savingSale || !online || !cart.length} onClick={() => void checkout()}>
                {savingSale ? "Saving…" : `Pay ${formatMoney(total, symbol)}`}
              </button>
            </div>
          </div>
        </aside>
      </div>
      {customOpen ? (
        <div className="pos-sheet-overlay" onClick={() => setCustomOpen(false)}>
          <section className="pos-custom-sheet" role="dialog" aria-modal="true" aria-labelledby="pos-custom-title" onClick={(event) => event.stopPropagation()}>
            <header className="pos-mobile-drawer-head">
              <h2 id="pos-custom-title">Custom service</h2>
              <button type="button" aria-label="Close custom service" onClick={() => setCustomOpen(false)}><X size={21} /></button>
            </header>
            <form onSubmit={(event) => { event.preventDefault(); addCustom(); }}>
              <label className="field"><span>Service name</span><input value={customName} onChange={(event) => setCustomName(event.target.value)} aria-label="Custom service name" placeholder="Service name" /></label>
              <label className="field"><span>Fee</span><input inputMode="decimal" value={customFee} onChange={(event) => setCustomFee(event.target.value)} aria-label="Custom service fee" placeholder="Fee" /></label>
              <button className="btn btn-primary" type="submit">Add to cart</button>
            </form>
          </section>
        </div>
      ) : null}
      <footer className="pos-footer"><LocalStatus /><span>A VetKonnect Integrated Service</span></footer>
    </div>
  );
}
