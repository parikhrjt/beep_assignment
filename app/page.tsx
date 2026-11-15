import { headers } from "next/headers";
import { Landing } from "@/components/Landing";
import { agentMarkdown } from "@/lib/agent-md";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "beep-jobs.vercel.app"}`;
  const s = getStats();
  return <Landing s={s} md={agentMarkdown(s, origin)} initialView={view === "ai" ? "ai" : "human"} />;
}
