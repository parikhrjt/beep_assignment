// Three-layer dedupe. Each layer is cheaper than the next and catches a different failure:
//   L1 exact      : same source + source_id (API pagination overlap, re-fetch)
//   L2 fingerprint: same company + normalised title (one job posted once per city, or mirrored by an aggregator)
//   L3 near-dup   : same company, 64-bit SimHash of description within Hamming distance 3 AND similar title
//                   (reworded titles: "Backend Intern 2026" vs "Intern - Backend")
import type { RawPost } from "./types.ts";
import { sha1 } from "./util.ts";

const SOURCE_RANK: Record<string, number> = { greenhouse: 0, lever: 0, ashby: 0, smartrecruiters: 0, himalayas: 1 }; // first-party ATS beats aggregator

export const normCompany = (c: string) => c.toLowerCase().replace(/\b(pvt|private|ltd|limited|inc|llc|technologies|technology|software|india|labs|corp|corporation|co)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
export const normTitle = (t: string) =>
  t.toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(req|r|jr|job id)[-#: ]?\d{3,}\b/g, " ")
    .replace(/\b(india|remote|hybrid|onsite|bengaluru|bangalore|hyderabad|pune|mumbai|gurgaon|gurugram|noida|delhi|chennai|kolkata)\b/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ").trim().split(" ").filter(Boolean).sort().join(" ");

export function simhash(text: string): bigint {
  const tokens = text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const v = new Int32Array(64);
  for (let i = 0; i + 2 < tokens.length; i++) {
    const h = BigInt("0x" + sha1(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`).slice(0, 16)); // 3-word shingles
    for (let b = 0; b < 64; b++) v[b] += (h >> BigInt(b)) & 1n ? 1 : -1;
  }
  let out = 0n;
  for (let b = 0; b < 64; b++) if (v[b] > 0) out |= 1n << BigInt(b);
  return out;
}
export const hamming = (a: bigint, b: bigint) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const jaccard = (a: string, b: string) => { const A = new Set(a.split(" ")), B = new Set(b.split(" ")); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

export type Cluster = { id: string; primary: RawPost; members: RawPost[] };

export function dedupe(raw: RawPost[]): { clusters: Cluster[]; removed: { exact: number; fingerprint: number; near: number } } {
  const removed = { exact: 0, fingerprint: 0, near: 0 };
  // L1
  const seen = new Map<string, RawPost>();
  for (const p of raw) { const k = `${p.source}:${p.source_id}`; if (seen.has(k)) removed.exact++; else seen.set(k, p); }
  // L2
  const byFp = new Map<string, RawPost[]>();
  for (const p of seen.values()) { const fp = `${normCompany(p.company)}|${normTitle(p.title)}`; (byFp.get(fp) ?? byFp.set(fp, []).get(fp)!).push(p); }
  let groups = [...byFp.entries()].map(([fp, members]) => ({ fp, members }));
  removed.fingerprint = seen.size - groups.length;
  // L3, blocked by company so it stays O(n * block) instead of O(n^2)
  const byCo = new Map<string, typeof groups>();
  for (const g of groups) { const co = g.fp.split("|")[0]; (byCo.get(co) ?? byCo.set(co, []).get(co)!).push(g); }
  groups = [];
  for (const block of byCo.values()) {
    const kept: { fp: string; members: RawPost[]; sh: bigint }[] = [];
    for (const g of block) {
      const sh = simhash(g.members[0].text);
      const hit = g.members[0].text.length > 400 ? kept.find((k) => hamming(k.sh, sh) <= 3 && jaccard(k.fp.split("|")[1], g.fp.split("|")[1]) >= 0.5) : undefined;
      if (hit) { hit.members.push(...g.members); removed.near++; } else kept.push({ ...g, sh });
    }
    groups.push(...kept);
  }
  const clusters = groups.map(({ fp, members }) => {
    members.sort((a, b) => (SOURCE_RANK[a.source] ?? 9) - (SOURCE_RANK[b.source] ?? 9) || b.text.length - a.text.length);
    return { id: sha1(fp).slice(0, 12), primary: members[0], members };
  });
  return { clusters, removed };
}
