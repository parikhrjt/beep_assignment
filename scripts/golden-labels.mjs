// Blind first-pass labels for the 50-post golden set (made before any model prediction was looked at).
// Tuple: [role, role_alt, cities, verdict].
// role_alt = a second role a careful human could defend; decided blind, used only for the "lenient" number.
// verdict = null when the post does not let a human decide; those rows are left out of verdict accuracy.
import { readFileSync, writeFileSync } from "node:fs";
const L = {
  "9e0b4f10d7e3": ["security", "finance", ["Noida"], "early"],
  "5a975a239b7a": ["data_ai", null, ["Bengaluru", "Lucknow"], "experienced"],
  "27438a7da2e7": ["sales", null, ["Bengaluru"], "experienced"],
  "287a88613408": ["marketing", null, ["Bengaluru"], "experienced"],
  "b108dd2cc7ef": ["support", null, ["Noida"], "early"],
  "57eaf772bb17": ["support", null, ["Pune", "Gurugram"], null],
  "e689326ce025": ["operations", "finance", ["Bengaluru"], null],
  "f2c1c1bd6627": ["devops", "software", ["Hyderabad"], "fresher"],
  "ec5755ee39a1": ["consulting", "sales", ["Bengaluru"], null],
  "daa5dae47d4e": ["finance", null, ["Bengaluru"], "experienced"],
  "eb65d3c71c1a": ["finance", null, ["Bengaluru"], "experienced"],
  "85b2fb356215": ["legal", null, ["Mumbai", "Bengaluru"], null],
  "063fbdc08657": ["support", null, ["Noida"], null],
  "d2ada842a194": ["support", null, ["Bengaluru", "Chandigarh"], "early"],
  "91bba191bf10": ["finance", "operations", ["Gurugram"], "experienced"],
  "5c89795120af": ["marketing", null, ["Bengaluru"], "experienced"],
  "22bb4396234e": ["hr", null, ["Gurugram"], null],
  "5c68bc40f015": ["hr", null, ["Noida"], "fresher"],
  "7315348adf30": ["finance", null, ["Bengaluru"], "fresher"],
  "f38756efe2b9": ["hr", null, ["Bengaluru"], "fresher"],
  "03228baddb43": ["legal", null, ["Bengaluru"], "experienced"],
  "796894cc5861": ["product", null, ["Bengaluru"], "experienced"],
  "07a67d8d2000": ["marketing", null, ["Mumbai"], "fresher"],
  "0edd84a7dfd1": ["legal", null, ["Mumbai", "Bengaluru"], "experienced"],
  "8c40261e5cce": ["data_ai", null, ["Bengaluru"], null],
  "21e60b54bac5": ["operations", "consulting", ["Remote"], null],
  "6ef217c12a35": ["sales", null, ["Remote"], "fresher"],
  "87fd6b313397": ["software", null, ["Remote"], "fresher"],
  "e35ab0e1bdb1": ["marketing", null, ["Remote"], "fresher"],
  "67027cf8ebb9": ["operations", null, ["Remote"], "fresher"],
  "85d0bb4c6195": ["sales", "consulting", ["Remote"], "fresher"],
  "7a0fbbcabcf8": ["operations", null, ["Remote"], null],
  "6ec43a723d96": ["design", null, ["Remote"], "fresher"],
  "b2e24907b0f5": ["other", null, ["Remote"], null],
  "7fc7e09a4ccf": ["support", null, ["Remote", "Other"], "fresher"],
  "939d1e0c0672": ["data_ai", "software", ["Remote"], "fresher"],
  "944f7d577375": ["other", "operations", ["Remote"], null],
  "77300a316baa": ["hardware", null, ["Remote"], "fresher"],
  "6bca1e80e5e5": ["operations", "other", ["Remote"], null],
  "c1402aa25762": ["software", null, ["Remote"], "early"],
  "3c7908fe9971": ["other", "operations", ["Remote"], null],
  "b29b32dda64d": ["marketing", null, ["Remote"], "early"],
  "0cde5cd6d3f1": ["product", null, ["Remote"], "fresher"],
  "391b8f1cef2f": ["consulting", "software", ["Remote"], null],
  "1695a9ad736c": ["marketing", null, ["Remote"], "early"],
  "e761f398533a": ["consulting", "data_analytics", ["Remote"], null],
  "ae79a36be550": ["sales", null, ["Remote"], null],
  "71ce7f207a2d": ["other", "operations", ["Remote"], null],
  "334bcbde89be": ["operations", null, ["Remote"], "fresher"],
  "45d37e2970ac": ["support", null, ["Remote"], "fresher"],
};
const todo = readFileSync("data/golden.todo.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const out = todo.map((p) => {
  const [role, role_alt, cities, verdict] = L[p.id];
  return { ...p, gold: { role, role_alt, cities, verdict }, labeled_by: "claude-fable-5.2 (blind manual read)", verified_by: null };
});
if (out.length !== 50) throw new Error("expected 50");
writeFileSync("data/golden.dev.jsonl", out.map((o) => JSON.stringify(o)).join("\n") + "\n");
console.log("golden.jsonl written", out.length);
