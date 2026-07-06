import { requireProfileContext } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

// Shared shell for every authenticated page. The dark sidebar renders once here
// and stays put across navigation; only the content area swaps (see loading.tsx),
// which is what makes moving between pages feel instant.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireProfileContext();
  return (
    <AppShell orgName={ctx.orgName} email={ctx.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      {children}
    </AppShell>
  );
}
