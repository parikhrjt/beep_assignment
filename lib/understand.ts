// Query understanding cascade. Cheapest layer that works wins:
//   L0 CDN cache      (same URL -> same JSON, no function runs)
//   L1 rules          (gazetteer + synonym map, ~0.1 ms, free, handles "pune me backend internship")
//   L2 LLM            (only when L1 leaves words it cannot place AND plain search finds nothing)
import { CITIES, CITY_ALIASES, ROLE_IDS } from "./taxonomy.ts";

export type Understood = { cities: string[]; roles: string[]; employment?: string; mode?: string; verdict?: string; terms: string[]; via: "rules" | "llm" | "none" };

const ROLE_WORDS: Record<string, string> = {
  sde: "software", swe: "software", developer: "software", dev: "software", backend: "software", frontend: "software", fullstack: "software", software: "software", coding: "software", programmer: "software", android: "software", ios: "software", web: "software",
  ml: "data_ai", ai: "data_ai", "machine learning": "data_ai", "data science": "data_ai", "data scientist": "data_ai", genai: "data_ai", nlp: "data_ai",
  "data analyst": "data_analytics", analytics: "data_analytics", "data engineer": "data_analytics", bi: "data_analytics",
  devops: "devops", cloud: "devops", sre: "devops", qa: "qa", testing: "qa", tester: "qa", sdet: "qa",
  security: "security", cybersecurity: "security", cyber: "security",
  embedded: "hardware", vlsi: "hardware", hardware: "hardware", mechanical: "hardware", civil: "hardware", electrical: "hardware", electronics: "hardware",
  product: "product", apm: "product", design: "design", designer: "design", ux: "design", ui: "design", graphic: "design",
  marketing: "marketing", seo: "marketing", content: "marketing", writer: "marketing", "social media": "marketing",
  sales: "sales", bde: "sales", "business development": "sales", support: "support", "customer support": "support", "customer success": "support",
  finance: "finance", accounting: "finance", accountant: "finance", audit: "finance", hr: "hr", recruiter: "hr", recruiting: "hr", "human resources": "hr",
  legal: "legal", law: "legal", operations: "operations", ops: "operations", "supply chain": "operations", consulting: "consulting", strategy: "consulting", research: "consulting",
};
// English + Hinglish filler that carries no search intent.
const STOP = new Set("a an the in at on for of to with and or near me mein mai main ka ki ke liye chahiye chahie wala wali wale koi hai h kya do dikhao batao job jobs role roles opening openings position positions vacancy vacancies work naukri kaam i want need looking find show any some please plz new latest best good paid india indian company companies".split(" "));
const PHRASES: [RegExp, (u: Understood) => void][] = [
  [/\b(work from home|wfh|remote)\b/g, (u) => { u.mode = "remote"; }],
  [/\bhybrid\b/g, (u) => { u.mode = "hybrid"; }],
  [/\b(on-?site|in office|office)\b/g, (u) => { u.mode = "onsite"; }],
  [/\b(internships?|interns?|training|trainee)\b/g, (u) => { u.employment = "internship"; }],
  [/\b(full[- ]?time|fulltime|permanent)\b/g, (u) => { u.employment = "full_time"; }],
  [/\b(freshers?|no experience|0 experience|zero experience|new grads?|graduates?|campus)\b/g, (u) => { u.verdict = "fresher"; }],
];
const ALIASES = Object.entries(CITY_ALIASES).flatMap(([c, al]) => al.map((a) => [a, c] as const)).sort((a, b) => b[0].length - a[0].length);
const ROLE_KEYS = Object.keys(ROLE_WORDS).sort((a, b) => b.length - a.length);

export function understandRules(q: string): Understood {
  const u: Understood = { cities: [], roles: [], terms: [], via: "none" };
  let s = ` ${q.toLowerCase().replace(/[^\p{L}\p{N}+#. -]/gu, " ").replace(/\s+/g, " ")} `;
  for (const [re, fn] of PHRASES) if (re.test(s)) { fn(u); s = s.replace(re, " "); }
  for (const [alias, city] of ALIASES) {
    const re = new RegExp(`(?<![a-z])${alias}(?![a-z])`, "g");
    if (re.test(s)) { if (!u.cities.includes(city)) u.cities.push(city); s = s.replace(re, " "); }
  }
  for (const k of ROLE_KEYS) {
    const re = new RegExp(`(?<![a-z])${k}(?![a-z])`, "g");
    if (re.test(s)) { if (!u.roles.includes(ROLE_WORDS[k])) u.roles.push(ROLE_WORDS[k]); s = s.replace(re, " "); }
  }
  u.terms = s.split(" ").filter((w) => w && !STOP.has(w) && w.length > 1);
  if (u.cities.length || u.roles.length || u.employment || u.mode || u.verdict) u.via = "rules";
  return u;
}

// In-memory LRU for LLM rewrites (per instance). The CDN in front is the real, shared cache.
const lru = new Map<string, Understood>();

export async function understandLLM(q: string, timeoutMs = 2500): Promise<Understood | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const k = q.toLowerCase().trim();
  if (lru.has(k)) return lru.get(k)!;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.BEEP_MODEL || "gemini-3.5-flash-lite"}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `Turn a job-search query (English, Hindi or Hinglish, may have typos) into filters for an India fresher job board. roles: ids from the allowed list that match the intent. cities: canonical names from the allowed list. keywords: 0-3 concrete skills or tools to full-text search, in English, lowercase; never include role or city words. Leave a field empty when the query does not say.` }] },
        contents: [{ role: "user", parts: [{ text: q.slice(0, 200) }] }],
        generationConfig: {
          temperature: 0, maxOutputTokens: 200, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" },
          responseSchema: { type: "OBJECT", properties: {
            roles: { type: "ARRAY", items: { type: "STRING", enum: ROLE_IDS } }, cities: { type: "ARRAY", items: { type: "STRING", enum: CITIES } },
            employment: { type: "STRING", enum: ["internship", "full_time", "any"] }, mode: { type: "STRING", enum: ["remote", "hybrid", "onsite", "any"] },
            keywords: { type: "ARRAY", items: { type: "STRING" } } }, required: ["roles", "cities", "employment", "mode", "keywords"] },
        },
      }),
    });
    if (!r.ok) return null;
    const d: any = await r.json();
    const o = JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    const u: Understood = {
      cities: (o.cities || []).filter((c: string) => CITIES.includes(c)).slice(0, 4), roles: (o.roles || []).filter((x: string) => ROLE_IDS.includes(x)).slice(0, 3),
      employment: o.employment !== "any" ? o.employment : undefined, mode: o.mode !== "any" ? o.mode : undefined,
      terms: (o.keywords || []).map((x: any) => String(x).toLowerCase()).slice(0, 3), via: "llm",
    };
    if (lru.size > 500) lru.delete(lru.keys().next().value!);
    lru.set(k, u);
    return u;
  } catch { return null; } // timeout or outage: the caller keeps the rules result. Search never depends on the LLM being up.
}
