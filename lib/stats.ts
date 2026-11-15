import { db, meta } from "./db.ts";
import type { Hit } from "./search.ts";

export type EvalSet = {
  set: string; at: string; model: string; prompt_v: string; n: number; labeled_by: string; human_verified: number; verified_by: string | null;
  llm: Record<string, Prop>; rules_baseline: Record<string, Prop>; by_source: Record<string, Record<string, Prop>>; by_trust: Record<string, Record<string, Prop>>;
  receipts: { quotes_checked: number; verbatim: number };
  cost: { in_tokens: number; out_tokens: number; calls: number; usd: number; per_1k_posts_usd: number; price: { in_per_m: number; out_per_m: number; as_of: string; source: string } };
  items: { id: string; source: string; title: string; company: string; location_raw: string; gold: { role: string; role_alt: string | null; cities: string[]; verdict: string | null }; pred: { role: string; cities: string[]; verdict: string }; rules: { role: string; cities: string[] }; receipts: Hit["receipts"]; trust: string; ok: { role: boolean; city: boolean; verdict: boolean | null } }[];
};
export type Prop = { k: number; n: number; acc: number | null; ci95: [number, number] };
export type Ledger = {
  run_id: string; at: string; duration_s: number; sources: Record<string, { boards: number; fetched: number; india: number; candidates: number; errors: number }>;
  candidates: number; after_dedupe: number; duplicates_removed: number;
  llm: { model: string; prompt_v: string; calls: number; posts_tagged: number; cache_hits: number; rules_fallback: number; in_tokens: number; out_tokens: number; cost_usd: number; cost_per_1k_usd: number | null };
  receipts: { verified: number; review: number }; verdicts: Record<string, number>; published: number; carried_over: number; expired: number;
};

// node:sqlite returns null-prototype rows; React Server Components only serialise plain objects.
const q = <T,>(sql: string, ...a: (string | number)[]) => db().prepare(sql).all(...a).map((r) => ({ ...r })) as T[];
const parse = (r: any): Hit => ({ ...r, cities: JSON.parse(r.cities), skills: JSON.parse(r.skills), receipts: JSON.parse(r.receipts) });

export function getStats() {
  const one = (sql: string) => (db().prepare(sql).get() as { n: number }).n;
  const last = meta<Ledger>("last_run");
  const runs = meta<Ledger[]>("runs") ?? [];
  const ev = meta<{ holdout: EvalSet | null; dev: EvalSet | null }>("eval") ?? { holdout: null, dev: null };
  const src = last?.sources ?? {};
  const sum = (k: "fetched" | "india" | "boards") => Object.values(src).reduce((a, s) => a + s[k], 0);
  // The run that paid for the most tags is the honest basis for cost per 1,000 (cache-hit days cost ~0).
  const priced = [...runs].filter((r) => r.llm.posts_tagged >= 50).sort((a, b) => b.llm.posts_tagged - a.llm.posts_tagged)[0] ?? null;
  return {
    live: one("SELECT count(*) n FROM posts WHERE live = 1"),
    total: one("SELECT count(*) n FROM posts"),
    rejected: one("SELECT count(*) n FROM posts WHERE live = 0"),
    verified: one("SELECT count(*) n FROM posts WHERE trust = 'verified'"),
    companies: one("SELECT count(DISTINCT company) n FROM posts WHERE live = 1"),
    mislabeled: one("SELECT count(*) n FROM posts WHERE live = 0 AND source = 'himalayas'"),
    aggregator_total: one("SELECT count(*) n FROM posts WHERE source = 'himalayas'"),
    fetched: sum("fetched"), india: sum("india"), boards: sum("boards"),
    roles: q<{ k: string; n: number }>("SELECT role k, count(*) n FROM posts WHERE live = 1 GROUP BY 1 ORDER BY 2 DESC"),
    cities: q<{ k: string; n: number }>("SELECT c.city k, count(*) n FROM post_city c JOIN posts p ON p.rid = c.rid WHERE p.live = 1 GROUP BY 1 ORDER BY 2 DESC"),
    sources: q<{ k: string; n: number }>("SELECT source k, count(*) n FROM posts WHERE live = 1 GROUP BY 1 ORDER BY 2 DESC"),
    names: q<{ company: string }>("SELECT company, count(*) n FROM posts WHERE live = 1 AND source != 'himalayas' GROUP BY 1 ORDER BY n DESC LIMIT 28").map((r) => r.company),
    sample: q<any>("SELECT * FROM posts WHERE live = 1 AND trust = 'verified' AND verdict = 'fresher' AND source != 'himalayas' AND length(title) < 44 AND json_array_length(cities) = 1 ORDER BY length(json_extract(receipts,'$.exp.quote')) DESC LIMIT 1").map(parse)[0] ?? null,
    caught: q<any>("SELECT * FROM posts WHERE live = 0 AND source = 'himalayas' AND trust = 'verified' AND min_exp >= 3 AND length(title) < 48 AND length(json_extract(receipts,'$.exp.quote')) BETWEEN 18 AND 90 ORDER BY min_exp DESC, id LIMIT 4").map(parse),
    last, runs, priced, eval: ev,
    built_at: meta<string>("built_at"),
  };
}
export type Stats = ReturnType<typeof getStats>;
