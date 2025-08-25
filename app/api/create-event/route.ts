// app/api/create-event/route.ts
import { NextResponse } from "next/server";
import { EventRepo } from "@/lib/repositories/supabaseR/EventRepo";
import { EventService } from "@/lib/services/EventService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const service = new EventService(new EventRepo());
    const data = await service.create(body);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
