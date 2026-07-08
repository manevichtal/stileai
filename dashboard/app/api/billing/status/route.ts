import { getProfileContext } from "@/lib/getProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getProfileContext();
  return new Response(JSON.stringify({ active: ctx?.subscriptionActive ?? false }), {
    headers: { "Content-Type": "application/json" },
  });
}
