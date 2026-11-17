// Source adapters. Every source here is a PUBLIC, documented job-posting API that the
// publisher exposes for exactly this purpose. No HTML scraping, no logins, no ToS-walled
// sites (Internshala / Naukri / LinkedIn are deliberately excluded - see docs/COMPLIANCE.md).
import { readFileSync } from "node:fs";
import { INDIA_RE } from "../../lib/taxonomy.ts";
import type { RawPost, SourceStat } from "../types.ts";
import { getJSON, htmlToText, pool, sleep } from "../util.ts";

const registry: Record<string, string[]> = JSON.parse(readFileSync(new URL("./registry.json", import.meta.url), "utf8"));
const iso = (d: unknown) => {
  if (!d) return null;
  const t = new Date(typeof d === "number" && d < 1e11 ? d * 1000 : (d as string | number));
  return Number.isNaN(+t) ? null : t.toISOString().slice(0, 10);
};
const pretty = (slug: string) => slug.replace(/(softwareprivatelimited|inc|1)$/i, "").replace(/(^|[-_ ])(\w)/g, (_, a, b) => (a ? " " : "") + b.toUpperCase());

type Adapter = (board: string) => Promise<RawPost[] | null>;

const greenhouse: Adapter = async (b) => {
  const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true`);
  return d?.jobs?.map((j: any): RawPost => ({
    source: "greenhouse", source_id: String(j.id), board: b, url: j.absolute_url, apply_url: j.absolute_url,
    title: j.title, company: j.company_name || pretty(b),
    location_raw: [j.location?.name, ...(j.offices || []).map((o: any) => o.location || o.name)].filter(Boolean).join("; "),
    text: htmlToText(j.content || ""), posted_at: iso(j.first_published || j.updated_at),
  })) ?? null;
};

const lever: Adapter = async (b) => {
  const d = await getJSON(`https://api.lever.co/v0/postings/${b}?mode=json`);
  if (!Array.isArray(d)) return null;
  return d.map((j: any): RawPost => ({
    source: "lever", source_id: j.id, board: b, url: j.hostedUrl, apply_url: j.applyUrl || j.hostedUrl,
    title: j.text, company: pretty(b),
    location_raw: [...new Set([j.categories?.location, ...(j.categories?.allLocations || [])])].filter(Boolean).join("; ") + (j.workplaceType ? ` (${j.workplaceType})` : ""),
    text: [j.descriptionPlain, ...(j.lists || []).map((l: any) => `${l.text}\n${htmlToText(l.content || "")}`), j.additionalPlain].filter(Boolean).join("\n").trim(),
    posted_at: iso(j.createdAt), employment_hint: j.categories?.commitment,
  }));
};

const ashby: Adapter = async (b) => {
  const d = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${b}`);
  return d?.jobs?.filter((j: any) => j.isListed !== false).map((j: any): RawPost => ({
    source: "ashby", source_id: j.id, board: b, url: j.jobUrl, apply_url: j.applyUrl || j.jobUrl,
    title: j.title, company: pretty(b),
    location_raw: [j.location, ...(j.secondaryLocations || []).map((s: any) => s.location), j.address?.postalAddress?.addressCountry].filter(Boolean).join("; ") + (j.isRemote ? " (Remote)" : ""),
    text: j.descriptionPlain || htmlToText(j.descriptionHtml || ""), posted_at: iso(j.publishedAt), employment_hint: j.employmentType,
  })) ?? null;
};

const smartrecruiters: Adapter = async (b) => {
  const out: RawPost[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const d = await getJSON(`https://api.smartrecruiters.com/v1/companies/${b}/postings?country=in&limit=100&offset=${offset}`);
    if (!d?.content?.length) break;
    const details = await pool(d.content as any[], 4, async (p) => (await getJSON(`https://api.smartrecruiters.com/v1/companies/${b}/postings/${p.id}`).catch(() => null)) ?? p);
    for (const j of details) {
      const s = j.jobAd?.sections || {};
      out.push({
        source: "smartrecruiters", source_id: String(j.id), board: b,
        url: j.postingUrl || `https://jobs.smartrecruiters.com/${b}/${j.id}`, apply_url: j.applyUrl || j.postingUrl || `https://jobs.smartrecruiters.com/${b}/${j.id}`,
        title: j.name, company: j.company?.name || pretty(b),
        location_raw: [j.location?.city, j.location?.region, "India"].filter(Boolean).join(", ") + (j.location?.remote ? " (Remote)" : ""),
        text: htmlToText([s.jobDescription?.text, s.qualifications?.text, s.additionalInformation?.text].filter(Boolean).join("\n")),
        posted_at: iso(j.releasedDate), employment_hint: [j.typeOfEmployment?.label, j.experienceLevel?.label].filter(Boolean).join(", "),
      });
    }
    if (d.content.length < 100) break;
  }
  return out.length ? out : null;
};

const ADAPTERS: Record<string, Adapter> = { greenhouse, lever, ashby, smartrecruiters };

/** Himalayas public remote-jobs API. Terms honoured: visible link back, applicationLink unchanged, expired jobs removed, no re-syndication markup. */
async function himalayas(stat: SourceStat): Promise<RawPost[]> {
  const out: RawPost[] = [];
  const now = Date.now() / 1000;
  for (let page = 1; page <= 45; page++) {
    const d = await getJSON(`https://himalayas.app/jobs/api/search?country=IN&seniority=Entry-level&sort=recent&page=${page}`);
    if (!d?.jobs?.length) break;
    stat.fetched += d.jobs.length;
    for (const j of d.jobs) {
      const locs: string[] = j.locationRestrictions || [];
      if (!locs.includes("India")) continue; // worldwide-remote posts are not "jobs in India"
      if (j.expiryDate && j.expiryDate < now) continue;
      out.push({
        source: "himalayas", source_id: j.guid, board: "himalayas", url: j.guid, apply_url: j.applicationLink,
        title: String(j.title).replace(/^[^\p{L}\p{N}]+/u, ""), company: j.companyName,
        location_raw: locs.length === 1 ? "Remote, India" : `Remote (${locs.slice(0, 6).join(", ")})`,
        text: htmlToText(j.description || j.excerpt || ""), posted_at: iso(j.pubDate), employment_hint: j.employmentType,
      });
    }
    await sleep(1100); // stay far below the documented per-minute limit
  }
  stat.india = out.length;
  return out;
}

/** Cheap pre-LLM gate: does this post look like it could be for a fresher? High recall on purpose; the LLM gives the real verdict. */
const TITLE_FRESH = /\b(intern|internship|trainee|graduate|fresher|freshers|new grad|entry[- ]level|apprentice|junior|jr\.?|associate|campus|university|early career|early talent|sde[- ]?1|sde i|engineer i|analyst i|level 1|grad)\b/i;
const TITLE_SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head|vp|architect|president|ii|iii|iv|2|3|4)\b/i;
const TEXT_FRESH = /\b(fresher|freshers|fresh graduate|recent graduate|new graduate|final[- ]year student|currently pursuing|202[5-8] (batch|graduat|pass)|batch of 202[5-8]|graduating in 202[5-8]|no prior experience)/i;
// The board covers 0 to 2 years, so a stated minimum of 0, 1 or 2 years makes a post worth reading ("1-3 years", "2+ years of experience").
const TEXT_YEARS = /(?<![\d.])[0-2]\s*(\+|plus)?\s*((-|–|—|to)\s*\d{1,2}\s*\+?\s*)?(years?|yrs?)\b[^.\n]{0,40}\bexperience|\bexperience\b[^.\n]{0,20}\b[0-2]\s*((-|–|—|to)\s*\d{1,2}\s*)?(years?|yrs?)\b/i;
const HINT_FRESH = /\b(entry|intern|graduate|student|apprentice|trainee)/i; // SmartRecruiters' own experienceLevel / type labels
const TITLE_BOSS = /\b(senior|sr\.?|staff|principal|lead|manager|director|head|vp|architect|president)\b/i; // "Associate Director" is not a fresher job
export const looksFresher = (p: RawPost) =>
  (TITLE_FRESH.test(p.title) && !TITLE_BOSS.test(p.title)) ||
  (!TITLE_SENIOR.test(p.title) && (TEXT_FRESH.test(p.text.slice(0, 8000)) || TEXT_YEARS.test(p.text.slice(0, 8000)) || HINT_FRESH.test(p.employment_hint ?? "")));

export async function collect(): Promise<{ posts: RawPost[]; stats: Record<string, SourceStat>; failedSources: Set<string> }> {
  const stats: Record<string, SourceStat> = {};
  const failedSources = new Set<string>();
  const posts: RawPost[] = [];
  for (const [ats, boards] of Object.entries(registry)) {
    const st: SourceStat = (stats[ats] = { boards: boards.length, fetched: 0, india: 0, candidates: 0, errors: 0 });
    // Each board is isolated: one dead board never fails the run.
    const res = await pool(boards, 6, async (b) => {
      try { return (await ADAPTERS[ats](b)) ?? []; } catch (e) { st.errors++; st.first_error ??= String((e as Error)?.message ?? e).slice(0, 200); return []; }
    });
    for (const p of res.flat()) {
      st.fetched++;
      if (!INDIA_RE.test(p.location_raw)) continue;
      st.india++;
      if (!p.title || !looksFresher(p)) continue;
      st.candidates++;
      posts.push(p);
    }
    if (st.errors > boards.length / 2) failedSources.add(ats);
  }
  const hs: SourceStat = (stats.himalayas = { boards: 1, fetched: 0, india: 0, candidates: 0, errors: 0 });
  try {
    const h = await himalayas(hs);
    hs.candidates = h.length;
    posts.push(...h);
  } catch (e) { hs.errors++; hs.first_error = String((e as Error)?.message ?? e).slice(0, 200); failedSources.add("himalayas"); }
  return { posts, stats, failedSources };
}
