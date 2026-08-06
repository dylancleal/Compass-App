import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseService";
import { getFreshGoogleToken } from "@/lib/googleTokens";
import { fetchGoogleCalendarList } from "@/lib/googleSync";

// Lists the calendars available on a Google connection, for the "pick your
// calendars" UI in ConnectionsPanel.tsx — separate from the sync itself,
// which resolves the same list server-side on every run.
export async function GET(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });

  const sb = getServiceSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await sb
    .from("calendar_connections")
    .select("user_id, provider, selected_calendar_ids")
    .eq("id", connectionId)
    .single();
  if (!conn || conn.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conn.provider !== "google") {
    return NextResponse.json({ error: "Not a Google connection" }, { status: 400 });
  }

  try {
    const accessToken = await getFreshGoogleToken(connectionId);
    const calendars = await fetchGoogleCalendarList(accessToken);
    const explicitPick = (conn.selected_calendar_ids as string[] | null) ?? null;

    return NextResponse.json({
      calendars: calendars.map((c) => ({
        id: c.id,
        name: c.primary ? `${c.name} (main calendar)` : c.name,
        primary: c.primary,
        // No explicit pick yet → default checked state mirrors what's
        // already shown in the user's own Google Calendar (same as what
        // the sync itself falls back to).
        checked: explicitPick ? explicitPick.includes(c.id) : c.primary || c.selectedInGoogle,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load calendars" }, { status: 500 });
  }
}
