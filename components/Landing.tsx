"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Nav } from "./Nav";
import { Receipt } from "./Receipt";
import type { Stats } from "@/lib/stats";
import type { Understood } from "@/lib/understand";
import { ROLE_LABEL } from "@/lib/taxonomy";
import { n } from "@/lib/format";

type View = "human" | "ai";
export type Example = { q: string; u: Understood; total: number };

export function Landing({ s, examples, md, initialView }: { s: Stats; examples: Example[]; md: string; initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const pick = (v: View) => {
    setView(v);
    const u = new URL(window.location.href);
    if (v === "ai") u.searchParams.set("view", "ai"); else u.searchParams.delete("view");
    window.history.replaceState(null, "", u);
    window.scrollTo(0, 0);
  };
  const toggle = (
    <div className="toggle" data-view={view} role="group" aria-label="Who is reading this page">
      <span className="knob" aria-hidden />
      <button aria-pressed={view === "human"} onClick={() => pick("human")}>Human</button>
      <button aria-pressed={view === "ai"} onClick={() => pick("ai")}>AI</button>
    </div>
  );
  return (
    <>
      <Nav active="home" toggle={toggle} />
      {view === "human" ? <Human s={s} examples={examples} /> : <AgentView md={md} />}
    </>
  );
}

/* ───────────────────────── AI view ───────────────────────── */
function AgentView({ md }: { md: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <main className="ai-view wrap">
      <div className="ai-bar">
        <span>The same page, written as a skill file for AI agents ({md.length.toLocaleString()} characters).</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? "Copied" : "Copy markdown"}</button>
          <a className="btn btn-primary btn-sm" href="/llms.txt">Open /llms.txt</a>
        </span>
      </div>
      <pre className="ai-doc">
        {md.split("\n").map((l, i) => (
          <span key={i} style={l.startsWith("#") ? { color: "var(--ink)", fontWeight: 600 } : l.startsWith("|") || l === "---" ? { color: "var(--muted)" } : undefined}>
            {l}
            {"\n"}
          </span>
        ))}
      </pre>
    </main>
  );
}

/* ───────────────────────── Human view ───────────────────────── */
function Mark({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

const ist = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }) : null;
const pc = (x?: number | null) => `${Math.round((x ?? 0) * 100)}%`;
const EMP: Record<string, string> = { internship: "Internship", full_time: "Full time", contract: "Contract", apprenticeship: "Apprenticeship" };
const MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On site" };

function Human({ s, examples }: { s: Stats; examples: Example[] }) {
  const root = useRef<HTMLDivElement>(null);
  const ev = s.eval.holdout ?? s.eval.dev;
  const cost = s.priced?.llm.cost_per_1k_usd ?? ev?.cost.per_1k_posts_usd ?? 0;
  const sample = s.sample;
  const updated = ist(s.last?.at);
  const caught = s.caught;
  const maxYears = Math.max(0, ...caught.map((c) => c.min_exp ?? 0));

  useEffect(() => {
    let alive = true;
    let cleanup = () => {};
    (async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]);
      if (!alive || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lenis = reduce ? null : new Lenis({ lerp: 0.12 });
      const raf = (t: number) => lenis?.raf(t * 1000);
      if (lenis) { lenis.on("scroll", ScrollTrigger.update); gsap.ticker.add(raf); gsap.ticker.lagSmoothing(0); }

      const ctx = gsap.context(() => {
        if (reduce) return;
        const q = gsap.utils.selector(root);
        // The one page-load moment: the receipt prints, line by line.
        gsap.timeline({ defaults: { ease: "expo.out" } })
          .from(q(".printer .slot"), { scaleX: 0.6, opacity: 0, duration: 0.7 })
          .from(q(".printer .receipt"), { yPercent: -100, duration: 2.6, ease: "steps(26)" }, "-=0.2");

        // Receipt feature: highlights snap on one by one, tags pop.
        gsap.timeline({ scrollTrigger: { trigger: q(".f-receipt")[0], start: "top 62%" } })
          .from(q(".f-receipt .doc"), { opacity: 0, y: 24, duration: 0.7, ease: "power3.out" })
          .add(() => q(".f-receipt mark").forEach((m, i) => setTimeout(() => m.classList.add("on"), i * 380)))
          .from(q(".f-receipt .tagrow > *"), { scale: 0.6, opacity: 0, stagger: 0.12, duration: 0.5, ease: "back.out(2.2)" }, "+=0.9");

        // Funnel bars draw to their true width once, so the drop from thousands to hundreds is seen, not just read.
        gsap.from(q(".l-funnel .bar i"), { scaleX: 0, duration: 1.1, stagger: 0.1, ease: "power2.out", scrollTrigger: { trigger: q(".l-funnel")[0], start: "top 78%" } });
      }, root);
      cleanup = () => { ctx.revert(); if (lenis) { gsap.ticker.remove(raf); lenis.destroy(); } };
    })();
    return () => { alive = false; cleanup(); };
  }, []);

  const funnel: [string, string, number][] = [
    ["Read", `${s.boards} company job boards on Greenhouse, Lever, Ashby and SmartRecruiters, plus the Himalayas API`, s.fetched],
    ["In India", "An Indian city, or remote and open to people in India", s.india],
    ["Could suit a fresher", "A quick keyword check. Borderline posts go through, because the AI decides next", s.last?.candidates ?? 0],
    ["Copies removed", `${n(s.last?.duplicates_removed ?? 0)} were the same job posted twice, or reworded`, s.last?.after_dedupe ?? 0],
    ["Live", `The AI read every post and hid ${n(s.rejected)} that ask for more than 2 years`, s.live],
  ];

  return (
    <div ref={root}>
      {/* HERO */}
      <section className="l-hero">
        <div className="wrap l-hero-in">
          <div>
            <h1 className="l-h1 display">Jobs a fresher can actually get</h1>
            <p className="l-lede">
              {n(s.live)} jobs and internships in India for 0 to 2 years of experience. Each role, city and fresher label shows the sentence from the post that proves it.
            </p>
            <form className="l-search" action="/jobs" role="search">
              <label htmlFor="hero-q" className="sr">Search jobs</label>
              <input id="hero-q" name="q" placeholder={examples[0]?.q ?? "pune me backend internship"} autoComplete="off" />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>
            <p className="l-try">
              Try{" "}
              {examples.slice(1, 4).map((e) => <Link key={e.q} href={`/jobs?q=${encodeURIComponent(e.q)}`}>{e.q}</Link>)}
            </p>
          </div>
          <div className="printer" aria-label="Example tag receipt">
            <div className="slot" />
            <div className="feed">{sample && <Receipt p={sample} />}</div>
          </div>
        </div>
      </section>

      {/* LATEST */}
      {s.latest.length > 0 && (
        <section className="l-sec">
          <div className="wrap">
            <div className="l-head">
              <div>
                <h2 className="l-h2 display">New fresher jobs</h2>
                {updated && <p className="l-p">Checked {n(s.fetched)} posts on {updated} IST. Each line in green is copied from the post.</p>}
              </div>
              <Link className="link" href="/jobs?sort=newest">See all {n(s.live)} jobs</Link>
            </div>
            <ul className="l-jobs">
              {s.latest.map((j) => (
                <li key={j.id}>
                  <a href={j.apply_url} target="_blank" rel="noopener noreferrer nofollow">
                    <h3>{j.title}</h3>
                    <div className="where">{j.company}, {j.cities.join(" and ")}</div>
                    {j.receipts.exp.quote && <div className="why">Fresher <q>{j.receipts.exp.quote}</q></div>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* RECEIPTS */}
      <section className="sec f-receipt">
        <div className="wrap feat">
          <div>
            <div className="eyebrow">Hero feature · Receipts</div>
            <h2 className="h2">No quote, <span className="serif accent">no tag.</span></h2>
            <p className="sub">LLMs are confident even when they are wrong. So beep-jobs never takes a tag on faith. The model has to point at the words in the post that justify each tag, and plain code checks that those words are really there.</p>
            <ul className="bullets">
              <li><span><b>Hallucinations become visible.</b> A made-up quote fails the substring check and the post is marked “needs review”.</span></li>
              <li><span><b>Two independent signals.</b> The LLM city must agree with a rule-based gazetteer. Disagreement lowers trust automatically.</span></li>
              <li><span><b>You can check us in one click.</b> Every job card opens its receipt.</span></li>
            </ul>
          </div>
          <div className="panel">
            {sample && (
              <>
                <div className="doc">
                  <div><span style={{ color: "var(--dim)" }}>TITLE&nbsp;&nbsp;&nbsp;&nbsp;</span><Mark text={sample.title} q={sample.receipts.role.quote} /></div>
                  <div><span style={{ color: "var(--dim)" }}>LOCATION&nbsp;</span><Mark text={sample.location_raw.slice(0, 90)} q={sample.receipts.city.quote} /></div>
                  <div style={{ marginTop: 10 }}><span style={{ color: "var(--dim)" }}>…&nbsp;</span>{sample.receipts.role.quote && !sample.title.toLowerCase().includes(sample.receipts.role.quote.toLowerCase()) && <><mark>{sample.receipts.role.quote}</mark> … </>}<mark>{sample.receipts.exp.quote}</mark><span style={{ color: "var(--dim)" }}> …</span></div>
                </div>
                <div className="tagrow">
                  <span className="chip role">{ROLE_LABEL[sample.role]}</span>
                  {sample.cities.map((c) => <span className="chip" key={c}>{c}</span>)}
                  <span className="chip ok">True fresher</span>
                  <span className="chip ok">✓ 3/3 verbatim</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* HIDDEN POSTS */}
      {caught.length > 0 && (
        <section className="l-sec">
          <div className="wrap l-split">
            <div>
              <h2 className="l-h2 display">Labelled entry-level, asks for {maxYears} years</h2>
              <p className="l-p">
                Job boards trust the title. beep-jobs reads the requirements. {s.mislabeled > 0 && <>Of the {n(s.aggregator_total)} posts Himalayas marked &ldquo;Entry-level&rdquo;, {n(s.mislabeled)} asked for more than 2 years. </>}These posts are hidden from search, with the sentence that gave them away.
              </p>
              <p className="l-p"><Link className="link" href="/jobs?rejected=1">See all {n(s.rejected)} hidden posts</Link></p>
            </div>
            <div className="l-sheet">
              <span className="l-stamp" aria-hidden>Not for freshers</span>
              <table>
                <thead><tr><th>Post</th><th className="yrs">Asks for</th></tr></thead>
                <tbody>
                  {caught.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.title}</b>
                        <span className="co">{c.company}</span>
                        <q>{c.receipts.exp.quote}</q>
                      </td>
                      <td className="yrs">{c.min_exp}+ years</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* FUNNEL */}
      <section className="l-sec">
        <div className="wrap">
          <div className="l-head">
            <h2 className="l-h2 display">From {n(s.fetched)} posts to {n(s.live)}</h2>
            <p className="l-p" style={{ marginTop: 0, maxWidth: "38ch" }}>One automated run every morning at 8:00 IST. Bars are drawn to scale.</p>
          </div>
          <ol className="l-funnel">
            {funnel.map(([h, p, v], i) => (
              <li key={h} className={i === funnel.length - 1 ? "last" : undefined}>
                <div><h3>{h}</h3><p>{p}</p></div>
                <div className="bar" aria-hidden><i style={{ width: `${Math.max(0.5, (v / Math.max(1, s.fetched)) * 100)}%` }} /></div>
                <div className="val">{n(v)}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SEARCH */}
      {examples.length > 0 && (
        <section className="l-sec">
          <div className="wrap l-split">
            <div>
              <h2 className="l-h2 display">Search the way you&rsquo;d ask a friend</h2>
              <p className="l-p">Hinglish works, and so do city nicknames: Bangalore, BLR and Bengaluru are one place. Plain rules read most searches in under a millisecond. The AI is asked only when the rules find nothing.</p>
            </div>
            <ul className="l-examples">
              {examples.map((e) => (
                <li key={e.q}>
                  <Link href={`/jobs?q=${encodeURIComponent(e.q)}`}>
                    <span className="q">{e.q}</span>
                    <span className="count">{n(e.total)} {e.total === 1 ? "job" : "jobs"}</span>
                    <span className="parsed">
                      {e.u.cities.map((c) => <span key={c}><small>City</small>{c}</span>)}
                      {e.u.roles.map((r) => <span key={r}><small>Role</small>{ROLE_LABEL[r] ?? r}</span>)}
                      {e.u.employment && <span><small>Type</small>{EMP[e.u.employment] ?? e.u.employment}</span>}
                      {e.u.mode && <span><small>Where</small>{MODE[e.u.mode] ?? e.u.mode}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ACCURACY */}
      {ev && (
        <section className="l-sec">
          <div className="wrap l-split">
            <div>
              <h2 className="l-h2 display">How often the AI is wrong</h2>
              <p className="l-p">{ev.n} posts the AI had never seen were labelled without looking at its answers, then scored. The range is a 95% confidence interval.</p>
              <p className="l-p">Tagging costs ${cost.toFixed(2)} per 1,000 posts. A post goes back to the AI only when its text changes.</p>
              {ev.human_verified === 0 && <p className="l-p l-fine">The labels were written blind by an AI-assisted pass. A person has not reviewed them yet.</p>}
              <p className="l-p"><Link className="link" href="/evals">See every labelled post and every miss</Link></p>
            </div>
            <table className="l-score">
              <thead><tr><th>Tag</th><th className="r">beep-jobs</th><th className="r">Range</th><th className="r">Rules only</th></tr></thead>
              <tbody>
                {([
                  ["Role", ev.llm.role_lenient, ev.rules_baseline.role_lenient],
                  ["City", ev.llm.city, ev.rules_baseline.city],
                  ["Role and city both right", ev.llm.role_and_city, ev.rules_baseline.role_and_city],
                  ["Fresher or not", ev.llm.verdict, ev.rules_baseline.verdict],
                ] as const).map(([k, p, b]) => (
                  <tr key={k}>
                    <td>{k}<div className="ci" aria-hidden><u style={{ left: `${p.ci95[0] * 100}%`, width: `${(p.ci95[1] - p.ci95[0]) * 100}%` }} /><i style={{ left: `${(p.acc ?? 0) * 100}%` }} /></div></td>
                    <td className="r big">{pc(p.acc)}</td>
                    <td className="r">{pc(p.ci95[0])} to {pc(p.ci95[1])}</td>
                    <td className="r">{b?.acc == null ? "n/a" : pc(b.acc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FAILURES */}
      <section className="l-sec">
        <div className="wrap">
          <div className="l-head"><h2 className="l-h2 display">When something breaks</h2></div>
          <dl className="l-fail">
            <div><dt>A job board stops answering</dt><dd>Its posts stay listed for 2 more days. Other boards are not affected.</dd></div>
            <div><dt>The morning run finds far fewer jobs</dt><dd>The run is not published. The site keeps yesterday&rsquo;s list.</dd></div>
            <div><dt>The AI fails on a post</dt><dd>Plain rules tag it instead, and its receipt says &ldquo;needs review&rdquo;.</dd></div>
            <div><dt>The search AI is slow</dt><dd>After 2.5 seconds, search goes on without it.</dd></div>
            <div><dt>Many people search at once</dt><dd>Repeat searches come from the CDN cache. The search index ships inside each server, so there is no database to overload.</dd></div>
            <div><dt>A prompt change makes tagging worse</dt><dd>The build fails before it reaches the site. Accuracy is tested on every change.</dd></div>
          </dl>
        </div>
      </section>

      {/* CLOSE */}
      <section className="l-close">
        <div className="wrap">
          <h2 className="l-h2 display">{n(s.live)} jobs, checked every morning</h2>
          <div className="l-actions">
            <Link className="btn btn-primary" href="/jobs">Search jobs</Link>
            <a className="btn btn-ghost" href="https://github.com/vinitpatil519/beep-jobs" target="_blank" rel="noopener noreferrer">Read the code</a>
          </div>
        </div>
      </section>
      <footer className="foot">
        <div className="wrap">
          <span>Jobs come from the public APIs of Greenhouse, Lever, Ashby, SmartRecruiters and <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Himalayas</a>. Apply links go to the original post.</span>
          <span className="foot-links"><a href="/llms.txt">llms.txt</a><a href="/api/health">Status</a><a href="https://github.com/vinitpatil519/beep-jobs" target="_blank" rel="noopener noreferrer">GitHub</a></span>
        </div>
      </footer>
    </div>
  );
}
