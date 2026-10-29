import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "New password" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame title="Choose a new password" subtitle="You'll stay signed in afterwards.">
      <ResetPasswordForm />
    </AuthFrame>
  );
}
