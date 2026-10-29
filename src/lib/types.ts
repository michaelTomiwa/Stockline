export type Role = "owner" | "manager" | "staff" | "sales";

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", staff: "Staff", sales: "Salesperson" };

export type Member = {
  user_id: string;
  business_id: string;
  role: Role;
  store_id: string | null;
  full_name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  active: boolean;
  monthly_target: number | null;
  commission_rate: number;
  created_at: string;
};

/* Salespeople sign in with a username; Supabase needs an email, so this is it. */
export const STAFF_EMAIL_DOMAIN = "staff.stockline.invalid";
export const staffEmail = (username: string) => `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;

export type Store = { id: string; name: string; address: string | null; phone: string | null; color: string; archived: boolean };

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  reorder_level: number;
  archived: boolean;
};

export type Category = { id: string; name: string };
export type Supplier = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; notes: string | null };

export type MovementType = "receive" | "sale" | "return" | "transfer_out" | "transfer_in" | "adjust";

export type Movement = {
  id: string;
  store_id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  unit_cost: number | null;
  unit_price: number | null;
  batch_id: string;
  reference: string | null;
  reason: string | null;
  note: string | null;
  supplier_id: string | null;
  other_store_id: string | null;
  created_by: string | null;
  created_at: string;
};

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  receive: "Received",
  sale: "Sold",
  return: "Returned",
  transfer_out: "Sent",
  transfer_in: "Arrived",
  adjust: "Adjusted",
};

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(quantity: number, reorder: number): StockStatus {
  if (quantity <= 0) return "out";
  if (quantity <= reorder) return "low";
  return "ok";
}

/* numeric columns come back from PostgREST as strings */
export function num(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}
