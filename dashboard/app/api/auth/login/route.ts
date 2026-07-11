import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/login  <- { email, password }
// Powers the inline sign-in form on the marketing landing. Signs the user in with
// Supabase (setting the session cookie on the response), then tells the page to
// go to /dashboard. Same auth as the /login page — just a different entry point.
export async function POST(req: Request) {
  // Throttle sign-in attempts by source IP to blunt credential stuffing and
  // brute force. Supabase adds its own limits; this is the first line.
  const rl = await rateLimit(`login:${clientIp(req)}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
