// Daily pipeline: collect -> dedupe -> tag (cache-first) -> verify -> quality gate -> publish.
// Idempotent: running it twice on the same day changes nothing and costs nothing (content-hash cache).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dedupe } from "./dedupe.ts";
import { collect, looksFresher } from "./sources/index.ts";
import { costUSD, newUsage, tagAll } from "./tagger/index.ts";
import { MODEL, PROMPT_V, excerpt } from "./tagger/prompt.ts";
import type { Post, RunLedger } from "./types.ts";
import { sha1, today } from "./util.ts";

const POSTS = new URL("../data/posts.jsonl", import.meta.url);
const RUNS = new URL("../data/runs.jsonl", import.meta.url);
const GRACE_DAYS = 2; // a post missing from one run is kept this long, so a flaky source never empties the board
const log = (s: string) => console.log(`[beep-jobs ${new Date().toISOString().slice(11, 19)}] ${s}`);

export const readPosts = (): Post[] => (existsSync(POSTS) ? readFileSync(POSTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

async function main() {
  const t0 = Date.now();
  const day = today();
  const prev = new Map(readPosts().map((p) => [p.id, p]));
  log(`previous snapshot: ${prev.size} posts`);

  const { posts: raw, stats, failedSources } = await collect();
  for (const [s, st] of Object.entries(stats)) log(`source ${s}: boards=${st.boards} fetched=${st.fetched} india=${st.india} candidates=${st.candidates} errors=${st.errors}${st.first_error ? ` first_error="${st.first_error}"` : ""}`);

  const { clusters, removed } = dedupe(raw);
  const dupTotal = removed.exact + removed.fingerprint + removed.near;
  log(`dedupe: ${raw.length} -> ${clusters.length} (exact ${removed.exact}, fingerprint ${removed.fingerprint}, near ${removed.near})`);

  const usage = newUsage();
  let cacheHits = 0;
  const next = new Map<string, Post>();
  const todo: Post[] = [];
  for (const c of clusters) {
    const p = c.primary;
    const location_raw = [...new Set(c.members.flatMap((m) => m.location_raw.split(/;\s*/)))].filter(Boolean).join("; ");
    const text = excerpt(p.text);
    const content_hash = sha1([p.title, p.company, location_raw, text].join("\u0001"));
    const old = prev.get(c.id);
    const post: Post = {
      id: c.id, source: p.source, board: p.board, url: p.url, apply_url: p.apply_url, title: p.title.trim(), company: p.company.trim(), location_raw, text,
      posted_at: p.posted_at, first_seen: old?.first_seen ?? day, last_seen: day, content_hash,
      dup_count: c.members.length, alt_sources: [...new Set(c.members.slice(1).map((m) => m.source))],
      tags: old?.tags as Post["tags"],
    };
    (post as any).employment_hint = p.employment_hint;
    // Cache: same content + same prompt + same model = same answer. Never pay twice.
    if (old && old.content_hash === content_hash && old.tags?.prompt_v === PROMPT_V && old.tags?.model === MODEL) cacheHits++;
    else todo.push(post);
    next.set(c.id, post);
  }
  log(`tagging: ${todo.length} new/changed, ${cacheHits} cache hits, model=${MODEL} prompt=${PROMPT_V}`);
  if (todo.length && !process.env.GEMINI_API_KEY && !process.env.BEEP_JOBS_ALLOW_RULES) {
    // Fail loud instead of silently publishing rules-only tags: a missing secret is a config bug, not an outage.
    log("GEMINI_API_KEY is not set. Refusing to tag. Set the secret, or BEEP_JOBS_ALLOW_RULES=1 to publish rules-only tags.");
    process.exit(3);
  }
  const tags = await tagAll(todo.map((p) => ({ ...p, employment_hint: (p as any).employment_hint })), usage, { log });
  todo.forEach((p, i) => (p.tags = tags[i]));
  for (const p of next.values()) delete (p as any).employment_hint;

  // Carry over posts that vanished today but are inside the grace window (or whose whole source failed).
  let carried = 0, expired = 0;
  for (const old of prev.values()) {
    if (next.has(old.id)) continue;
    const age = (Date.parse(day) - Date.parse(old.last_seen)) / 864e5;
    // A post our current prefilter would reject is dropped at once (filter changes must take effect the same day).
    const stillEligible = looksFresher({ ...old, source_id: old.id, text: old.text });
    if (stillEligible && (failedSources.has(old.source) || age < GRACE_DAYS)) { next.set(old.id, old); carried++; } else expired++;
  }

  const all = [...next.values()].sort((a, b) => a.id.localeCompare(b.id)); // stable order -> small git diffs
  const live = all.filter((p) => p.tags.verdict !== "experienced");

  // Quality gate: refuse to publish a collapse. Yesterday's good data stays live.
  if (prev.size >= 100 && all.length < prev.size * 0.6 && !process.env.BEEP_JOBS_FORCE) {
    log(`QUALITY GATE: ${all.length} posts vs ${prev.size} yesterday (<60%). Not publishing.`);
    process.exit(2);
  }

  const cost = costUSD(usage);
  const count = (f: (p: Post) => string) => all.reduce<Record<string, number>>((a, p) => ((a[f(p)] = (a[f(p)] || 0) + 1), a), {});
  const ledger: RunLedger = {
    run_id: `${day}-${sha1(String(t0)).slice(0, 6)}`, at: new Date().toISOString(), duration_s: Math.round((Date.now() - t0) / 1000),
    sources: stats, candidates: raw.length, after_dedupe: clusters.length, duplicates_removed: dupTotal,
    llm: { model: MODEL, prompt_v: PROMPT_V, calls: usage.calls, posts_tagged: usage.posts_tagged, cache_hits: cacheHits, rules_fallback: usage.rules_fallback, in_tokens: usage.in_tokens, out_tokens: usage.out_tokens, cost_usd: +cost.toFixed(6), cost_per_1k_usd: usage.posts_tagged ? +((cost / usage.posts_tagged) * 1000).toFixed(4) : null },
    receipts: { verified: all.filter((p) => p.tags.trust === "verified").length, review: all.filter((p) => p.tags.trust !== "verified").length },
    verdicts: count((p) => p.tags.verdict), published: live.length, carried_over: carried, expired,
  };
  writeFileSync(POSTS, all.map((p) => JSON.stringify(p)).join("\n") + "\n");
  appendFileSync(RUNS, JSON.stringify(ledger) + "\n");
  log(`published ${live.length} fresher posts (${all.length - live.length} fake-fresher posts caught), carried=${carried} expired=${expired}`);
  log(`llm: calls=${usage.calls} in=${usage.in_tokens} out=${usage.out_tokens} cost=$${cost.toFixed(4)} per1k=$${ledger.llm.cost_per_1k_usd ?? "n/a"} fallback=${usage.rules_fallback}`);
}

if (process.argv[1]?.endsWith("run.ts")) main().catch((e) => { console.error(e); process.exit(1); });
