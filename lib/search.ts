import { db } from "./db.ts";
import { understandLLM, understandRules, type Understood } from "./understand.ts";

export type Filters = { q: string; roles: string[]; cities: string[]; verdict: string[]; mode?: string; employment?: string; source?: string; trust?: string; sort: "relevance" | "newest"; page: number; rejected: boolean; nlu: boolean };
export type Hit = {
  id: string; title: string; company: string; role: string; cities: string[]; verdict: string; min_exp: number | null; work_mode: string; employment: string;
  skills: string[]; pay: string | null; location_raw: string; url: string; apply_url: string; source: string; posted_at: string; first_seen: string;
  trust: string; receipts: { role: { quote: string; ok: boolean }; city: { quote: string; ok: boolean }; exp: { quote: string; ok: boolean } }; tagger: string; model: string; prompt_v: string; dup_count: number; snippet?: string;
};
export type SearchResult = { relaxed: string[]; total: number; page: number; pages: number; hits: Hit[]; facets: { role: Record<string, number>; city: Record<string, number>; verdict: Record<string, number>; employment: Record<string, number>; mode: Record<string, number> }; understood: Understood; took_ms: number };

export const PAGE_SIZE = 24;
const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) : []);

export function parseParams(sp: URLSearchParams): Filters {
  return {
    q: (sp.get("q") || "").slice(0, 200).trim(), roles: list(sp.get("role")), cities: list(sp.get("city")), verdict: list(sp.get("verdict")),
    mode: sp.get("mode") || undefined, employment: sp.get("type") || undefined, source: sp.get("source") || undefined, trust: sp.get("trust") || undefined,
    sort: sp.get("sort") === "newest" ? "newest" : "relevance", page: Math.max(1, Math.min(200, Number(sp.get("page")) || 1)), rejected: sp.get("rejected") === "1", nlu: sp.get("nlu") !== "0",
  };
}

// User text never reaches FTS5 syntax: every token is quoted, so there is no query injection surface.
const ftsExpr = (terms: string[], op: "AND" | "OR") => terms.map((t) => `"${t.replace(/"/g, "")}"*`).join(` ${op} `);
const row = (r: any): Hit => ({ ...r, cities: JSON.parse(r.cities), skills: JSON.parse(r.skills), receipts: JSON.parse(r.receipts) });

function run(f: Filters, u: Understood, op: "AND" | "OR") {
  const where: string[] = [f.rejected ? "p.live = 0" : "p.live = 1"];
  const args: (string | number)[] = [];
  const inList = (col: string, xs: string[]) => { where.push(`${col} IN (${xs.map(() => "?").join(",")})`); args.push(...xs); };
  const roles = [...new Set([...f.roles, ...u.roles])], cities = [...new Set([...f.cities, ...u.cities])];
  const verdict = f.verdict.length ? f.verdict : u.verdict ? [u.verdict] : [];
  const mode = f.mode || u.mode, employment = f.employment || u.employment;
  if (roles.length) inList("p.role", roles);
  if (verdict.length) inList("p.verdict", verdict);
  if (mode) { where.push(mode === "remote" ? "(p.work_mode = 'remote' OR EXISTS (SELECT 1 FROM post_city c WHERE c.rid = p.rid AND c.city = 'Remote'))" : "p.work_mode = ?"); if (mode !== "remote") args.push(mode); }
  if (employment) { where.push("p.employment = ?"); args.push(employment); }
  if (f.source) { where.push("p.source = ?"); args.push(f.source); }
  if (f.trust) { where.push("p.trust = ?"); args.push(f.trust); }
  if (cities.length) { where.push(`EXISTS (SELECT 1 FROM post_city c WHERE c.rid = p.rid AND c.city IN (${cities.map(() => "?").join(",")}))`); args.push(...cities); }
  const hasText = u.terms.length > 0;
  const from = hasText ? "fts JOIN posts p ON p.rid = fts.rowid" : "posts p";
  if (hasText) { where.unshift("fts MATCH ?"); args.unshift(ftsExpr(u.terms, op)); }
  const W = where.join(" AND ");
  const d = db();
  const total = (d.prepare(`SELECT count(*) n FROM ${from} WHERE ${W}`).get(...args) as { n: number }).n;
  const order = hasText && f.sort === "relevance" ? "bm25(fts, 8.0, 4.0, 3.0, 3.0, 3.0, 1.0), p.posted_at DESC" : "p.posted_at DESC, p.rid";
  const snip = hasText ? ", snippet(fts, 5, '[[', ']]', ' … ', 18) AS snippet" : "";
  const hits = d.prepare(`SELECT p.id,p.title,p.company,p.role,p.cities,p.verdict,p.min_exp,p.work_mode,p.employment,p.skills,p.pay,p.location_raw,p.url,p.apply_url,p.source,p.posted_at,p.first_seen,p.trust,p.receipts,p.tagger,p.model,p.prompt_v,p.dup_count${snip}
    FROM ${from} WHERE ${W} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(f.page - 1) * PAGE_SIZE}`).all(...args).map(row);
  const facet = (sql: string) => Object.fromEntries((d.prepare(sql).all(...args) as { k: string; n: number }[]).map((r) => [r.k, r.n]));
  const facets = {
    role: facet(`SELECT p.role k, count(*) n FROM ${from} WHERE ${W} GROUP BY 1 ORDER BY 2 DESC`),
    city: facet(`SELECT c2.city k, count(*) n FROM ${from} JOIN post_city c2 ON c2.rid = p.rid WHERE ${W} GROUP BY 1 ORDER BY 2 DESC`),
    verdict: facet(`SELECT p.verdict k, count(*) n FROM ${from} WHERE ${W} GROUP BY 1`),
    employment: facet(`SELECT p.employment k, count(*) n FROM ${from} WHERE ${W} GROUP BY 1`),
    mode: facet(`SELECT p.work_mode k, count(*) n FROM ${from} WHERE ${W} GROUP BY 1`),
  };
  return { total, hits, facets };
}

export async function search(f: Filters): Promise<SearchResult> {
  const t0 = performance.now();
  const literal: Understood = { cities: [], roles: [], terms: f.q.toLowerCase().replace(/[^\p{L}\p{N}+#. ]/gu, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 8), via: "none" };
  let u = f.nlu && f.q ? understandRules(f.q) : literal;
  u.terms = u.terms.slice(0, 8);
  let r = run(f, u, "AND");
  // L2: rules could not make the query work -> ask the LLM once (bounded by a 2.5 s timeout), keep whichever finds jobs.
  if (r.total === 0 && f.nlu && u.terms.length >= 1 && f.q.split(/\s+/).length >= 2) {
    const viaLLM = await understandLLM(f.q);
    if (viaLLM) { const r2 = run(f, viaLLM, "AND"); if (r2.total > 0) { r = r2; u = viaLLM; } }
  }
  // Relaxation ladder: never show an empty page when a looser version of the same intent has jobs.
  // Each step is reported back so the UI can say exactly what it dropped.
  const relaxed: string[] = [];
  if (r.total === 0 && u.terms.length > 1) { const r2 = run(f, u, "OR"); if (r2.total) { r = r2; relaxed.push("matching any keyword"); } }
  const steps: [string, (x: Understood) => Understood][] = [
    ["keywords", (x) => ({ ...x, terms: [] })],
    ["fresher-only", (x) => ({ ...x, verdict: undefined })],
    ["job type", (x) => ({ ...x, employment: undefined })],
    ["work mode", (x) => ({ ...x, mode: undefined })],
  ];
  let cur = u;
  for (const [label, fn] of steps) {
    if (r.total > 0) break;
    const nx = fn(cur);
    if (JSON.stringify(nx) === JSON.stringify(cur)) continue;
    cur = nx;
    const r2 = run(f, cur, "AND");
    relaxed.push(`without ${label}`);
    if (r2.total) r = r2;
  }
  if (!r.total) relaxed.length = 0;
  return { ...r, relaxed, page: f.page, pages: Math.max(1, Math.ceil(r.total / PAGE_SIZE)), understood: u, took_ms: +(performance.now() - t0).toFixed(1) };
}

export function getPost(id: string): (Hit & { text: string }) | null {
  const r = db().prepare("SELECT * FROM posts WHERE id = ?").get(id);
  return r ? (row(r) as Hit & { text: string }) : null;
}

/** Rules-only parse plus a live count, for the landing page examples. Never calls the LLM, so it cannot slow a page render. */
export function countRules(q: string): { q: string; u: Understood; total: number } {
  const u = understandRules(q);
  return { q, u, total: run(parseParams(new URLSearchParams()), u, "AND").total };
}
