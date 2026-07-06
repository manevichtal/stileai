"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type SignUpResult = { ok: true } | { ok: false; error: string };

// Onboards a brand-new admin: creates the auth user (email pre-confirmed so they
// can log in immediately), a fresh organization, its default policy settings,
// and a profile linking the user to that org as admin. Runs entirely server-side
// with the service role, because a user with no org yet cannot pass the RLS
// checks that gate these tables. After this returns ok, the client signs in.
export async function signUpAction(
  email: string,
  password: string,
  orgName: string,
): Promise<SignUpResult> {
  email = email.trim().toLowerCase();
  orgName = orgName.trim();
  if (!email || !password || !orgName) {
    return { ok: false, error: "Email, password, and organization name are all required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const admin = createAdminClient();

  // 1. Create the auth user (pre-confirmed).
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created?.user) {
    return { ok: false, error: userErr?.message ?? "Could not create the user." };
  }
  const userId = created.user.id;

  // 2. Create the organization.
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: orgName })
    .select("id")
    .single();
  if (orgErr || !org) {
    await admin.auth.admin.deleteUser(userId); // roll back the orphaned user
    return { ok: false, error: orgErr?.message ?? "Could not create the organization." };
  }

  // 3. Default policy settings for the org (fail-safe: require approval).
  const { error: settingsErr } = await admin
    .from("org_policy_settings")
    .insert({ org_id: org.id });
  if (settingsErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: settingsErr.message };
  }

  // 4. Profile linking user -> org as admin.
  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    org_id: org.id,
    role: "admin",
    email,
  });
  if (profileErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileErr.message };
  }

  return { ok: true };
}
