"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className={
        className ??
        "font-mono text-[11.5px] text-ink3 hover:text-slate transition-colors"
      }
    >
      {children ?? "Sign out"}
    </button>
  );
}
