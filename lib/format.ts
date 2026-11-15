export const n = (x: number) => x.toLocaleString("en-IN");
export const pct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
export const usd = (x: number | null | undefined, d = 2) => (x == null ? "—" : `$${x.toFixed(d)}`);
export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : "1y+ ago";
}
export const SOURCE_LABEL: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", himalayas: "Himalayas" };
