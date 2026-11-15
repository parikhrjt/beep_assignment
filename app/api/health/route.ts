import { db, meta } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness + freshness. "stale" flips to true when the daily refresh has not landed for 36 h,
// which is what an uptime monitor should alert on (the site itself keeps serving yesterday's data).
export async function GET() {
  try {
    const n = (db().prepare("SELECT count(*) n FROM posts WHERE live = 1").get() as { n: number }).n;
    const last = meta<{ at: string; run_id: string }>("last_run");
    const age_h = last ? +((Date.now() - Date.parse(last.at)) / 36e5).toFixed(1) : null;
    const stale = age_h === null || age_h > 36;
    return Response.json({ ok: n > 0, posts: n, last_run: last?.run_id ?? null, data_age_hours: age_h, stale }, { status: n > 0 ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
