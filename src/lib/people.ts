import "server-only";
import type { Context } from "./context";

/* Map of user id → display name for "who did this" columns. */
export async function loadPeople(ctx: Context) {
  const { data } = await ctx.supabase.from("members").select("user_id, full_name, email");
  return new Map((data ?? []).map((m) => [m.user_id as string, (m.full_name || m.email || "Team member") as string]));
}
