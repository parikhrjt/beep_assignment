// One-off: apply the current prefilter to stored posts carried over from older runs.
import { readFileSync, writeFileSync } from "node:fs";
import { looksFresher } from "../pipeline/sources/index.ts";
import { PROMPT_V } from "../pipeline/tagger/prompt.ts";
const f = new URL("../data/posts.jsonl", import.meta.url);
const ps = readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const keep = ps.filter((p) => p.tags.prompt_v === PROMPT_V || looksFresher(p));
writeFileSync(f, keep.map((p) => JSON.stringify(p)).join("\n") + "\n");
console.log(`kept ${keep.length} of ${ps.length}; old-prompt left: ${keep.filter((p) => p.tags.prompt_v !== PROMPT_V).length}`);
