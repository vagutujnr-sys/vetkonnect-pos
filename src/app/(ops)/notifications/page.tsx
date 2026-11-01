import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { actor } from "@/server/actor";

export default async function NotificationsPage() {
  const user = await actor();
  const { data, error } = await supabaseAdmin().from("notifications").select("*")
    .eq("organization_id", user.organizationId).eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(40);
  throwDatabaseError(error);
  const notes = fromDatabase<{ id: string; title: string; body: string; readAt: Date | null; createdAt: Date }[]>(data ?? []);
  return (
    <div>
      <h1>Notices</h1>
      <p className="sub">New clients for the vets, and completed bills for reception.</p>
      <div className="list">
        {notes.map((note) => (
          <Link key={note.id} href={`/notifications/${note.id}`}>
            <span className="stack">
              <span className="row-title">{note.title}{note.readAt ? "" : " · New"}</span>
              <span className="row-meta">{note.body}</span>
              <span className="row-meta">{formatDateTime(note.createdAt)}</span>
            </span>
          </Link>
        ))}
        {notes.length === 0 ? <div className="row"><span className="row-meta">No notices yet.</span></div> : null}
      </div>
    </div>
  );
}
