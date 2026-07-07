import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

// Generic error response for API routes. Logs the REAL error server-side with a
// short request id, and returns only that id + a generic message to the caller —
// so raw DB/internal error strings never leak to clients. Give the user the
// request_id to quote when reporting a problem.
export function apiError(e: unknown, status = 500) {
  const request_id = randomUUID().slice(0, 8);
  console.error(`[api-error ${request_id}]`, e);
  return NextResponse.json({ error: "internal error", request_id }, { status });
}
