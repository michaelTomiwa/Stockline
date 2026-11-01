/* Sizes and colours: each combination is its own product, named "Base · size · colour". */

export const splitList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

const sizeCode = (size: string) => size.toUpperCase().replace(/[^A-Z0-9]/g, "");
const colorCode = (color: string) => color.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

export function variantName(base: string, size?: string | null, color?: string | null) {
  return [base.trim(), size, color].filter(Boolean).join(" · ");
}

export function variantSku(base: string, size?: string | null, color?: string | null) {
  return [base.trim().toUpperCase(), size && sizeCode(size), color && colorCode(color)].filter(Boolean).join("-");
}

/* Every size × colour pair; either list may be empty. */
export function combos(sizes: string[], colors: string[]) {
  const s = sizes.length ? sizes : [null];
  const c = colors.length ? colors : [null];
  return s.flatMap((size) => c.map((color) => ({ size, color })));
}

/* The shared part of a variant's name and SKU, to add more sizes/colours to it. */
export function baseOf(p: { name: string; sku: string; size?: string | null; color?: string | null }) {
  let name = p.name;
  let sku = p.sku;
  for (const part of [p.color, p.size]) {
    if (part && name.endsWith(` · ${part}`)) name = name.slice(0, -` · ${part}`.length);
  }
  if (p.color && sku.endsWith(`-${colorCode(p.color)}`)) sku = sku.slice(0, -`-${colorCode(p.color)}`.length);
  if (p.size && sku.endsWith(`-${sizeCode(p.size)}`)) sku = sku.slice(0, -`-${sizeCode(p.size)}`.length);
  return { name, sku };
}
