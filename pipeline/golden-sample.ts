// Draw a golden sample. Seeded + stratified so it is reproducible and not dominated by one source.
// Writes data/golden.todo.jsonl WITHOUT model predictions: labels must be made blind.
import { readFileSync, writeFileSync } from "node:fs";
import { sha1 } from "./util.ts";
const SEED = process.argv[2] || "beep-golden-v1";
const skip = new Set(process.argv.slice(3).flatMap((f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id)));
const ps = readFileSync(new URL("../data/posts.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((p: any) => !skip.has(p.id));
const rank = (p: any) => sha1(SEED + p.id);
const pick = (xs: any[], n: number) => xs.sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, n);
const ats = ps.filter((p) => p.source !== "himalayas"), agg = ps.filter((p) => p.source === "himalayas");
// Half first-party ATS, half aggregator, so neither source dominates the score. GOLDEN_N sets the size (default 50).
const N = Number(process.env.GOLDEN_N || 50);
const sample = [...pick(ats, N / 2), ...pick(agg, N / 2)];
writeFileSync(new URL("../data/golden.todo.jsonl", import.meta.url), sample.map((p) => JSON.stringify({ id: p.id, source: p.source, title: p.title, company: p.company, location_raw: p.location_raw, text: p.text })).join("\n") + "\n");
const SIG = /\b(\d+\s*\+?\s*(-|–|to)?\s*\d*\s*\+?\s*(years?|yrs?)|fresher|graduat|experience|intern|batch|pursuing)\b/i;
sample.forEach((p, i) => {
  const lines = p.text.slice(300).split("\n").filter((l: string) => SIG.test(l)).map((l: string) => l.trim().slice(0, 150)).slice(0, 4);
  console.log(`#${i + 1} ${p.id} [${p.source}]\nT: ${p.title} @ ${p.company}\nL: ${p.location_raw.slice(0, 160)}\nD: ${p.text.slice(0, 300).replace(/\n/g, " ")}\nX: ${lines.join(" | ")}\n`);
});
