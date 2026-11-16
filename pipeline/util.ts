import { createHash } from "node:crypto";

export const UA = "BeepJobsBot/1.0 (+https://github.com/vinitpatil519/beep-jobs; polite; daily)";
export const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON with timeout, retries, exponential backoff + jitter, and Retry-After support. */
export async function getJSON<T = any>(url: string, opts: { retries?: number; timeoutMs?: number } = {}): Promise<T | null> {
  const { retries = 3, timeoutMs = 25_000 } = opts;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 404 || r.status === 410) return null; // board gone: not an error worth retrying
      if (r.status === 429 || r.status >= 500) {
        const ra = Number(r.headers.get("retry-after"));
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 2 ** attempt * 800 + Math.random() * 400);
        continue;
      }
      if (!r.ok) return null;
      return (await r.json()) as T;
    } catch {
      await sleep(2 ** attempt * 800 + Math.random() * 400);
    }
  }
  throw new Error(`GET failed after retries: ${url}`);
}

/** Bounded-concurrency map. Keeps us polite to upstream APIs. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "-", mdash: "-", bull: "*", hellip: "..." };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });

/** HTML (possibly entity-escaped HTML, as Greenhouse returns) -> compact plain text. */
export function htmlToText(html: string): string {
  let s = html || "";
  if (/&lt;\w/.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(s).replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/** Canonical form for receipt verification and hashing: lowercase, unify quotes/dashes, collapse whitespace. */
export const canon = (s: string) =>
  s.toLowerCase().replace(/[‘’“”"'`]/g, "'").replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();

export const today = () => new Date().toISOString().slice(0, 10);
