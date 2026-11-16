import { headers } from "next/headers";
import { Landing } from "@/components/Landing";
import { agentMarkdown } from "@/lib/agent-md";
import { countRules } from "@/lib/search";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Real queries, parsed by the real rules layer, with today's real result counts. Examples with no jobs today are dropped.
const EXAMPLES = ["pune me backend internship", "wfh customer support chahiye", "remote marketing internship", "bengaluru software intern", "remote ui ux designer"];

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "beep-jobs.vercel.app"}`;
  const s = getStats();
  const examples = EXAMPLES.map(countRules).filter((e) => e.total > 0).slice(0, 4);
  return <Landing s={s} examples={examples} md={agentMarkdown(s, origin)} initialView={view === "ai" ? "ai" : "human"} />;
}
