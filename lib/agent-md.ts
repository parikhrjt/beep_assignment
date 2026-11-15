// The "AI" view of the site: the whole landing page as one structured markdown document, shaped like an
// agent skill (frontmatter + when-to-use + tools + schema + rules). Served at /llms.txt and in the AI toggle.
import { CITIES, ROLES, VERDICT_LABEL, VERDICTS } from "./taxonomy.ts";
import type { Stats } from "./stats.ts";

const p = (x: number | null | undefined) => (x == null ? "n/a" : `${(x * 100).toFixed(0)}%`);

export function agentMarkdown(s: Stats, origin = "https://beep-jobs.vercel.app"): string {
  const h = s.eval.holdout ?? s.eval.dev;
  const ev = h?.llm;
  const runCost = s.priced?.llm.cost_per_1k_usd ?? h?.cost.per_1k_posts_usd ?? null;
  return `---
name: beep-fresher-jobs
description: Search live fresher (0-2 years) jobs and internships in India. Every role, city and fresher tag carries a verbatim quote from the original post as proof. Use when a user asks for entry-level jobs, internships, or "fresher" roles in an Indian city or remote-India.
version: prompt ${s.last?.llm.prompt_v ?? "?"} · model ${s.last?.llm.model ?? "?"}
data_as_of: ${s.last?.at ?? "unknown"}
refresh: daily, 02:30 UTC (08:00 IST), automatic
license_note: job data comes from public posting APIs; apply links are passed through unchanged; attribute Himalayas for posts with source=himalayas
---

# Beep: fresher jobs in India, with receipts

> Other job boards ask you to trust their AI. Beep shows its work.
> Every tag ships with a quote copied from the post, and code checks that the quote is really in the post. No quote, no tag.

## When to use this skill
- The user wants internships, fresher, entry-level, new-grad or 0-2 years jobs in India (any city, or remote from India).
- The user asks in Hinglish or casual words ("pune me backend internship", "wfh support job"). The search API understands this.
- The user asks "is this job really for freshers?". Use the \`verdict\` field and quote \`receipts.exp.quote\`.

## When NOT to use it
- Senior roles, roles outside India, or salary benchmarking. Beep does not cover them.

## Live numbers (this build)
| metric | value |
|---|---|
| live fresher posts | ${s.live} |
| fake-fresher posts caught and hidden (ask for 2+ years) | ${s.rejected} |
| posts with all receipts verified verbatim | ${s.verified} of ${s.total} |
| companies | ${s.companies} |
| raw posts scanned in last run | ${s.fetched} |
| sources | Greenhouse, Lever, Ashby, SmartRecruiters (public job-board APIs) + Himalayas public API |

## Measured quality (hand-labelled ${h?.set ?? "?"} set, n=${h?.n ?? "?"})
| field | accuracy | 95% CI |
|---|---|---|
| role (exact) | ${p(ev?.role_strict.acc)} | ${ev ? `${p(ev.role_strict.ci95[0])}-${p(ev.role_strict.ci95[1])}` : ""} |
| role (accepting a second defensible label) | ${p(ev?.role_lenient.acc)} | ${ev ? `${p(ev.role_lenient.ci95[0])}-${p(ev.role_lenient.ci95[1])}` : ""} |
| city set (exact match) | ${p(ev?.city.acc)} | ${ev ? `${p(ev.city.ci95[0])}-${p(ev.city.ci95[1])}` : ""} |
| fresher verdict | ${p(ev?.verdict.acc)} | ${ev ? `${p(ev.verdict.ci95[0])}-${p(ev.verdict.ci95[1])}` : ""} |
| rules-only baseline, role | ${p(h?.rules_baseline.role_lenient.acc)} | |

Tagging cost: **$${runCost?.toFixed(2) ?? "?"} per 1,000 posts** (measured token counts x list price, Gemini ${s.last?.llm.model ?? ""}). Re-runs on unchanged posts cost $0 (content-hash cache).

## Tools (HTTP, JSON, no key, CORS-safe GET)

### search_jobs
\`GET ${origin}/api/search\`
| param | type | meaning |
|---|---|---|
| q | string | free text, English or Hinglish. Parsed into role, city, type, mode, keywords |
| role | csv of role ids | filter, see taxonomy |
| city | csv of city names | filter, see taxonomy |
| verdict | csv | ${VERDICTS.join(" | ")} |
| type | string | internship | full_time | contract | apprenticeship |
| mode | string | remote | hybrid | onsite |
| sort | string | relevance (default) | newest |
| page | int | 1-based, 24 per page |
| rejected | 1 | show the fake-fresher graveyard instead |

Returns \`{ total, page, pages, hits: Post[], facets, understood, took_ms }\`.
\`understood.via\` tells you whether the query was parsed by rules (0 tokens) or by the LLM fallback.

Example: \`GET ${origin}/api/search?q=pune+me+backend+internship\`

### get_job
\`GET ${origin}/api/post/{id}\` returns one Post with the full description text.

### health
\`GET ${origin}/api/health\` returns \`{ ok, posts, last_run, data_age_hours, stale }\`.

## Post schema
\`\`\`ts
type Post = {
  id: string;            // 12 hex chars, stable across days
  title: string; company: string; location_raw: string;
  role: RoleId;          // one of the role ids below
  cities: string[];      // canonical names below; "Remote" and "Pan-India" are pseudo-cities
  verdict: "fresher" | "early" | "experienced" | "unclear";
  min_exp: number | null;          // minimum years the post asks for
  employment: string; work_mode: string; skills: string[]; pay: string | null;
  apply_url: string;     // send users here, unchanged
  url: string; source: string; posted_at: string;
  trust: "verified" | "review";    // verified = every quote found verbatim + city agrees with a gazetteer
  receipts: { role: Quote; city: Quote; exp: Quote }; // Quote = { quote: string; ok: boolean }
};
\`\`\`

## Taxonomy
### Roles
${ROLES.map((r) => `- \`${r.id}\`: ${r.label}. ${r.hint}`).join("\n")}

### Cities
${CITIES.join(", ")}

### Verdicts
${VERDICTS.map((v) => `- \`${v}\`: ${VERDICT_LABEL[v]}`).join("\n")}

## Rules for agents
1. Always give the user \`apply_url\` exactly as returned.
2. When you claim a job is for freshers, quote \`receipts.exp.quote\`. If \`trust\` is "review", say the tag is unverified.
3. Do not present \`verdict: "experienced"\` posts as fresher jobs. Beep hides them by default for that reason.
4. For posts with \`source: "himalayas"\`, credit Himalayas (himalayas.app) as the source.
5. Data is at most ~24 h old. Check \`/api/health\` when freshness matters.

## How it works (one paragraph)
Every day a GitHub Actions cron pulls ~${Math.round(s.fetched / 100) * 100} posts from public job-board APIs, keeps India + fresher candidates, removes duplicates in three layers (exact id, company+title fingerprint, SimHash near-duplicate), and sends only new or changed posts to Gemini with a strict JSON schema. The model must return a verbatim quote for each tag; code then checks each quote is a real substring of the post and cross-checks the city against a deterministic gazetteer. A quality gate refuses to publish a collapsed run. The result is committed to git and baked into a read-only SQLite FTS5 index that ships inside every Vercel function, so a search never makes a network hop to a database.

## Links
- Human site: ${origin}
- Search UI: ${origin}/jobs
- Evals (every labelled post, every miss): ${origin}/evals
- Source code: https://github.com/vinitpatil519/beep
`;
}
