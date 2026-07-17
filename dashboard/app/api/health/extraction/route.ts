import { orgForKey } from "@/lib/aiGate";

// POST /api/health/extraction — an operational health beacon from the browser
// extension. It fires when the extension matched a real "send" endpoint but could
// not extract a user message, which almost always means the AI vendor changed
// their request shape. We log it (no prompt content, ever) so StileAI notices and
// fixes the extractor before coverage silently drops for that site.
//
// Set up an alert on the "extraction_miss" log line (see docs/hardening.md).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // Resolve to an org so anonymous noise can't flood the logs; return 204 either
  // way so this never reveals whether a key is valid.
  const orgId = key ? await orgForKey(key) : null;
  if (!orgId) return new Response(null, { status: 204 });

  let site = "unknown";
  let extVersion = "";
  try {
    const b = await req.json();
    site = String(b?.site ?? "unknown").slice(0, 40);
    extVersion = String(b?.v ?? "").slice(0, 20);
  } catch {
    /* empty/invalid body is fine */
  }

  console.warn(
    JSON.stringify({ evt: "extraction_miss", orgId, site, extVersion, ts: new Date().toISOString() }),
  );
  return new Response(null, { status: 204 });
}
