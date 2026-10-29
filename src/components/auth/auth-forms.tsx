"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button, ErrorNote, Field } from "../ui-client";

export function SignupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
        data: { full_name: String(f.get("full_name")).trim(), business_name: String(f.get("business_name") ?? "").trim() },
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (!data.session) return setSentTo(email);
    router.push("/app");
    router.refresh();
  }

  if (sentTo) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <MailCheck size={40} className="mx-auto text-pine" />
        <h2 className="mt-4 text-xl font-bold">Check your email</h2>
        <p className="mt-2 text-muted">
          We sent a link to <span className="font-medium text-ink">{sentTo}</span>. Open it to finish setting up.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name" name="full_name" autoComplete="name" required />
      <Field label="Business name" name="business_name" placeholder="e.g. Adunni's Stores" hint="Leave blank if you were invited by a business." />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <ErrorNote message={error} />
      <Button busy={busy} className="h-11 w-full">
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-pine hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    if (error) {
      setBusy(false);
      return setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
    }
    router.push(next);
    router.refresh();
  }

  async function forgot(form: HTMLFormElement | null) {
    const email = String(new FormData(form ?? undefined).get("email") ?? "").trim();
    if (!email) return setError("Type your email first, then choose “Forgot password?”.");
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) setError(error.message);
    else setNotice(`We sent a reset link to ${email}.`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <button type="button" onClick={(e) => forgot(e.currentTarget.form)} className="text-sm font-medium text-pine hover:underline">
        Forgot password?
      </button>
      <ErrorNote message={error} />
      {notice && <p className="text-sm text-ok">{notice}</p>}
      <Button busy={busy} className="h-11 w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-muted">
        New to Stockline?{" "}
        <Link href="/signup" className="font-semibold text-pine hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <ErrorNote message={error} />
      <Button busy={busy} className="h-11 w-full">
        Save new password
      </Button>
    </form>
  );
}
