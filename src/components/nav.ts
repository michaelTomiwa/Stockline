import {
  ArrowLeftRight,
  BadgeCheck,
  Receipt,
  BarChart3,
  ClipboardCheck,
  History,
  LayoutGrid,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[]; multiStore?: boolean; key?: string };

/* Everyone except salespeople, who only sell and look things up. */
const STOCK_ROLES: Role[] = ["owner", "manager", "staff"];

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [{ href: "/app", label: "Overview", icon: LayoutGrid }] },
  {
    group: "Daily work",
    items: [
      { href: "/app/sell", label: "Sell", icon: ShoppingCart, key: "S" },
      { href: "/app/receive", label: "Receive stock", icon: PackagePlus, roles: STOCK_ROLES, key: "R" },
      { href: "/app/transfer", label: "Transfer", icon: ArrowLeftRight, roles: STOCK_ROLES, multiStore: true, key: "T" },
      { href: "/app/count", label: "Stock count", icon: ClipboardCheck, roles: ["owner", "manager"] },
    ],
  },
  {
    group: "Inventory",
    items: [
      { href: "/app/products", label: "Products", icon: Package },
      { href: "/app/stores", label: "Stores", icon: Store, roles: STOCK_ROLES },
      { href: "/app/suppliers", label: "Suppliers", icon: Truck, roles: STOCK_ROLES },
    ],
  },
  {
    group: "Records",
    items: [
      { href: "/app/movements", label: "Stock history", icon: History, roles: STOCK_ROLES },
      { href: "/app/movements", label: "My sales", icon: Receipt, roles: ["sales"] },
      { href: "/app/reports", label: "Reports", icon: BarChart3, roles: STOCK_ROLES },
    ],
  },
  {
    group: "Business",
    items: [
      { href: "/app/salespeople", label: "Salespeople", icon: BadgeCheck, roles: ["owner", "manager"] },
      { href: "/app/team", label: "Team", icon: Users, roles: ["owner"] },
      { href: "/app/settings", label: "Settings", icon: Settings, roles: ["owner"] },
    ],
  },
];

export function visibleNav(role: Role, storeCount: number) {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.roles || i.roles.includes(role)) && (!i.multiStore || storeCount > 1)),
  })).filter((g) => g.items.length > 0);
}
