import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  expired: "That link has expired. Sign in or request a new one.",
  "no-business": "This account isn't active. It may have been turned off, or not linked to a business yet. Ask the owner, or sign in with another account.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to see your stores.">
      {typeof error === "string" && errors[error] && <p className="mb-4 rounded-xl bg-out/8 px-3 py-2 text-sm text-out">{errors[error]}</p>}
      <LoginForm next={target} />
    </AuthFrame>
  );
}
