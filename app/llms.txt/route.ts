import { agentMarkdown } from "@/lib/agent-md";
import { getStats } from "@/lib/stats";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const md = agentMarkdown(getStats(), new URL(req.url).origin);
  return new Response(md, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
