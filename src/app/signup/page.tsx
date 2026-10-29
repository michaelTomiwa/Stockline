import { AuthFrame } from "@/components/auth/auth-frame";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthFrame title="Set up your business" subtitle="Free to start. Add your stores and products in minutes.">
      <SignupForm />
    </AuthFrame>
  );
}
