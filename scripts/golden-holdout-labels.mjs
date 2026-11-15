// Blind labels for the HOLDOUT golden set: 50 posts drawn with a different seed, disjoint from the dev set,
// labelled before the tagger was run on them and never used to tune the prompt. This is the headline number.
// Tuple: [role, role_alt, cities, verdict]; verdict null = a human cannot decide from the post.
import { readFileSync, writeFileSync } from "node:fs";
const L = {
  adfc540eb211: ["operations", "support", ["Mumbai"], "early"],
  ea6c318d795f: ["hr", null, ["Gurugram"], "experienced"],
  "065f735b4634": ["support", null, ["Pune"], null],
  "0aa2f4292d3c": ["consulting", "product", ["Bengaluru"], "early"],
  fbe243440af6: ["support", "sales", ["Bengaluru"], "early"],
  "026c0b8fa554": ["software", null, ["Bengaluru"], "fresher"],
  "76a1d23bd477": ["sales", null, ["Bengaluru"], "experienced"],
  "42b203d87984": ["finance", "operations", ["Ahmedabad", "Gurugram"], "fresher"],
  fb7c4f21695d: ["finance", "operations", ["Bengaluru"], "early"],
  "5135f1bf1c35": ["hr", null, ["Pune"], "early"],
  d30990eabc1c: ["sales", null, ["Noida"], "fresher"],
  eb197228cdd5: ["sales", null, ["Mumbai"], "early"],
  "1c3634fc9cc2": ["support", null, ["Mumbai"], "early"],
  "6e221b137bb5": ["consulting", "support", ["Bengaluru", "Pune"], "early"],
  "150815d6350e": ["support", null, ["Bengaluru"], null],
  "7f5634845fb5": ["marketing", "operations", ["Bengaluru"], null],
  "46ed660228b3": ["support", null, ["Gurugram", "Remote"], "early"],
  a000c242cd10: ["software", "consulting", ["Bengaluru"], "fresher"],
  "6fdc0dbb9d73": ["finance", null, ["Bengaluru"], "fresher"],
  ff8d1c31c207: ["data_analytics", null, ["Gurugram"], "experienced"],
  "189f229c01cf": ["product", null, ["Bengaluru"], "fresher"],
  c57015ff8891: ["hr", null, ["Gurugram"], "experienced"],
  "3bbe941b17d8": ["support", null, ["Bengaluru"], null],
  dd44ab89db46: ["support", "consulting", ["Noida"], "experienced"],
  a372dc9b96a9: ["product", null, ["Bengaluru"], "fresher"],
  "30f1cf7b27d8": ["design", null, ["Remote"], "fresher"],
  e24319fc29e4: ["operations", null, ["Remote"], "fresher"],
  "9d6dd57fa225": ["design", null, ["Remote"], "early"],
  "14f0f8f66387": ["design", null, ["Remote"], null],
  "0f491a5e0808": ["operations", "other", ["Remote"], null],
  a03702a0e786: ["other", "support", ["Remote"], null],
  e89199232152: ["operations", null, ["Remote"], null],
  "9fdc7e4f41bf": ["marketing", null, ["Remote"], "fresher"],
  "7d5ed2ff81e7": ["operations", null, ["Remote"], null],
  d72363e78743: ["support", null, ["Remote"], "early"],
  fdcd7ec60741: ["software", null, ["Remote"], "fresher"],
  cc15700d8d52: ["operations", "other", ["Remote"], null],
  b35f3e85d110: ["operations", "other", ["Remote"], null],
  "46381e89cd62": ["operations", "other", ["Remote"], null],
  "3a9f789f63c2": ["operations", "marketing", ["Remote"], "early"],
  c7f1b3e3921c: ["marketing", "other", ["Remote"], null],
  "6c687911f4f4": ["sales", null, ["Pune", "Remote"], "early"],
  "7d5723358430": ["design", null, ["Remote"], "fresher"],
  "34555454b8d9": ["software", null, ["Remote"], "fresher"],
  "5243b08c7a82": ["design", null, ["Remote"], "fresher"],
  "1aa4ce3b765a": ["other", "marketing", ["Bengaluru", "Remote"], null],
  c1b9a4cf0c7c: ["operations", "other", ["Remote"], null],
  e751a4af8ce7: ["sales", null, ["Remote"], null],
  "88c844e231ca": ["sales", null, ["Remote"], "fresher"],
  "503fa7e1a490": ["marketing", null, ["Remote"], null],
};
const todo = readFileSync("data/golden.todo.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const out = todo.map((p) => {
  if (!L[p.id]) throw new Error("no label for " + p.id);
  const [role, role_alt, cities, verdict] = L[p.id];
  return { ...p, gold: { role, role_alt, cities, verdict }, labeled_by: "claude-opus-5.5 (blind manual read)", verified_by: null };
});
if (out.length !== 50) throw new Error("expected 50");
writeFileSync("data/golden.holdout.jsonl", out.map((o) => JSON.stringify(o)).join("\n") + "\n");
console.log("golden.holdout.jsonl written", out.length);
