import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { error } = await supabaseAdmin().from("organizations").select("id").limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) throw error;
    return NextResponse.json({ ok: true, mode: "online" });
  } catch {
    return NextResponse.json({ ok: false, mode: "offline" }, { status: 503 });
  }
}
