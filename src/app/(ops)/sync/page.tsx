import { checkSupabaseConnectionAction } from "@/server/actions";
import { checkSupabaseConnection } from "@/server/sync";

export default async function SyncPage() {
  const connection = await checkSupabaseConnection();
  return (
    <div>
      <h1>Sync status</h1>
      <div className="list">
        <div className="row"><span className="stack"><span className="row-title">Supabase</span><span className="row-meta">{connection.connected ? "Connected" : "Unavailable"}</span></span></div>
      </div>
      <p className="sub">{connection.message} Offline POS access and queued browser sales are not enabled yet.</p>
      <form action={async () => {
        "use server";
        await checkSupabaseConnectionAction();
      }}>
        <button className="btn btn-primary" type="submit">Check connection</button>
      </form>
    </div>
  );
}
