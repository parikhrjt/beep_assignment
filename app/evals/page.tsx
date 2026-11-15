import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getStats, type EvalSet, type Prop } from "@/lib/stats";
import { ROLE_LABEL } from "@/lib/taxonomy";
import { n, usd } from "@/lib/format";

export const metadata: Metadata = { title: "Evals", description: "How accurate is Beep's AI tagging? 50 hand-labelled held-out posts, confidence intervals, every miss, and cost per 1,000 posts." };
export const dynamic = "force-dynamic";

const P = (p?: Prop) => (p?.acc == null ? "—" : `${(p.acc * 100).toFixed(0)}%`);
const CI = (p?: Prop) => (p ? `${(p.ci95[0] * 100).toFixed(0)}–${(p.ci95[1] * 100).toFixed(0)}%` : "");

function Meter({ p, base }: { p?: Prop; base?: Prop }) {
  if (!p?.acc) return null;
  return (
    <div className="meter" title={`95% CI ${CI(p)}`}>
      <i style={{ width: `${p.acc * 100}%` }} />
      <u style={{ left: `${p.ci95[0] * 100}%`, width: `${(p.ci95[1] - p.ci95[0]) * 100}%` }} />
      {base?.acc != null && <span style={{ position: "absolute", left: `${base.acc * 100}%`, top: -6, bottom: -6, width: 2, background: "var(--muted)" }} title={`rules baseline ${P(base)}`} />}
    </div>
  );
}

function Score({ e, label }: { e: EvalSet; label: string }) {
  const rows: [string, Prop, Prop | undefined, string][] = [
    ["Role (exact)", e.llm.role_strict, e.rules_baseline.role_strict, "Model's role equals the human's first choice."],
    ["Role (lenient)", e.llm.role_lenient, e.rules_baseline.role_lenient, "Also accepts the human's pre-registered second label for genuinely ambiguous posts."],
    ["City set", e.llm.city, e.rules_baseline.city, "The full set of cities must match exactly. One extra or missing city counts as wrong."],
    ["Role AND city", e.llm.role_and_city, e.rules_baseline.role_and_city, "Both right on the same post: the number that matters for search."],
    ["Fresher verdict", e.llm.verdict, e.rules_baseline.verdict, "Only posts where a human could decide from the text."],
  ];
  return (
    <div className="panel">
      <div className="eyebrow">{label} · n = {e.n} · prompt {e.prompt_v}</div>
      <table className="tbl" style={{ marginTop: 14 }}>
        <thead><tr><th>Field</th><th className="r">LLM</th><th className="r">95% CI</th><th className="r">Rules only</th></tr></thead>
        <tbody>
          {rows.map(([k, p, b, why]) => (
            <tr key={k}>
              <td><div style={{ fontWeight: 520 }}>{k}</div><div style={{ color: "var(--muted)", fontSize: 12.5 }}>{why}</div><Meter p={p} base={b} /></td>
              <td className="r" style={{ fontSize: 18, color: "var(--ink)" }}>{P(p)}<div style={{ fontSize: 11, color: "var(--muted)" }}>{p.k}/{p.n}</div></td>
              <td className="r" style={{ color: "var(--muted)" }}>{CI(p)}</td>
              <td className="r" style={{ color: "var(--muted)" }}>{P(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Evals() {
  const s = getStats();
  const h = s.eval.holdout, d = s.eval.dev;
  const main = h ?? d;
  const run = s.priced;
  return (
    <>
      <Nav active="evals" />
      <main className="evals wrap">
        <div className="eyebrow">Evals · measured in public</div>
        <h1>How often is the AI <span className="serif accent">wrong?</span></h1>
        <p className="sub">We hand-labelled posts without looking at the model&apos;s answers, then scored the production tagger against them. The prompt was tuned on a separate dev set; the held-out set below was never used for tuning, so its score is the honest one.</p>

        {main && (
          <div className="nums">
            <div className="num"><b>{P(main.llm.role_lenient)}</b><span>Role accuracy</span><small>strict {P(main.llm.role_strict)} · CI {CI(main.llm.role_lenient)}</small></div>
            <div className="num"><b>{P(main.llm.city)}</b><span>City accuracy</span><small>CI {CI(main.llm.city)}</small></div>
            <div className="num"><b>{P(main.llm.verdict)}</b><span>Fresher verdict</span><small>CI {CI(main.llm.verdict)}</small></div>
            <div className="num"><b>{usd(run?.llm.cost_per_1k_usd ?? main.cost.per_1k_posts_usd)}</b><span>Per 1,000 posts</span><small>{run ? `production run, ${n(run.llm.posts_tagged)} posts` : "eval run"}</small></div>
          </div>
        )}

        <div className="grid2">
          <div style={{ display: "grid", gap: 20 }}>
            {h && <Score e={h} label="Held-out set (headline)" />}
            {d && <Score e={d} label="Dev set (prompt tuned on this, optimistic)" />}
          </div>
          <div style={{ display: "grid", gap: 20 }}>
            <div className="panel">
              <div className="eyebrow">Cost, from measured tokens</div>
              {run && (
                <table className="tbl" style={{ marginTop: 14 }}>
                  <tbody>
                    <tr><td>Model</td><td className="r">{run.llm.model}</td></tr>
                    <tr><td>Posts tagged</td><td className="r">{n(run.llm.posts_tagged)}</td></tr>
                    <tr><td>API calls (batches of 8)</td><td className="r">{n(run.llm.calls)}</td></tr>
                    <tr><td>Input tokens</td><td className="r">{n(run.llm.in_tokens)}</td></tr>
                    <tr><td>Output tokens (incl. thinking)</td><td className="r">{n(run.llm.out_tokens)}</td></tr>
                    <tr><td>List price in / out per 1M</td><td className="r">${main?.cost.price.in_per_m} / ${main?.cost.price.out_per_m}</td></tr>
                    <tr><td>Run cost</td><td className="r">{usd(run.llm.cost_usd, 4)}</td></tr>
                    <tr><td><b>Per 1,000 posts</b></td><td className="r" style={{ color: "var(--accent)", fontSize: 18 }}>{usd(run.llm.cost_per_1k_usd, 3)}</td></tr>
                    <tr><td>Steady-state daily cost</td><td className="r">≈ new posts × {usd((run.llm.cost_per_1k_usd ?? 0) / 1000, 5)}</td></tr>
                  </tbody>
                </table>
              )}
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>Unchanged posts hit a content-hash cache and cost $0. Gemini Batch API would halve the price; we skip it because it adds hours of latency to a daily refresh. Price source: <a href={main?.cost.price.source} style={{ textDecoration: "underline" }}>Google AI pricing</a>, read {main?.cost.price.as_of}.</p>
            </div>
            <div className="panel">
              <div className="eyebrow">Receipts</div>
              {main && <p style={{ marginTop: 12, fontSize: 15 }}><b style={{ fontSize: 28, fontFamily: "var(--mono)" }}>{((main.receipts.verbatim / main.receipts.quotes_checked) * 100).toFixed(1)}%</b><br /><span style={{ color: "var(--muted)" }}>of {main.receipts.quotes_checked} evidence quotes were found verbatim in the post.</span></p>}
              {main?.by_trust?.verified && <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 10 }}>On posts marked <b style={{ color: "var(--ok)" }}>verified</b>: role {P(main.by_trust.verified.role_lenient)}, city {P(main.by_trust.verified.city)} (n = {main.by_trust.verified.city.n}).</p>}
            </div>
            <div className="note">
              <b>Who labelled this.</b> Labels were made by {main?.labeled_by ?? "—"}, reading each post without seeing the model output. {main?.human_verified ? `${main.human_verified} labels were verified by a person.` : "No labels have been verified by a second person yet."} The role taxonomy has fuzzy edges (is a telecaller for loan collections “sales” or “operations”?), so we report a strict number and a lenient one that also accepts a second label we wrote down before scoring.
            </div>
            <div className="note"><b>n = 50 is small.</b> A 95% interval on 94% is roughly 84–98%. Read the intervals, not just the point estimates.</div>
          </div>
        </div>

        {main && (
          <>
            <h2 className="h3">Every labelled post ({main.set} set)</h2>
            <div className="panel scroll-x" style={{ padding: 0 }}>
              <table className="tbl" style={{ minWidth: 860 }}>
                <thead><tr><th>Post</th><th>Human role</th><th>Model role</th><th>Human cities</th><th>Model cities</th><th>Verdict (human / model)</th></tr></thead>
                <tbody>
                  {main.items.map((it) => {
                    const miss = !it.ok.role || !it.ok.city || it.ok.verdict === false;
                    return (
                      <tr key={it.id} className={miss ? "miss" : ""}>
                        <td style={{ maxWidth: 260 }}><div style={{ fontWeight: 520 }}>{it.title}</div><div style={{ color: "var(--muted)", fontSize: 12.5 }}>{it.company} · {it.source}</div></td>
                        <td>{ROLE_LABEL[it.gold.role]}{it.gold.role_alt && <div style={{ color: "var(--muted)", fontSize: 12 }}>or {ROLE_LABEL[it.gold.role_alt]}</div>}</td>
                        <td style={{ color: it.ok.role ? "var(--ok)" : "var(--bad)" }}>{ROLE_LABEL[it.pred.role]}</td>
                        <td>{it.gold.cities.join(", ")}</td>
                        <td style={{ color: it.ok.city ? "var(--ok)" : "var(--bad)" }}>{it.pred.cities.join(", ")}</td>
                        <td style={{ color: it.ok.verdict === false ? "var(--bad)" : it.ok.verdict ? "var(--ok)" : "var(--muted)" }}>{it.gold.verdict ?? "n/a"} / {it.pred.verdict}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="h3">Daily runs</h2>
        <div className="panel scroll-x" style={{ padding: 0 }}>
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead><tr><th>Run</th><th className="r">Read</th><th className="r">Candidates</th><th className="r">Dupes removed</th><th className="r">Tagged</th><th className="r">Cache hits</th><th className="r">Cost</th><th className="r">Live</th></tr></thead>
            <tbody>
              {[...s.runs].reverse().map((r) => (
                <tr key={r.run_id}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{r.run_id}<div style={{ color: "var(--muted)" }}>prompt {r.llm.prompt_v}</div></td>
                  <td className="r">{n(Object.values(r.sources).reduce((a, x) => a + x.fetched, 0))}</td>
                  <td className="r">{n(r.candidates)}</td>
                  <td className="r">{n(r.duplicates_removed)}</td>
                  <td className="r">{n(r.llm.posts_tagged)}</td>
                  <td className="r">{n(r.llm.cache_hits)}</td>
                  <td className="r">{usd(r.llm.cost_usd, 3)}</td>
                  <td className="r">{n(r.published)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 30 }}><Link className="btn btn-ghost" href="/jobs">← Back to jobs</Link></p>
      </main>
    </>
  );
}
