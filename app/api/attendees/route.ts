// app/api/attendees/enroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  try {
    const { doc_number, qr_code, event_id } = await req.json();

    if (!event_id || (!doc_number && !qr_code)) {
      return NextResponse.json(
        { error: "event_id y (doc_number | qr_code) son requeridos" },
        { status: 400 }
      );
    }

    // 1) Resolver usuario (doc o QR)
    const userQ = qr_code
      ? await admin
          .from("users_table")
          .select("id, doc_number, qr_code, name, lastname")
          .eq("qr_code", qr_code)
          .maybeSingle()
      : await admin
          .from("users_table")
          .select("id, doc_number, qr_code, name, lastname")
          .eq("doc_number", doc_number)
          .maybeSingle();

    if (userQ.error || !userQ.data) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const user_id = userQ.data.id as number;

    // 2) Enrolar (idempotente por PK compuesta event_id,user_id)
    const ins = await admin.from("event_attendees").insert({ event_id, user_id }).single();
    if (ins.error) {
      const msg = String(ins.error.message ?? "");
      const code = (ins as any).error?.code;
      const isDup = code === "23505" || msg.includes("duplicate key");
      if (!isDup) return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    // 3) Confirmación básica
    return NextResponse.json({
      ok: true,
      user: { id: user_id, doc_number: userQ.data.doc_number, qr_code: userQ.data.qr_code, name: userQ.data.name, lastname: userQ.data.lastname },
      enrolled_event_id: event_id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado" }, { status: 500 });
  }
}
