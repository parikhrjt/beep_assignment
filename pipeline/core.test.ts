import assert from "node:assert/strict";
import { test } from "node:test";
import { gazetteer } from "../lib/taxonomy.ts";
import { understandRules } from "../lib/understand.ts";
import { dedupe, hamming, normTitle, simhash } from "./dedupe.ts";
import { looksFresher } from "./sources/index.ts";
import { rulesTag, verify } from "./tagger/index.ts";
import { excerpt } from "./tagger/prompt.ts";
import type { RawPost } from "./types.ts";

const raw = (o: Partial<RawPost>): RawPost => ({ source: "greenhouse", source_id: "1", board: "acme", url: "u", apply_url: "a", title: "Software Engineer Intern", company: "Acme", location_raw: "Bengaluru, India", text: "", posted_at: null, ...o });

test("gazetteer maps aliases to canonical cities", () => {
  assert.deepEqual(gazetteer("Bangalore, Karnataka").sort(), ["Bengaluru"]);
  assert.deepEqual(gazetteer("Gurgaon; Remote").sort(), ["Gurugram", "Remote"]);
  assert.deepEqual(gazetteer("Navi Mumbai"), ["Mumbai"]);
  assert.deepEqual(gazetteer("London, UK"), []);
});

test("receipt check accepts verbatim quotes and rejects invented ones", () => {
  const p = { title: "Backend Intern", company: "Acme", location_raw: "Pune, India", text: "We welcome freshers. 0-1 years of experience." };
  const t = rulesTag(p);
  t.tagger = "llm"; t.cities = ["Pune"];
  t.receipts = { role: { quote: "Backend Intern", ok: false }, city: { quote: "LOCATION: Pune, India", ok: false }, exp: { quote: "0-1 years of experience", ok: false } };
  t.verdict = "fresher";
  verify(p, t);
  assert.equal(t.trust, "verified");
  t.receipts.exp.quote = "minimum 0 years required";
  verify(p, t);
  assert.equal(t.receipts.exp.ok, false);
  assert.equal(t.trust, "review");
});

test("city disagreement with gazetteer lowers trust", () => {
  const p = { title: "Intern", company: "Acme", location_raw: "Pune, India", text: "" };
  const t = rulesTag(p);
  t.cities = ["Mumbai"];
  t.receipts = { role: { quote: "Intern", ok: false }, city: { quote: "Pune, India", ok: false }, exp: { quote: "Intern", ok: false } };
  verify(p, t);
  assert.equal(t.trust, "review");
});

test("Pan-India never sits next to a real city", () => {
  const p = { title: "Intern", company: "Acme", location_raw: "Pune, India", text: "" };
  const t = rulesTag(p);
  t.cities = ["Pune", "Pan-India"];
  verify(p, t);
  assert.deepEqual(t.cities, ["Pune"]);
});

test("prefilter keeps fresher titles and drops senior ones", () => {
  assert.equal(looksFresher(raw({ title: "SDE Intern" })), true);
  assert.equal(looksFresher(raw({ title: "Associate Director - Delivery" })), false);
  assert.equal(looksFresher(raw({ title: "Analyst", text: "Freshers welcome, 0-1 years" })), true);
  assert.equal(looksFresher(raw({ title: "Senior Analyst", text: "Freshers welcome" })), false);
});

test("dedupe merges per-city copies and reworded near duplicates", () => {
  const body = "Join our platform team to build reliable payment systems. ".repeat(20);
  const posts = [
    raw({ source_id: "1", location_raw: "Pune", text: body }),
    raw({ source_id: "1", location_raw: "Pune", text: body }), // exact
    raw({ source_id: "2", location_raw: "Mumbai", title: "Software Engineer Intern (Mumbai)", text: body }), // fingerprint
    raw({ source_id: "3", title: "Intern - Software Engineer 2026", text: body + " Apply now." }), // near
    raw({ source_id: "4", company: "Other Co", text: body }),
  ];
  const { clusters, removed } = dedupe(posts);
  assert.equal(removed.exact, 1);
  assert.equal(clusters.length, 2);
});

test("simhash is stable and close for near-identical text", () => {
  const a = simhash("the quick brown fox jumps over the lazy dog again and again today");
  const b = simhash("the quick brown fox jumps over the lazy dog again and again tonight");
  assert.ok(hamming(a, b) <= 12);
  assert.equal(normTitle("Backend Intern (Pune)"), normTitle("Intern, Backend"));
});

test("query rules understand Hinglish", () => {
  const u = understandRules("pune me backend internship chahiye");
  assert.deepEqual(u.cities, ["Pune"]);
  assert.deepEqual(u.roles, ["software"]);
  assert.equal(u.employment, "internship");
  assert.deepEqual(u.terms, []);
  const v = understandRules("wfh customer support fresher blr");
  assert.equal(v.mode, "remote");
  assert.equal(v.verdict, "fresher");
  assert.deepEqual(v.cities, ["Bengaluru"]);
});

test("excerpt keeps requirement lines that sit deep in the text", () => {
  const text = "About us. ".repeat(400) + "\nRequirements: 3+ years of experience in Java\n" + "Perks. ".repeat(100);
  const e = excerpt(text);
  assert.ok(e.length <= 2200);
  assert.ok(e.includes("3+ years of experience"));
});
