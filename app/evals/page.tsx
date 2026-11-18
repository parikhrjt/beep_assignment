import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getStats, type EvalSet, type Prop } from "@/lib/stats";
import { ROLE_LABEL } from "@/lib/taxonomy";
import { n, usd } from "@/lib/format";

export const metadata: Metadata = { title: "Accuracy", description: "How accurate is the AI tagging on beep-jobs? A held-out set of hand-labelled posts, 95% confidence intervals, every miss, and the cost per 1,000 posts." };
export const dynamic = "force-dynamic";

const P = (p?: Prop) => (p?.acc == null ? "n/a" : `${(p.acc * 100).toFixed(0)}%`);
const CI = (p?: Prop) => (p ? `${(p.ci95[0] * 100).toFixed(0)} to ${(p.ci95[1] * 100).toFixed(0)}%` : "");

function Meter({ p, base }: { p?: Prop; base?: Prop }) {
  if (!p?.acc) return null;
  return (
    <div className="meter" title={`95% range ${CI(p)}`} aria-hidden>
      <u style={{ left: `${p.ci95[0] * 100}%`, width: `${(p.ci95[1] - p.ci95[0]) * 100}%` }} />
      <i style={{ width: `${p.acc * 100}%`, height: 6 }} />
      {base?.acc != null && <s style={{ left: `${base.acc * 100}%` }} title={`rules only ${P(base)}`} />}
    </div>
  );
}

function Score({ e }: { e: EvalSet }) {
  const rows: [string, Prop, Prop | undefined, string][] = [
    ["Role, one label", e.llm.role_strict, e.rules_baseline.role_strict, "The model's role equals the labeller's first choice."],
    ["Role", e.llm.role_lenient, e.rules_baseline.role_lenient, "Also accepts a second label, written down before scoring, for posts that fit two roles."],
    ["City", e.llm.city, e.rules_baseline.city, "The full set of cities must match. One extra or missing city counts as wrong."],
    ["Role and city both right", e.llm.role_and_city, e.rules_baseline.role_and_city, "Both right on the same post. This is what search depends on."],
    ["Fresher or not", e.llm.verdict, e.rules_baseline.verdict, "Only posts where the text lets a person decide."],
  ];
  return (
    <table className="tbl">
      <thead><tr><th>Tag</th><th className="r">AI</th><th className="r">95% range</th><th className="r">Rules only</th></tr></thead>
      <tbody>
        {rows.map(([k, p, b, why]) => (
          <tr key={k}>
            <td><div style={{ fontWeight: 600 }}>{k}</div><div className="sm">{why}</div><Meter p={p} base={b} /></td>
            <td className="r" style={{ fontSize: 20, fontWeight: 600 }}>{P(p)}<div className="sm">{p.k} of {p.n}</div></td>
            <td className="r sm">{CI(p)}</td>
            <td className="r sm">{P(b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
        <h1 className="display">How often the AI is wrong</h1>
        <p className="lede">
          Posts were labelled by reading them, without seeing the model&rsquo;s answers, and the production tagger was scored against those labels.
          The prompt was tuned on a separate dev set. The held-out set was labelled after tuning finished and never used to change anything, so its score is the one to quote.
        </p>

        {main && (
          <div className="ev-figs">
            <div><b>{P(main.llm.role_lenient)}</b><span>Role</span><small>{CI(main.llm.role_lenient)}, one-label {P(main.llm.role_strict)}</small></div>
            <div><b>{P(main.llm.city)}</b><span>City</span><small>{CI(main.llm.city)}</small></div>
            <div><b>{P(main.llm.verdict)}</b><span>Fresher or not</span><small>{CI(main.llm.verdict)}</small></div>
            <div><b>{usd(run?.llm.cost_per_1k_usd ?? main.cost.per_1k_posts_usd)}</b><span>Per 1,000 posts</span><small>{run ? `measured on ${n(run.llm.posts_tagged)} posts` : "measured on the eval run"}</small></div>
          </div>
        )}

        <div className="ev-grid">
          <div style={{ display: "grid", gap: 48 }}>
            {h && <div><h2>Held-out set, {h.n} posts</h2><p className="sub2">Labelled after the prompt was final. Prompt {h.prompt_v}, model {h.model}.</p><Score e={h} /></div>}
            {d && <div><h2>Dev set, {d.n} posts</h2><p className="sub2">The prompt was tuned on these posts, so this score is optimistic.</p><Score e={d} /></div>}
          </div>
          <div className="ev-side">
            {run && (
              <div>
                <h2>Cost</h2>
                <table className="tbl" style={{ marginTop: 10 }}>
                  <tbody>
                    <tr><td>Model</td><td className="r">{run.llm.model}</td></tr>
                    <tr><td>Posts tagged</td><td className="r">{n(run.llm.posts_tagged)}</td></tr>
                    <tr><td>API calls, 8 posts each</td><td className="r">{n(run.llm.calls)}</td></tr>
                    <tr><td>Input tokens</td><td className="r">{n(run.llm.in_tokens)}</td></tr>
                    <tr><td>Output tokens, with thinking</td><td className="r">{n(run.llm.out_tokens)}</td></tr>
                    <tr><td>Price per 1M tokens, in and out</td><td className="r">${main?.cost.price.in_per_m} and ${main?.cost.price.out_per_m}</td></tr>
                    <tr><td>Run cost</td><td className="r">{usd(run.llm.cost_usd, 4)}</td></tr>
                    <tr><td><b>Per 1,000 posts</b></td><td className="r"><b>{usd(run.llm.cost_per_1k_usd, 3)}</b></td></tr>
                  </tbody>
                </table>
                <p>A post that has not changed is not sent again, so a quiet day costs almost nothing. Price from <a className="link" href={main?.cost.price.source}>Google AI pricing</a>, read {main?.cost.price.as_of}.</p>
              </div>
            )}
            {main && (
              <div>
                <h2>Receipts</h2>
                <p><b>{((main.receipts.verbatim / main.receipts.quotes_checked) * 100).toFixed(1)}%</b> of {main.receipts.quotes_checked} quotes were found word for word in the post.</p>
                {main.by_trust?.verified && <p>On posts marked verified: role {P(main.by_trust.verified.role_lenient)}, city {P(main.by_trust.verified.city)}, over {main.by_trust.verified.city.n} posts.</p>}
              </div>
            )}
            <div>
              <h2>Who labelled</h2>
              <p>{main?.labeled_by ?? "n/a"}, reading each post without seeing the model&rsquo;s answer, following the written guide in <a className="link" href="https://github.com/parikhrjt/beep_assignment/blob/main/docs/LABELING.md">LABELING.md</a>. {main?.human_verified ? `${main.human_verified} labels were checked by a person.` : "No person has checked the labels yet."}</p>
              <p>Some posts fit two roles (is a collections telecaller in sales or operations?), so there is a one-label score and a score that also accepts a second label written down before scoring.</p>
            </div>
          </div>
        </div>

        {main && (
          <section>
            <h2>Every post in the {main === h ? "held-out" : "dev"} set</h2>
            <p className="sub2" style={{ color: "var(--muted)", marginBottom: 14 }}>Rows with a miss are shaded.</p>
            <div className="scroll-x">
              <table className="tbl" style={{ minWidth: 860 }}>
                <thead><tr><th>Post</th><th>Label role</th><th>AI role</th><th>Label cities</th><th>AI cities</th><th>Fresher (label, AI)</th></tr></thead>
                <tbody>
                  {main.items.map((it) => {
                    const miss = !it.ok.role || !it.ok.city || it.ok.verdict === false;
                    return (
                      <tr key={it.id} className={miss ? "miss" : ""}>
                        <td style={{ maxWidth: 280 }}><div style={{ fontWeight: 600 }}>{it.title}</div><div className="sm">{it.company}</div></td>
                        <td>{ROLE_LABEL[it.gold.role]}{it.gold.role_alt && <div className="sm">or {ROLE_LABEL[it.gold.role_alt]}</div>}</td>
                        <td style={{ color: it.ok.role ? undefined : "var(--bad)" }}>{ROLE_LABEL[it.pred.role]}</td>
                        <td>{it.gold.cities.join(", ")}</td>
                        <td style={{ color: it.ok.city ? undefined : "var(--bad)" }}>{it.pred.cities.join(", ")}</td>
                        <td style={{ color: it.ok.verdict === false ? "var(--bad)" : undefined }}>{it.gold.verdict ?? "n/a"}, {it.pred.verdict}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2>Daily runs</h2>
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead><tr><th>Run</th><th className="r">Read</th><th className="r">Candidates</th><th className="r">Copies removed</th><th className="r">Sent to AI</th><th className="r">From cache</th><th className="r">Cost</th><th className="r">Published</th></tr></thead>
              <tbody>
                {[...s.runs].reverse().map((r) => (
                  <tr key={r.run_id}>
                    <td>{new Date(r.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}<div className="sm">prompt {r.llm.prompt_v}</div></td>
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
        </section>
        <p style={{ marginTop: 40 }}><Link className="btn btn-ghost" href="/jobs">Search jobs</Link></p>
      </main>
    </>
  );
}
