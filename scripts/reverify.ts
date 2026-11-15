// Re-run the deterministic receipt check over stored posts (no LLM calls). Use after changing verify().
import { readFileSync, writeFileSync } from "node:fs";
import { verify } from "../pipeline/tagger/index.ts";
const f = new URL("../data/posts.jsonl", import.meta.url);
const ps = readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
for (const p of ps) if (p.tags.tagger === "llm") { p.tags.receipts.role.quote = p.tags.receipts.role.quote.replace(/^(TITLE|LOCATION|DESCRIPTION):\s*/, ""); p.tags.receipts.city.quote = p.tags.receipts.city.quote.replace(/^(TITLE|LOCATION|DESCRIPTION):\s*/, ""); verify(p, p.tags); }
writeFileSync(f, ps.map((p) => JSON.stringify(p)).join("\n") + "\n");
console.log("verified", ps.filter((p) => p.tags.trust === "verified").length, "review", ps.filter((p) => p.tags.trust !== "verified").length);
