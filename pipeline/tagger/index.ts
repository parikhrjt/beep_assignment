// Tagging = cache -> LLM (structured output) -> receipt verification -> cross-check -> rules fallback.
import { CITIES, EMPLOYMENTS, MODES, ROLES, ROLE_IDS, VERDICTS, gazetteer, type Verdict } from "../../lib/taxonomy.ts";
import type { Tags } from "../types.ts";
import { canon, pool, sleep } from "../util.ts";
import { MODEL, PRICE, PROMPT_V, SCHEMA, SYSTEM, renderPost, type TagInput } from "./prompt.ts";

export type Usage = { calls: number; in_tokens: number; out_tokens: number; posts_tagged: number; rules_fallback: number };
export const newUsage = (): Usage => ({ calls: 0, in_tokens: 0, out_tokens: 0, posts_tagged: 0, rules_fallback: 0 });
export const costUSD = (u: { in_tokens: number; out_tokens: number }) => (u.in_tokens * PRICE.in_per_m + u.out_tokens * PRICE.out_per_m) / 1e6;

/** Deterministic baseline. Used when the LLM is unavailable, and as the "is the LLM worth it?" baseline on /evals. */
export function rulesTag(p: TagInput): Tags {
  const role = ROLES.find((r) => r.kw.test(p.title))?.id ?? "other";
  let cities = gazetteer(p.location_raw);
  if (!cities.length) cities = ["Pan-India"];
  const t = `${p.title}\n${p.text}`;
  const m = t.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years?|yrs?)/i);
  const intern = /\b(intern|internship|trainee|apprentice|fresher|new grad|graduate)\b/i.test(p.title);
  const min = intern ? 0 : m ? Number(m[1]) : null;
  const verdict: Verdict = min === null ? "unclear" : min === 0 ? "fresher" : min <= 2 ? "early" : "experienced";
  return {
    role, cities, verdict, min_exp_years: min,
    work_mode: /\bhybrid\b/i.test(t) ? "hybrid" : /\b(remote|work from home)\b/i.test(p.location_raw) ? "remote" : "unknown",
    employment: /\bintern/i.test(p.title) ? "internship" : /\bapprentice/i.test(p.title) ? "apprenticeship" : /\bcontract/i.test(p.title) ? "contract" : "full_time",
    skills: [], pay: null,
    receipts: { role: { quote: p.title, ok: true }, city: { quote: p.location_raw, ok: true }, exp: { quote: intern ? p.title : (m?.[0] ?? ""), ok: true } },
    trust: "review", tagger: "rules", model: "rules-v1", prompt_v: PROMPT_V, tagged_at: new Date().toISOString(),
  };
}

/** The receipt check. A quote counts only if it is a verbatim substring of what the model was shown. */
export function verify(p: TagInput, t: Tags): Tags {
  // Policy normalisation (deterministic, so it never depends on the model's mood): "Pan-India" means "no city known", so it never sits next to a city or Remote.
  if (t.cities.length > 1) t.cities = t.cities.filter((c) => c !== "Pan-India");
  const hay = canon(`${p.title}\n${p.location_raw}\n${p.text}`);
  // The model sometimes copies our own field label ("LOCATION: ...") into the quote; the label is not part of the post.
  const has = (q: string) => { const c = canon(q).replace(/^(title|location|description|company)\s*:\s*/, "").replace(/^[.…\s]+|[.…\s]+$/g, ""); return c.length >= 3 && hay.includes(c); };
  t.receipts.role.ok = has(t.receipts.role.quote);
  t.receipts.city.ok = has(t.receipts.city.quote);
  t.receipts.exp.ok = t.verdict === "unclear" ? true : has(t.receipts.exp.quote);
  // Second, independent signal: the gazetteer reads the structured location field. Agreement raises trust for free.
  const real = (xs: string[]) => xs.filter((c) => !["Remote", "Pan-India", "Other"].includes(c));
  const gLoc = real(gazetteer(p.location_raw));
  const gAll = new Set(real(gazetteer(`${p.location_raw}\n${p.text}`)));
  const llm = real(t.cities);
  const agree = gLoc.every((c) => llm.includes(c)) && llm.every((c) => gAll.has(c));
  t.trust = t.receipts.role.ok && t.receipts.city.ok && t.receipts.exp.ok && agree && t.cities.length > 0 ? "verified" : "review";
  return t;
}

function coerce(o: any, now: string): Tags | null {
  if (!o || !ROLE_IDS.includes(o.role) || !VERDICTS.includes(o.verdict)) return null;
  const cities = [...new Set((Array.isArray(o.cities) ? o.cities : []).filter((c: string) => CITIES.includes(c)))] as string[];
  return {
    role: o.role, cities: cities.length ? cities : ["Pan-India"], verdict: o.verdict,
    min_exp_years: typeof o.min_exp_years === "number" ? o.min_exp_years : null,
    work_mode: (MODES as readonly string[]).includes(o.work_mode) ? o.work_mode : "unknown",
    employment: (EMPLOYMENTS as readonly string[]).includes(o.employment) ? o.employment : "full_time",
    skills: (Array.isArray(o.skills) ? o.skills : []).map((s: any) => String(s).toLowerCase().trim()).filter((s: string) => s && s.length < 32).slice(0, 6),
    pay: o.pay ? String(o.pay).slice(0, 120) : null,
    receipts: { role: { quote: String(o.role_quote ?? ""), ok: false }, city: { quote: String(o.city_quote ?? ""), ok: false }, exp: { quote: String(o.exp_quote ?? ""), ok: false } },
    trust: "review", tagger: "llm", model: MODEL, prompt_v: PROMPT_V, tagged_at: now,
  };
}

async function callGemini(posts: TagInput[], usage: Usage): Promise<(Tags | null)[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: `Tag these ${posts.length} posts. Return ${posts.length} objects with i = the POST number.\n\n${posts.map(renderPost).join("\n\n")}` }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA, maxOutputTokens: 6000, thinkingConfig: { thinkingLevel: "minimal" } },
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
      });
      if (r.status === 429 || r.status >= 500) { await sleep(2 ** attempt * 2500 + Math.random() * 1000); continue; }
      const d: any = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
      const um = d.usageMetadata || {};
      usage.calls++;
      usage.in_tokens += um.promptTokenCount || 0;
      usage.out_tokens += (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0); // thinking is billed as output
      const arr = JSON.parse(d.candidates?.[0]?.content?.parts?.map((x: any) => x.text || "").join("") || "[]");
      const now = new Date().toISOString();
      const byI = new Map<number, any>(arr.map((o: any) => [o.i, o]));
      return posts.map((_, i) => coerce(byI.get(i), now));
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(2 ** attempt * 1500);
    }
  }
  throw new Error("Gemini: retries exhausted");
}

/** Tag many posts. Never throws: a failed batch is retried post-by-post, then degrades to rules. */
export async function tagAll(posts: TagInput[], usage: Usage, opts: { batch?: number; concurrency?: number; log?: (s: string) => void } = {}): Promise<Tags[]> {
  const { batch = 8, concurrency = 3, log = () => {} } = opts;
  const out: Tags[] = new Array(posts.length);
  const batches: number[][] = [];
  for (let i = 0; i < posts.length; i += batch) batches.push(Array.from({ length: Math.min(batch, posts.length - i) }, (_, k) => i + k));
  let done = 0;
  await pool(batches, concurrency, async (idxs) => {
    let res: (Tags | null)[] = idxs.map(() => null);
    try { res = await callGemini(idxs.map((i) => posts[i]), usage); } catch (e) { log(`batch failed: ${(e as Error).message}`); }
    for (let k = 0; k < idxs.length; k++) {
      let t = res[k];
      if (!t) { try { t = (await callGemini([posts[idxs[k]]], usage))[0]; } catch { /* fall through */ } }
      if (t) { usage.posts_tagged++; out[idxs[k]] = verify(posts[idxs[k]], t); }
      else { usage.rules_fallback++; out[idxs[k]] = rulesTag(posts[idxs[k]]); }
    }
    done += idxs.length;
    if (done % 80 < batch) log(`tagged ${done}/${posts.length}`);
  });
  return out;
}
