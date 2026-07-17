// Minimal dependency-free load test. Hammers a URL at a fixed concurrency for a
// duration and reports throughput + latency percentiles. Use it to sanity-check
// the checkpoint under concurrent load before putting a big customer on it.
//
// Examples:
//   node scripts/loadtest.mjs --url https://stileai.com/api/health --conc 50 --secs 20
//   node scripts/loadtest.mjs --url https://stileai.com/api/inspect --conc 25 --secs 20 \
//        --key sk_stile_xxx --method POST \
//        --body '{"prompt":"summarize our Q3 revenue of $2.4M","site":"loadtest"}'
//
// Point it at a STAGING key/tenant, not a customer's, so the audit log and any
// AI-escalation budget are your own.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const URL = args.url;
if (!URL) { console.error("Pass --url <target>"); process.exit(1); }
const CONC = Number(args.conc || 25);
const SECS = Number(args.secs || 15);
const METHOD = (args.method || (args.body ? "POST" : "GET")).toUpperCase();
const KEY = args.key || "";
const BODY = args.body || "";

const headers = { "Content-Type": "application/json" };
if (KEY) headers["Authorization"] = "Bearer " + KEY;

const latencies = [];
let ok = 0, errors = 0, statusCounts = {};
const deadline = Date.now() + SECS * 1000;
let running = true;

async function worker() {
  while (running && Date.now() < deadline) {
    const t = Date.now();
    try {
      const res = await fetch(URL, { method: METHOD, headers, body: METHOD === "GET" ? undefined : BODY });
      await res.arrayBuffer();
      latencies.push(Date.now() - t);
      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
      if (res.ok) ok++; else errors++;
    } catch {
      errors++;
      latencies.push(Date.now() - t);
    }
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

console.log(`Load test: ${METHOD} ${URL}  conc=${CONC} for ${SECS}s`);
await Promise.all(Array.from({ length: CONC }, worker));
running = false;

const sorted = latencies.slice().sort((a, b) => a - b);
const total = ok + errors;
console.log(`\nRequests: ${total}  (${(total / SECS).toFixed(1)}/s)`);
console.log(`OK: ${ok}   Errors: ${errors}   Statuses: ${JSON.stringify(statusCounts)}`);
console.log(`Latency ms  p50=${pct(sorted, 50)}  p90=${pct(sorted, 90)}  p99=${pct(sorted, 99)}  max=${sorted[sorted.length - 1] ?? 0}`);
