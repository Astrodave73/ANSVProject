// app/api/scan/route.ts
import { NextResponse } from "next/server";
import { ScanService } from "@/lib/services/ScanService";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { qr, simulatorId }
    const data = await ScanService.scanByQr(body);
    return NextResponse.json(data);
  } catch (e: any) {
    const status = /not found/i.test(e.message)
      ? 404
      : /valid/i.test(e.message)
      ? 422
      : 400;
    return NextResponse.json({ error: e.message }, { status });
  }
}
