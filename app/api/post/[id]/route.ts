import { getPost } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = /^[a-f0-9]{12}$/.test(id) ? getPost(id) : null;
  if (!p) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(p, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
