import {
  ArrowLeftRight,
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

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [{ href: "/app", label: "Overview", icon: LayoutGrid }] },
  {
    group: "Daily work",
    items: [
      { href: "/app/sell", label: "Sell", icon: ShoppingCart, key: "S" },
      { href: "/app/receive", label: "Receive stock", icon: PackagePlus, key: "R" },
      { href: "/app/transfer", label: "Transfer", icon: ArrowLeftRight, multiStore: true, key: "T" },
      { href: "/app/count", label: "Stock count", icon: ClipboardCheck, roles: ["owner", "manager"] },
    ],
  },
  {
    group: "Inventory",
    items: [
      { href: "/app/products", label: "Products", icon: Package },
      { href: "/app/stores", label: "Stores", icon: Store },
      { href: "/app/suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  {
    group: "Records",
    items: [
      { href: "/app/movements", label: "Stock history", icon: History },
      { href: "/app/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    group: "Business",
    items: [
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
