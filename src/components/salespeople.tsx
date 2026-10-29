"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Eye, EyeOff, KeyRound, MessageCircle, MoreHorizontal, Pencil, Power, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { Store } from "@/lib/types";
import { cn } from "@/lib/format";
import { Button, Drawer, ErrorNote, Field, SelectField, friendlyError, inputClass } from "./ui-client";

export type SalespersonInfo = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  store_id: string | null;
  phone: string | null;
  monthly_target: number | null;
  commission_rate: number;
  active: boolean;
};

type Credentials = { name: string; username: string; password: string; phone: string | null };

/* Easy to read out and type on a phone: three syllables and three digits, e.g. "tadoru284". */
function newPassword() {
  const c = "bdfgkmnprstvz";
  const v = "aeiou";
  const r = crypto.getRandomValues(new Uint32Array(9));
  let out = "";
  for (let i = 0; i < 3; i++) out += c[r[i * 2] % c.length] + v[r[i * 2 + 1] % v.length];
  return out + String(r[6] % 1000).padStart(3, "0");
}

function suggestUsername(name: string, store?: Store) {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const place = store?.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) ?? "";
  return [first, place].filter(Boolean).join(".");
}

/* The message an owner sends a new salesperson. */
function loginMessage(c: Credentials, businessName: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return [
    `Hi ${c.name.split(" ")[0]}, here's your Stockline login for ${businessName}:`,
    "",
    `Sign in: ${origin}/login`,
    `Username: ${c.username}`,
    `Password: ${c.password}`,
    "",
    "Keep it private. Every sale you record is credited to you.",
  ].join("\n");
}

function whatsappLink(text: string, phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function CredentialsCard({ creds, businessName, onDone }: { creds: Credentials; businessName: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = loginMessage(creds, businessName);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl bg-night p-5 text-white">
        <p className="text-sm text-white/60">Login for {creds.name}</p>
        <dl className="mt-3 space-y-2 font-mono text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Username</dt>
            <dd className="font-semibold text-citrus">{creds.username}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-white/50">Password</dt>
            <dd className="font-semibold text-citrus">{creds.password}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-white/50">They sign in on the normal sign-in page with this username. You won&rsquo;t see this password again, but you can always set a new one.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsappLink(text, creds.phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white hover:brightness-95"
        >
          <MessageCircle size={17} /> Send on WhatsApp
        </a>
        <Button
          variant="secondary"
          className="h-11"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button onClick={onDone} className="w-full">
        Done
      </Button>
    </motion.div>
  );
}

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(true);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">Password</span>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            type={show ? "text" : "password"}
            minLength={6}
            required
            autoComplete="new-password"
            className={cn(inputClass, "pr-10 font-mono")}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button type="button" onClick={() => onChange(newPassword())} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line hover:bg-sunk" aria-label="Make a new password">
          <RefreshCw size={16} />
        </button>
      </div>
      <span className="mt-1 block text-xs text-faint">At least 6 characters. We made one that&rsquo;s easy to type.</span>
    </label>
  );
}

function SalespersonForm({
  person,
  stores,
  allowAllStores,
  defaultStore,
  businessName,
  onClose,
}: {
  person?: SalespersonInfo;
  stores: Store[];
  allowAllStores: boolean;
  defaultStore?: string;
  businessName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = !!person;
  const [name, setName] = useState(person?.full_name ?? "");
  const [storeId, setStoreId] = useState(person ? (person.store_id ?? "") : (defaultStore ?? stores[0]?.id ?? ""));
  const [username, setUsername] = useState("");
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [password, setPassword] = useState(() => newPassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  const store = stores.find((s) => s.id === storeId);
  const shownUsername = touchedUsername ? username : suggestUsername(name, store);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const phone = String(f.get("phone") ?? "").trim();
    const target = Number(f.get("monthly_target") || 0);
    const rate = Number(f.get("commission_rate") || 0);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const common = {
      p_full_name: name.trim(),
      p_store: storeId || null,
      p_phone: phone || null,
      p_monthly_target: target || null,
      p_commission_rate: rate,
    };
    const { error } = person
      ? await supabase.rpc("update_salesperson", { p_user: person.user_id, ...common })
      : await supabase.rpc("create_salesperson", { ...common, p_username: shownUsername, p_password: password });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    router.refresh();
    if (editing) return onClose();
    setCreds({ name: name.trim(), username: shownUsername.trim().toLowerCase(), password, phone: phone || null });
  }

  if (creds) return <CredentialsCard creds={creds} businessName={businessName} onDone={onClose} />;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Tolu Adebayo" />
      <SelectField label="Works at" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
        {allowAllStores && <option value="">All stores</option>}
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      {!editing && (
        <>
          <Field
            label="Username"
            value={shownUsername}
            onChange={(e) => {
              setTouchedUsername(true);
              setUsername(e.target.value.toLowerCase().replace(/\s+/g, "."));
            }}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9][a-z0-9._\-]{2,29}"
            autoCapitalize="none"
            spellCheck={false}
            className="[&_input]:font-mono"
            hint="What they type to sign in. Letters, numbers, dots and dashes."
          />
          <PasswordInput value={password} onChange={setPassword} />
        </>
      )}
      <Field label="Phone (WhatsApp)" name="phone" type="tel" defaultValue={person?.phone ?? ""} placeholder="0803 000 0000" hint="Optional. Lets you send them their login on WhatsApp." />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly target (₦)" name="monthly_target" type="number" min={0} step={1000} defaultValue={person?.monthly_target ?? ""} placeholder="e.g. 1500000" />
        <Field label="Commission (%)" name="commission_rate" type="number" min={0} max={100} step={0.5} defaultValue={person?.commission_rate ?? ""} placeholder="e.g. 2.5" />
      </div>
      <ErrorNote message={error} />
      <Button busy={busy} className="h-11 w-full">
        {editing ? "Save changes" : (
          <>
            <UserPlus size={16} /> Create account
          </>
        )}
      </Button>
    </form>
  );
}

export function AddSalespersonButton({
  stores,
  allowAllStores,
  defaultStore,
  businessName,
  className,
}: {
  stores: Store[];
  allowAllStores: boolean;
  defaultStore?: string;
  businessName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <UserPlus size={16} /> Add salesperson
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New salesperson">
        {open && (
          <SalespersonForm stores={stores} allowAllStores={allowAllStores} defaultStore={defaultStore} businessName={businessName} onClose={() => setOpen(false)} />
        )}
      </Drawer>
    </>
  );
}

function ResetPassword({ person, businessName, onClose }: { person: SalespersonInfo; businessName: string; onClose: () => void }) {
  const [password, setPassword] = useState(() => newPassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <CredentialsCard
        creds={{ name: person.full_name ?? person.username ?? "", username: person.username ?? "", password, phone: person.phone }}
        businessName={businessName}
        onDone={onClose}
      />
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error } = await createClient().rpc("set_salesperson_password", { p_user: person.user_id, p_password: password });
        setBusy(false);
        if (error) return setError(friendlyError(error.message));
        setDone(true);
      }}
    >
      <p className="text-[15px] text-muted">
        Set a new password for <span className="font-semibold text-ink">{person.full_name}</span>. Their username stays{" "}
        <span className="font-mono text-ink">{person.username}</span>.
      </p>
      <PasswordInput value={password} onChange={setPassword} />
      <ErrorNote message={error} />
      <Button busy={busy} className="h-11 w-full">
        <KeyRound size={16} /> Set new password
      </Button>
    </form>
  );
}

/* Edit / reset password / turn off / remove, as a menu (list rows) or a button row (detail page). */
export function SalespersonActions({
  person,
  stores,
  allowAllStores,
  businessName,
  layout = "menu",
}: {
  person: SalespersonInfo;
  stores: Store[];
  allowAllStores: boolean;
  businessName: string;
  layout?: "menu" | "buttons";
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<"edit" | "password" | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function toggleActive() {
    setMenu(false);
    if (person.active && !confirm(`Turn off ${person.full_name}'s account? They'll be signed out and can't sign in until you turn it back on. Their sales stay on record.`)) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("set_salesperson_active", { p_user: person.user_id, p_active: !person.active });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    router.refresh();
  }

  async function remove() {
    setMenu(false);
    if (!confirm(`Delete ${person.full_name}'s account for good?`)) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("delete_salesperson", { p_user: person.user_id });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    router.push("/app/salespeople");
    router.refresh();
  }

  const items = [
    { label: "Edit details", icon: Pencil, run: () => { setMenu(false); setPanel("edit"); } },
    { label: "Reset password", icon: KeyRound, run: () => { setMenu(false); setPanel("password"); } },
    { label: person.active ? "Turn off account" : "Turn account back on", icon: Power, run: toggleActive },
    { label: "Delete", icon: Trash2, run: remove, danger: true },
  ];

  const drawers = (
    <>
      <Drawer open={panel === "edit"} onClose={() => setPanel(null)} title={`Edit ${person.full_name ?? "salesperson"}`}>
        {panel === "edit" && (
          <SalespersonForm person={person} stores={stores} allowAllStores={allowAllStores} businessName={businessName} onClose={() => setPanel(null)} />
        )}
      </Drawer>
      <Drawer open={panel === "password"} onClose={() => setPanel(null)} title="Reset password">
        {panel === "password" && <ResetPassword person={person} businessName={businessName} onClose={() => setPanel(null)} />}
      </Drawer>
    </>
  );

  if (layout === "buttons") {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className={cn("flex flex-wrap gap-2", busy && "opacity-60")}>
          {items.slice(0, 3).map((it) => (
            <Button key={it.label} variant="secondary" onClick={it.run} disabled={busy}>
              <it.icon size={16} /> {it.label}
            </Button>
          ))}
          <Button variant="danger" onClick={remove} disabled={busy} aria-label="Delete account">
            <Trash2 size={16} />
          </Button>
        </div>
        <ErrorNote message={error} />
        {drawers}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          setMenu((m) => !m);
        }}
        className={cn("grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink", busy && "opacity-50")}
        aria-label={`Options for ${person.full_name}`}
        aria-expanded={menu}
      >
        <MoreHorizontal size={18} />
      </button>
      <AnimatePresence>
        {menu && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-xl"
          >
            {items.map((it) => (
              <li key={it.label}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    it.run();
                  }}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunk", it.danger && "text-out")}
                >
                  <it.icon size={15} /> {it.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {error && <p className="absolute right-0 top-10 z-20 w-64 rounded-lg bg-panel p-2 text-xs text-out shadow-lg">{error}</p>}
      {drawers}
    </div>
  );
}

/* Progress toward a monthly target; the marker shows where they "should" be by today. */
export function TargetBar({ pct, expectedPct, className }: { pct: number | null; expectedPct?: number; className?: string }) {
  if (pct === null) return <p className={cn("text-xs text-faint", className)}>No target set</p>;
  const shown = Math.min(100, pct);
  const tone = pct >= 100 ? "bg-ok" : expectedPct !== undefined && pct < expectedPct * 0.8 ? "bg-low" : "bg-pine";
  return (
    <div className={cn("relative h-2 rounded-full bg-sunk", className)}>
      <motion.div
        className={cn("h-full rounded-full", tone)}
        initial={{ width: 0 }}
        whileInView={{ width: `${shown}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      {expectedPct !== undefined && expectedPct < 100 && (
        <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/30" style={{ left: `${expectedPct}%` }} title="Where they'd be at an even pace" />
      )}
    </div>
  );
}

/* Big ring for a salesperson's own target. */
export function TargetRing({ pct, size = 132 }: { pct: number | null; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = Math.min(100, pct ?? 0);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#eef1ea" strokeWidth="11" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={(pct ?? 0) >= 100 ? "#2f855a" : "#1f5f4a"}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - shown / 100) }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
