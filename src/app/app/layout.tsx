import { getContext } from "@/lib/context";
import { Shell } from "@/components/shell";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await getContext();
  const { data: isAdmin } = await ctx.supabase.rpc("is_platform_admin");
  return (
    <Shell
      business={ctx.business.name}
      person={ctx.member.full_name || ctx.user.email || "You"}
      role={ctx.member.role}
      stores={ctx.stores}
      activeStore={ctx.activeStore}
      isAdmin={isAdmin === true}
    >
      {children}
    </Shell>
  );
}
