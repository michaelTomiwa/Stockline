"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { STORE_COOKIE } from "@/lib/context";

export async function setActiveStore(storeId: string) {
  (await cookies()).set(STORE_COOKIE, storeId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/app", "layout");
}
