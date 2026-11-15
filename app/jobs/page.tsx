import type { Metadata } from "next";
import { JobsApp } from "@/components/JobsApp";
import { Nav } from "@/components/Nav";
import { getStats } from "@/lib/stats";
import { parseParams, search } from "@/lib/search";

export const metadata: Metadata = { title: "Jobs", description: "Search India fresher jobs and internships. Every AI tag shows the quote that proves it." };
export const dynamic = "force-dynamic";

export default async function Jobs({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const sp = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (v == null ? [] : [[k, Array.isArray(v) ? v[0] : v]])));
  const f = parseParams(sp);
  const initial = await search(f);
  const st = getStats();
  return (
    <>
      <Nav active="jobs" />
      <JobsApp
        initial={initial}
        initialState={{ q: f.q, role: f.roles, city: f.cities, verdict: f.verdict, type: f.employment ?? "", mode: f.mode ?? "", sort: f.sort, page: f.page, rejected: f.rejected }}
        freshness={{ at: st.last?.at ?? null, live: st.live, rejected: st.rejected }}
      />
    </>
  );
}
