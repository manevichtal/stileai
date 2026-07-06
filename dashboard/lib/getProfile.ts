import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platformAdmin";

export type ProfileContext = {
  userId: string;
  email: string | null;
  role: string;
  orgId: string;
  orgName: string;
  isPlatformAdmin: boolean;
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
      isPlatformAdmin: isPlatformAdmin(user.email),
    };
  }

  const org = profile.organizations as unknown as { name: string } | null;
  const email = profile.email ?? user.email ?? null;
  return {
    userId: user.id,
    email,
    role: profile.role,
    orgId: profile.org_id,
    orgName: org?.name ?? "",
    isPlatformAdmin: isPlatformAdmin(email),
  };
}

// For protected pages: returns the context or redirects to /login.
export async function requireProfileContext(): Promise<ProfileContext> {
  const ctx = await getProfileContext();
  if (!ctx) redirect("/login");
  return ctx;
}

// For the platform-owner /admin area: returns the context only if the caller is
// a platform admin, otherwise sends them back to their own dashboard.
export async function requirePlatformAdmin(): Promise<ProfileContext> {
  const ctx = await getProfileContext();
  if (!ctx) redirect("/login");
  if (!ctx.isPlatformAdmin) redirect("/");
  return ctx;
}
