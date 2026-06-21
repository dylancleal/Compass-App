import type { CompassDB } from "./types";
import { LocalDB } from "./local";
import { SupabaseDB } from "./supabase";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

// Pick the backend. Local-first by default. To switch to cloud sync, set
// NEXT_PUBLIC_DATA_BACKEND=supabase and provide the Supabase env vars.
function pick(): CompassDB {
  const wantSupabase = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";
  if (wantSupabase && isSupabaseConfigured()) return new SupabaseDB();
  return new LocalDB();
}

export const db: CompassDB = pick();
export type { CompassDB } from "./types";
