import Link from "next/link";
import { LockButton } from "@/components/LockButton";
import { signOut } from "@/server/actions";
import { getSession } from "@/lib/session";
import { lanAddresses } from "@/lib/network";

const links = [
  ["/owners", "Owners"],
  ["/inventory", "Inventory"],
  ["/inventory/receive", "Receive stock"],
  ["/stock-take", "Stock take"],
  ["/sales", "Sales and receipts"],
  ["/reports", "Reports"],
  ["/sync", "Sync status"],
];

export default async function MorePage() {
  const session = await getSession();
  const ips = lanAddresses();
  return (
    <div>
      <h1>More</h1>
      <div className="list">
        {links.map(([href, label]) => (
          <Link key={href} href={href}><span className="row-title">{label}</span></Link>
        ))}
        <Link href="/notifications"><span className="row-title">{session?.role === "VET" ? "Client notices" : "Notices"}</span></Link>
        {session?.role === "SUPER_ADMIN" ? <Link href="/admin"><span className="row-title">Admin console</span></Link> : null}
      </div>
      <h2>This server</h2>
      <div className="list">
        {ips.length ? ips.map((ip) => (
          <div key={ip} className="row"><span className="stack"><span className="row-title">http://{ip}:3000</span><span className="row-meta">Open this on a tablet on the same Wi-Fi</span></span></div>
        )) : <div className="row"><span className="row-meta">No LAN address found.</span></div>}
      </div>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <LockButton />
        <form action={signOut}><button className="btn btn-block" type="submit">Sign out</button></form>
      </div>
    </div>
  );
}
