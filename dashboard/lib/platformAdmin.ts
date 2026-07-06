// Platform-owner ("master") access. A platform admin is YOU, the product owner —
// distinct from a tenant admin. Membership is driven by the PLATFORM_ADMIN_EMAILS
// env var (comma-separated, server-side only), NOT by anything a user can set, so
// no tenant can escalate themselves. This gate is used only by the /admin area,
// which reads across all orgs with the service role. Tenant RLS is untouched:
// normal admins still see only their own org.
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.trim().toLowerCase());
}
