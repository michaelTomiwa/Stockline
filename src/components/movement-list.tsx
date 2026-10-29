import Link from "next/link";
import { cn, dateTime, money, qty } from "@/lib/format";
import { MOVEMENT_LABEL, num, type Movement, type Product, type Store, type Supplier } from "@/lib/types";
import { StoreDot, td, th } from "./ui";

const tone: Record<string, string> = {
  receive: "bg-ok/10 text-ok",
  sale: "bg-pine/10 text-pine",
  return: "bg-ok/10 text-ok",
  transfer_out: "bg-move/10 text-move",
  transfer_in: "bg-move/10 text-move",
  adjust: "bg-low/12 text-low",
};

/* The ledger as a table. Used on product, store and history pages. */
export function MovementTable({
  rows,
  products,
  stores,
  suppliers,
  people,
  currency,
  hideProduct,
}: {
  rows: Movement[];
  products: Map<string, Product>;
  stores: Map<string, Store>;
  suppliers: Map<string, Supplier>;
  people: Map<string, string>;
  currency: string;
  hideProduct?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-sunk">
          <tr>
            <th className={th}>When</th>
            <th className={th}>What</th>
            {!hideProduct && <th className={th}>Product</th>}
            <th className={th}>Store</th>
            <th className={cn(th, "text-right")}>Qty</th>
            <th className={cn(th, "text-right")}>Value</th>
            <th className={th}>Details</th>
            <th className={th}>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const q = num(m.quantity);
            const p = products.get(m.product_id);
            const s = stores.get(m.store_id);
            const unit = m.type === "sale" || m.type === "return" ? num(m.unit_price) : num(m.unit_cost);
            const other = m.other_store_id ? stores.get(m.other_store_id)?.name : null;
            const detail = [
              m.type === "transfer_out" && other ? `To ${other}` : null,
              m.type === "transfer_in" && other ? `From ${other}` : null,
              m.supplier_id ? suppliers.get(m.supplier_id)?.name : null,
              m.reason,
              m.reference && m.reference !== "Sale" ? m.reference : null,
              m.note,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <tr key={m.id} className="border-t border-line">
                <td className={cn(td, "whitespace-nowrap text-muted")}>{dateTime(m.created_at)}</td>
                <td className={td}>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", tone[m.type])}>{MOVEMENT_LABEL[m.type]}</span>
                </td>
                {!hideProduct && (
                  <td className={td}>
                    {p ? (
                      <Link href={`/app/products/${p.id}`} className="font-medium hover:text-pine">
                        {p.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={cn(td, "whitespace-nowrap")}>
                  {s && (
                    <span className="flex items-center gap-2">
                      <StoreDot color={s.color} />
                      {s.name}
                    </span>
                  )}
                </td>
                <td className={cn(td, "text-right font-semibold tnum", q > 0 ? "text-ok" : "text-ink")}>
                  {q > 0 ? "+" : "−"}
                  {qty(Math.abs(q))}
                </td>
                <td className={cn(td, "text-right tnum text-muted")}>{unit ? money(Math.abs(q) * unit, currency) : "—"}</td>
                <td className={cn(td, "max-w-64 truncate text-muted")}>{detail || "—"}</td>
                <td className={cn(td, "whitespace-nowrap text-muted")}>{m.created_by ? people.get(m.created_by) ?? "—" : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
