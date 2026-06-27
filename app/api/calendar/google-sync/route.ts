import { NextResponse } from "next/server";
import { runGoogleSync } from "@/lib/googleSync";

export async function POST(request: Request) {
  let connectionId: string;
  try {
    const body = await request.json() as { connectionId?: string };
    connectionId = body.connectionId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  try {
    const result = await runGoogleSync(connectionId);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NEEDS_REAUTH") return NextResponse.json({ error: "NEEDS_REAUTH" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
