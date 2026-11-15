// Offline eval: run the production tagger on the 50 hand-labelled posts and score it.
// Also scores the deterministic rules tagger as a baseline, so the LLM has to earn its cost.
// Exit code 1 when accuracy drops below the gate -> CI blocks a prompt or model change that regresses.
import { readFileSync, writeFileSync } from "node:fs";
import { costUSD, newUsage, rulesTag, tagAll } from "./tagger/index.ts";
import { MODEL, PRICE, PROMPT_V } from "./tagger/prompt.ts";
import type { Tags } from "./types.ts";

const GATE = { role_lenient: 0.8, city: 0.85 };
// Two sets: "dev" (the prompt was tuned on it, so its score is optimistic) and "holdout" (never used for tuning: the headline number).
const SET = process.argv[2] === "dev" ? "dev" : "holdout";
const golden = readFileSync(new URL(`../data/golden.${SET}.jsonl`, import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
/** Wilson 95% interval: honest error bars for a proportion measured on n = 50. */
const wilson = (k: number, n: number) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [+((c - m) / d).toFixed(3), +((c + m) / d).toFixed(3)];
};
const prop = (k: number, n: number) => ({ k, n, acc: n ? +(k / n).toFixed(3) : null, ci95: wilson(k, n) });

function score(tags: Tags[], subset = golden.map((_, i) => i)) {
  let rs = 0, rl = 0, c = 0, both = 0, v = 0, vn = 0;
  for (const i of subset) {
    const g = golden[i].gold, t = tags[i];
    const s = t.role === g.role, l = s || t.role === g.role_alt, ci = sameSet(t.cities, g.cities);
    rs += +s; rl += +l; c += +ci; both += +(l && ci);
    if (g.verdict) { vn++; v += +(t.verdict === g.verdict); }
  }
  const n = subset.length;
  return { role_strict: prop(rs, n), role_lenient: prop(rl, n), city: prop(c, n), role_and_city: prop(both, n), verdict: prop(v, vn) };
}

const usage = newUsage();
const inputs = golden.map((g) => ({ title: g.title, company: g.company, location_raw: g.location_raw, text: g.text }));
const llm = await tagAll(inputs, usage, { log: (s) => console.log(s) });
const rules = inputs.map(rulesTag);
const idx = (f: (g: any, t: Tags) => boolean) => golden.map((g, i) => (f(g, llm[i]) ? i : -1)).filter((i) => i >= 0);
const cost = costUSD(usage);
const report = {
  set: SET, at: new Date().toISOString(), model: MODEL, prompt_v: PROMPT_V, n: golden.length,
  labeled_by: golden[0].labeled_by, human_verified: golden.filter((g) => g.verified_by).length,
  verified_by: golden.every((g) => g.verified_by) ? golden[0].verified_by : null,
  llm: score(llm), rules_baseline: score(rules),
  by_source: { first_party_ats: score(llm, idx((g) => g.source !== "himalayas")), aggregator: score(llm, idx((g) => g.source === "himalayas")) },
  by_trust: { verified: score(llm, idx((_, t) => t.trust === "verified")), review: score(llm, idx((_, t) => t.trust !== "verified")) },
  receipts: { quotes_checked: llm.length * 3, verbatim: llm.reduce((a, t) => a + +t.receipts.role.ok + +t.receipts.city.ok + +t.receipts.exp.ok, 0) },
  cost: { in_tokens: usage.in_tokens, out_tokens: usage.out_tokens, calls: usage.calls, usd: +cost.toFixed(6), per_1k_posts_usd: +((cost / golden.length) * 1000).toFixed(4), price: PRICE },
  gate: GATE,
  items: golden.map((g, i) => ({
    id: g.id, source: g.source, title: g.title, company: g.company, location_raw: g.location_raw, gold: g.gold,
    pred: { role: llm[i].role, cities: llm[i].cities, verdict: llm[i].verdict }, rules: { role: rules[i].role, cities: rules[i].cities }, receipts: llm[i].receipts, trust: llm[i].trust,
    ok: { role: llm[i].role === g.gold.role || llm[i].role === g.gold.role_alt, city: sameSet(llm[i].cities, g.gold.cities), verdict: g.gold.verdict ? llm[i].verdict === g.gold.verdict : null },
  })),
};
writeFileSync(new URL(`../data/eval-${SET}.json`, import.meta.url), JSON.stringify(report, null, 1));
const pct = (p: any) => `${(p.acc * 100).toFixed(0)}% (${p.k}/${p.n}, 95% CI ${(p.ci95[0] * 100).toFixed(0)}-${(p.ci95[1] * 100).toFixed(0)}%)`;
console.log(`\nSET ${SET}  MODEL ${MODEL}  PROMPT ${PROMPT_V}\n  role strict   ${pct(report.llm.role_strict)}\n  role lenient  ${pct(report.llm.role_lenient)}\n  city          ${pct(report.llm.city)}\n  role AND city ${pct(report.llm.role_and_city)}\n  verdict       ${pct(report.llm.verdict)}`);
console.log(`RULES BASELINE\n  role lenient  ${pct(report.rules_baseline.role_lenient)}\n  city          ${pct(report.rules_baseline.city)}`);
console.log(`COST $${report.cost.usd} for ${golden.length} posts = $${report.cost.per_1k_posts_usd} per 1,000`);
for (const it of report.items) if (!it.ok.role || !it.ok.city || it.ok.verdict === false) console.log(`MISS ${it.id} "${it.title}" gold=${JSON.stringify(it.gold)} pred=${JSON.stringify(it.pred)}`);
if (SET === "holdout" && process.env.BEEP_EVAL_GATE !== "off" && (report.llm.role_lenient.acc! < GATE.role_lenient || report.llm.city.acc! < GATE.city)) { console.error("EVAL GATE FAILED"); process.exit(1); }
