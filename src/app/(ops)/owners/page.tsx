import Link from "next/link";
import { searchOwners } from "@/server/queries";

export default async function OwnersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const owners = await searchOwners(q);
  return (
    <div>
      <div className="page-head">
        <h1>Owners</h1>
        <Link className="btn btn-primary" href="/owners/new">Add</Link>
      </div>
      <form>
        <label className="field"><span>Name or mobile</span><input name="q" defaultValue={q} /></label>
      </form>
      <div className="list">
        {owners.map((owner) => (
          <Link key={owner.id} href={`/owners/${owner.id}`}>
            <span className="stack">
              <span className="row-title">{owner.fullName}</span>
              <span className="row-meta">{owner.mobile} · {owner._count.patients} animals</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
