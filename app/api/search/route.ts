import { parseParams, search } from "@/lib/search";

export const runtime = "nodejs";

// Data is immutable per deployment (the DB ships inside it), so every response is safely cacheable at the CDN.
// A new daily deploy invalidates the whole cache atomically. Most requests never reach this function.
const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

// Per-instance token bucket: protects the LLM fallback from a single abusive client.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now(), h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return false; }
  return ++h.n > 120;
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (limited(ip)) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "60" } });
  try {
    const r = await search(parseParams(new URL(req.url).searchParams));
    return Response.json(r, { headers: { "cache-control": CACHE, "server-timing": `db;dur=${r.took_ms}` } });
  } catch (e) {
    console.error("search_failed", e);
    return Response.json({ error: "search_failed" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
