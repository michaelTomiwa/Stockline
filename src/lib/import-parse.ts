/* Turn text pasted from Excel / Google Sheets (or a CSV file) into product rows. */

export type ImportRow = {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  size?: string;
  color?: string;
  cost?: number;
  price?: number;
  qty?: number;
  reorder?: number;
  barcode?: string;
};

type Field = keyof ImportRow;

const ALIASES: Record<Field, string[]> = {
  name: ["name", "product", "product name", "item", "item name", "description", "goods"],
  sku: ["sku", "code", "item code", "product code", "ref"],
  category: ["category", "type", "group", "department"],
  unit: ["unit", "uom"],
  size: ["size", "sizes"],
  color: ["colour", "color", "colours", "colors"],
  cost: ["cost", "cost price", "buying price", "purchase price", "cp", "unit cost"],
  price: ["price", "selling price", "sell price", "sp", "retail price", "sales price", "amount"],
  qty: ["qty", "quantity", "stock", "opening stock", "count", "in stock", "units"],
  reorder: ["reorder", "reorder level", "reorder at", "min", "minimum", "min stock"],
  barcode: ["barcode", "ean", "upc"],
};

/* When there's no header row, columns are read in this order. */
export const DEFAULT_ORDER: Field[] = ["name", "category", "size", "color", "cost", "price", "qty"];

const NUMERIC: Field[] = ["cost", "price", "qty", "reorder"];

function splitLine(line: string, delim: string) {
  if (delim === "\t") return line.split("\t");
  // CSV with quotes
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const toNumber = (s: string) => {
  const n = Number(s.replace(/[₦$£,\s]/g, "").replace(/^ngn/i, ""));
  return Number.isFinite(n) ? n : NaN;
};

export function parseImport(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [] as ImportRow[], columns: [] as (Field | null)[], problems: [] as string[], hasHeader: false };
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const cells = lines.map((l) => splitLine(l, delim).map((c) => c.trim()));

  // A header row is one where at least one cell is a known column name.
  const headerMap = cells[0].map((c) => {
    const n = norm(c);
    return (Object.keys(ALIASES) as Field[]).find((f) => ALIASES[f].includes(n)) ?? null;
  });
  const hasHeader = headerMap.some(Boolean);
  const columns: (Field | null)[] = hasHeader ? headerMap : cells[0].map((_, i) => DEFAULT_ORDER[i] ?? null);
  const body = hasHeader ? cells.slice(1) : cells;

  const problems: string[] = [];
  if (!columns.includes("name")) problems.push("No product name column found. Add a header called “Name”.");
  const rows: ImportRow[] = [];
  body.forEach((r, i) => {
    const row: Partial<Record<Field, string | number>> = {};
    columns.forEach((f, ci) => {
      if (!f) return;
      const v = (r[ci] ?? "").trim();
      if (v === "") return;
      if (NUMERIC.includes(f)) {
        const n = toNumber(v);
        if (Number.isNaN(n)) problems.push(`Row ${i + 1}: “${v}” isn't a number (${f}).`);
        else row[f] = n;
      } else row[f] = v;
    });
    if (row.name) rows.push(row as ImportRow);
    else if (r.some((c) => c.trim())) problems.push(`Row ${i + 1}: no product name, skipped.`);
  });
  return { rows, columns, problems, hasHeader };
}

export const TEMPLATE_CSV = [
  "Name,Category,Size,Colour,Cost,Price,Qty,SKU",
  "Men's leather loafers,Men's shoes,42,Brown,18000,28000,4,",
  "Men's leather loafers,Men's shoes,43,Brown,18000,28000,6,",
  "Ladies' tote bag,Bags,,Black,12000,20000,5,",
  "Men's boxers 3 pack,Underwear,L,,3500,6000,20,",
].join("\n");

export const FIELD_LABEL: Record<Field, string> = {
  name: "Name",
  sku: "SKU",
  category: "Category",
  unit: "Unit",
  size: "Size",
  color: "Colour",
  cost: "Cost",
  price: "Price",
  qty: "Qty",
  reorder: "Reorder at",
  barcode: "Barcode",
};
