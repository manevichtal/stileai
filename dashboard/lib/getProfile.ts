import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileContext = {
  userId: string;
  email: string | null;
  role: string;
  orgId: string;
  orgName: string;
};

// Loads the logged-in admin's profile + organization. Returns null if there is
// no session (the middleware normally redirects before we get here).
export async function getProfileContext(): Promise<ProfileContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, email, organizations(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "admin",
      orgId: "",
      orgName: "",
    };
  }

  const org = profile.organizations as unknown as { name: string } | null;
  return {
    userId: user.id,
    email: profile.email ?? user.email ?? null,
    role: profile.role,
    orgId: profile.org_id,
    orgName: org?.name ?? "",
  };
}

// For protected pages: returns the context or redirects to /login.
export async function requireProfileContext(): Promise<ProfileContext> {
  const ctx = await getProfileContext();
  if (!ctx) redirect("/login");
  return ctx;
}
