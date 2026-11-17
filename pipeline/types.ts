import type { Verdict } from "../lib/taxonomy.ts";

/** What a source adapter returns. Adapters do no business logic beyond field mapping. */
export type RawPost = {
  source: string; // greenhouse | lever | ashby | smartrecruiters | himalayas
  source_id: string;
  board: string; // company slug on the ATS, or "himalayas"
  url: string; // public page a human can open
  apply_url: string; // must be passed through unchanged (Himalayas terms)
  title: string;
  company: string;
  location_raw: string;
  text: string; // plain-text description, already HTML-stripped
  posted_at: string | null; // ISO date
  employment_hint?: string;
};

export type Receipt = { quote: string; ok: boolean };

export type Tags = {
  role: string;
  cities: string[];
  verdict: Verdict;
  min_exp_years: number | null;
  work_mode: string;
  employment: string;
  skills: string[];
  pay: string | null;
  receipts: { role: Receipt; city: Receipt; exp: Receipt };
  /** verified = all receipts are verbatim substrings AND city agrees with the gazetteer (when it has an opinion). */
  trust: "verified" | "review";
  tagger: "llm" | "rules";
  model: string;
  prompt_v: string;
  tagged_at: string;
};

export type Post = {
  id: string;
  source: string;
  board: string;
  url: string;
  apply_url: string;
  title: string;
  company: string;
  location_raw: string;
  text: string;
  posted_at: string | null;
  first_seen: string;
  last_seen: string;
  content_hash: string;
  dup_count: number; // how many raw posts were merged into this one
  alt_sources: string[];
  tags: Tags;
};

export type SourceStat = { boards: number; fetched: number; india: number; candidates: number; errors: number; first_error?: string };

export type RunLedger = {
  run_id: string;
  at: string;
  duration_s: number;
  sources: Record<string, SourceStat>;
  candidates: number;
  after_dedupe: number;
  duplicates_removed: number;
  llm: { model: string; prompt_v: string; calls: number; posts_tagged: number; cache_hits: number; rules_fallback: number; in_tokens: number; out_tokens: number; cost_usd: number; cost_per_1k_usd: number | null };
  receipts: { verified: number; review: number };
  verdicts: Record<string, number>;
  published: number;
  carried_over: number;
  expired: number;
};
