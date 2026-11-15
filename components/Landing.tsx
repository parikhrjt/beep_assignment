"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Nav } from "./Nav";
import { Receipt } from "./Receipt";
import type { Stats } from "@/lib/stats";
import { ROLE_LABEL } from "@/lib/taxonomy";
import { n } from "@/lib/format";

type View = "human" | "ai";

export function Landing({ s, md, initialView }: { s: Stats; md: string; initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const pick = (v: View) => {
    setView(v);
    const u = new URL(window.location.href);
    if (v === "ai") u.searchParams.set("view", "ai"); else u.searchParams.delete("view");
    window.history.replaceState(null, "", u);
    window.scrollTo(0, 0);
  };
  const toggle = (
    <div className="toggle" data-view={view} role="group" aria-label="Choose who this page is for">
      <span className="knob" aria-hidden />
      <button aria-pressed={view === "human"} onClick={() => pick("human")}>Human</button>
      <button aria-pressed={view === "ai"} onClick={() => pick("ai")}>AI</button>
    </div>
  );
  return (
    <>
      <Nav active="home" toggle={toggle} />
      {view === "human" ? <Human s={s} /> : <AgentView md={md} />}
    </>
  );
}

/* ───────────────────────── AI view ───────────────────────── */
function AgentView({ md }: { md: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <main className="ai-view wrap">
      <div className="ai-bar">
        <span className="mono">beep.skill.md · {md.length.toLocaleString()} chars · same content as the human page, shaped for an agent</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? "Copied ✓" : "Copy markdown"}</button>
          <a className="btn btn-primary btn-sm" href="/llms.txt">Raw /llms.txt</a>
        </span>
      </div>
      <pre className="ai-doc">
        {md.split("\n").map((l, i) => (
          <span key={i} style={l.startsWith("#") ? { color: "var(--accent)", fontWeight: 600 } : l.startsWith("|") || l === "---" ? { color: "var(--muted)" } : l.startsWith(">") ? { color: "var(--ink)" } : undefined}>
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

function Human({ s }: { s: Stats }) {
  const root = useRef<HTMLDivElement>(null);
  const ev = s.eval.holdout ?? s.eval.dev;
  const evName = s.eval.holdout ? "held-out" : "dev";
  const cost = s.priced?.llm.cost_per_1k_usd ?? ev?.cost.per_1k_posts_usd ?? 0;
  const sample = s.sample;
  const dupes = s.last?.duplicates_removed ?? 0;
  const verbatimRate = ev ? ev.receipts.verbatim / ev.receipts.quotes_checked : s.verified / Math.max(1, s.total);

  useEffect(() => {
    let alive = true;
    let cleanup = () => {};
    (async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]);
      if (!alive || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lenis = reduce ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
      const raf = (t: number) => lenis?.raf(t * 1000);
      if (lenis) { lenis.on("scroll", ScrollTrigger.update); gsap.ticker.add(raf); gsap.ticker.lagSmoothing(0); }

      const ctx = gsap.context(() => {
        if (reduce) return;
        const q = gsap.utils.selector(root);
        // Hero: headline lines rise, receipt prints, numbers count.
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.from(q(".h1 .line > span"), { yPercent: 115, duration: 1.25, stagger: 0.09 })
          .from(q(".hero .eyebrow, .lede, .cta-row"), { y: 18, opacity: 0, duration: 0.9, stagger: 0.08 }, "-=0.9")
          .from(q(".printer .slot"), { scaleX: 0.6, opacity: 0, duration: 0.7 }, "-=1.1")
          .from(q(".printer .receipt"), { yPercent: -100, duration: 2.6, ease: "steps(26)" }, "-=0.5")
          .from(q(".hero-stats > div"), { y: 16, opacity: 0, duration: 0.7, stagger: 0.07 }, "-=2.2");
        q("[data-count]").forEach((el) => {
          const end = Number(el.getAttribute("data-count")), dec = Number(el.getAttribute("data-dec") || 0), pre = el.getAttribute("data-pre") || "", suf = el.getAttribute("data-suf") || "";
          const o = { v: 0 };
          gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, onUpdate: () => { el.textContent = pre + (dec ? o.v.toFixed(dec) : Math.round(o.v).toLocaleString("en-IN")) + suf; } });
        });
        // Receipt drifts up while the hero scrolls away.
        gsap.to(q(".printer"), { yPercent: -18, rotate: -2.5, ease: "none", scrollTrigger: { trigger: q(".hero")[0], start: "top top", end: "bottom top", scrub: true } });
        gsap.to(q(".glow"), { yPercent: 40, opacity: 0.3, ease: "none", scrollTrigger: { trigger: q(".hero")[0], start: "top top", end: "bottom top", scrub: true } });

        // Manifesto: each word lights up as you read.
        gsap.to(q(".manifesto .w"), { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: q(".manifesto")[0], start: "top 78%", end: "bottom 42%", scrub: 0.6 } });

        // Pipeline: pinned horizontal scroll on desktop.
        const mm = gsap.matchMedia();
        mm.add("(min-width: 861px)", () => {
          const track = q(".pipe-track")[0] as HTMLElement;
          const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
          gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: q(".pipe")[0], start: "top top", end: () => `+=${dist() + window.innerHeight * 0.4}`, pin: true, scrub: 0.8, invalidateOnRefresh: true } });
          gsap.to(q(".pipe-bar i"), { scaleX: 1, ease: "none", scrollTrigger: { trigger: q(".pipe")[0], start: "top top", end: () => `+=${dist() + window.innerHeight * 0.4}`, scrub: true } });
        });

        // Receipt feature: highlights snap on one by one, tags pop.
        gsap.timeline({ scrollTrigger: { trigger: q(".f-receipt")[0], start: "top 62%" } })
          .from(q(".f-receipt .doc"), { opacity: 0, y: 24, duration: 0.7, ease: "power3.out" })
          .add(() => q(".f-receipt mark").forEach((m, i) => setTimeout(() => m.classList.add("on"), i * 380)))
          .from(q(".f-receipt .tagrow > *"), { scale: 0.6, opacity: 0, stagger: 0.12, duration: 0.5, ease: "back.out(2.2)" }, "+=0.9");

        // Fake fresher: cards slide in, stamps slam.
        gsap.timeline({ scrollTrigger: { trigger: q(".caught")[0], start: "top 70%" } })
          .from(q(".caught-card"), { x: 60, opacity: 0, stagger: 0.14, duration: 0.8, ease: "power3.out" })
          .from(q(".caught-card .stamp"), { scale: 2.6, opacity: 0, rotate: -18, stagger: 0.14, duration: 0.45, ease: "back.out(1.6)" }, "-=0.45");

        // Ask: typewriter + cascade.
        const typed = q(".ask .typed")[0] as HTMLElement | undefined;
        if (typed) {
          const full = typed.dataset.text || "";
          typed.textContent = "";
          const o = { i: 0 };
          gsap.timeline({ scrollTrigger: { trigger: q(".ask")[0], start: "top 72%" } })
            .to(o, { i: full.length, duration: full.length * 0.055, ease: "none", onUpdate: () => { typed.textContent = full.slice(0, Math.round(o.i)); } })
            .from(q(".cascade > div"), { x: -26, opacity: 0, stagger: 0.18, duration: 0.55, ease: "power3.out" });
        }

        // Generic reveals.
        q(".reveal").forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 86%" } }));
        gsap.from(q(".cards .card"), { y: 50, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: q(".cards")[0], start: "top 80%" } });
        gsap.from(q(".mega span"), { yPercent: 100, stagger: 0.06, ease: "none", scrollTrigger: { trigger: q(".final")[0], start: "top 85%", end: "center 70%", scrub: 0.8 } });
      }, root);
      cleanup = () => { ctx.revert(); if (lenis) { gsap.ticker.remove(raf); lenis.destroy(); } };
    })();
    return () => { alive = false; cleanup(); };
  }, []);

  const manifesto = "Other job boards ask you to trust their AI. Beep shows its work. Every role, every city, every “fresher” label carries a quote copied from the post, and code checks the quote is really there. No quote, no tag.";
  const hot = new Set(["shows", "its", "work.", "quote", "No", "no", "tag."]);
  const caught = s.caught.length ? s.caught : [];

  return (
    <div ref={root}>
      {/* HERO */}
      <section className="hero">
        <div className="grid-bg" aria-hidden />
        <div className="glow" aria-hidden />
        <div className="wrap hero-in">
          <div>
            <div className="eyebrow">India · fresher jobs &amp; internships · refreshed daily</div>
            <h1 className="h1">
              <span className="line"><span>Every AI tag</span></span>
              <span className="line"><span>comes with a</span></span>
              <span className="line"><span className="serif accent">receipt.</span></span>
            </h1>
            <p className="lede">Beep reads <b>{n(s.fetched)} job posts a day</b> from public hiring APIs, keeps the ones a fresher can actually get, and tags each by role and city. Every tag ships with the <b>exact sentence that proves it</b>. And we publish how often we are wrong.</p>
            <div className="cta-row">
              <Link className="btn btn-primary" href="/jobs">Search {n(s.live)} jobs →</Link>
              <Link className="btn btn-ghost" href="/evals">See the evals</Link>
            </div>
            <div className="hero-stats">
              <div><b data-count={s.live}>{n(s.live)}</b><span>live fresher posts</span></div>
              <div><b data-count={s.rejected}>{n(s.rejected)}</b><span>fake “fresher” posts caught</span></div>
              <div><b data-count={(ev?.llm.city.acc ?? 0) * 100} data-suf="%">{((ev?.llm.city.acc ?? 0) * 100).toFixed(0)}%</b><span>city accuracy ({evName})</span></div>
              <div><b data-count={cost} data-dec="2" data-pre="$">${cost.toFixed(2)}</b><span>per 1,000 posts tagged</span></div>
            </div>
          </div>
          <div className="printer" aria-label="Example tag receipt">
            <div className="slot" />
            <div className="feed">{sample && <Receipt p={sample} />}</div>
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden>
        {[0, 1].map((k) => <div className="track" key={k}>{[...s.names, "Himalayas", "Greenhouse", "Lever", "Ashby", "SmartRecruiters"].map((x, i) => <span key={i}>{x} ✦</span>)}</div>)}
      </div>

      {/* MANIFESTO */}
      <section className="sec">
        <div className="wrap">
          <div className="eyebrow" style={{ marginBottom: 26 }}>The problem with AI job boards</div>
          <p className="manifesto">{manifesto.split(" ").map((w, i) => <span key={i} className={`w${hot.has(w) ? " hot" : ""}`}>{w}</span>)}</p>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="pipe">
        <div className="wrap">
          <div className="pipe-head">
            <div>
              <div className="eyebrow">Every night at 08:00 IST</div>
              <h2 className="h2 wide" style={{ marginBottom: 0 }}>From {n(s.fetched)} posts to {n(s.live)} you can trust.</h2>
            </div>
            <p className="sub hide-m" style={{ maxWidth: 340 }}>One GitHub Actions run. No servers. Yesterday&apos;s data stays live if anything breaks.</p>
          </div>
          <div className="pipe-bar"><i /></div>
        </div>
        <div className="pipe-track">
          {[
            ["01", "Collect", `${s.boards} public job boards on Greenhouse, Lever, Ashby and SmartRecruiters, plus the Himalayas API. Documented APIs only, no scraping.`, n(s.fetched), "posts read"],
            ["02", "Filter", "Keep Indian locations, then a cheap regex gate keeps anything that could be a fresher job. High recall here, the LLM decides later.", n(s.last?.candidates ?? 0), "fresher candidates"],
            ["03", "Dedupe", "Three layers: exact source id, company + normalised title, and a 64-bit SimHash of the text for reworded copies.", n(dupes), "duplicates removed"],
            ["04", "Tag + quote", "Gemini returns role, cities and a fresher verdict through a strict JSON schema. Each answer must come with a verbatim quote.", "3 quotes", `per post · ${s.last?.llm.model ?? "LLM"} · temp 0`],
            ["05", "Verify", "Code checks every quote is a real substring of the post, and cross-checks the city with a deterministic gazetteer.", `${(verbatimRate * 100).toFixed(1)}%`, "quotes found verbatim"],
            ["06", "Publish", "A quality gate blocks a collapsed run. The data is committed to git and baked into each deploy as a SQLite search index.", n(s.live), "live, searchable"],
          ].map(([no, h, p, big, small]) => (
            <div className="step" key={no}>
              <div className="no">STEP {no}</div>
              <h3>{h}</h3>
              <p>{p}</p>
              <div className="big">{big}<small>{small}</small></div>
            </div>
          ))}
        </div>
      </section>

      {/* RECEIPTS */}
      <section className="sec f-receipt">
        <div className="wrap feat">
          <div>
            <div className="eyebrow">Hero feature · Receipts</div>
            <h2 className="h2">No quote, <span className="serif accent">no tag.</span></h2>
            <p className="sub">LLMs are confident even when they are wrong. So Beep never takes a tag on faith. The model has to point at the words in the post that justify each tag, and plain code checks that those words are really there.</p>
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

      {/* FAKE FRESHER */}
      <section className="sec">
        <div className="wrap feat flip">
          <div>
            <div className="eyebrow">Fake-fresher detector</div>
            <h2 className="h2">“Entry-level.” <span className="serif accent">Six years required.</span></h2>
            <p className="sub">Titles lie. Beep reads the requirements, not the title, and gives every post a verdict: true fresher, early career, or fake fresher. Fake ones never reach your feed. {s.mislabeled > 0 && <><b style={{ color: "var(--ink)" }}>{n(s.mislabeled)} of {n(s.aggregator_total)}</b> posts that a job board itself labelled “Entry-level” asked for 2+ years.</>}</p>
            <div className="cta-row"><Link className="btn btn-ghost" href="/jobs?rejected=1">Open the graveyard →</Link></div>
          </div>
          <div className="caught">
            {caught.map((c) => (
              <div className="caught-card" key={c.id}>
                <span className="stamp">Fake fresher</span>
                <h5>{c.title}</h5>
                <div className="src">{c.company} · listed as Entry-level</div>
                <div className="quote" style={{ margin: 0 }}>“{c.receipts.exp.quote}”</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ASK */}
      <section className="sec">
        <div className="wrap feat">
          <div>
            <div className="eyebrow">Search like you talk</div>
            <h2 className="h2">Hinglish in. <span className="serif accent">Filters out.</span></h2>
            <p className="sub">Type how you would ask a friend. A cascade picks the cheapest layer that understands you, so most searches cost zero tokens and answer in milliseconds. The LLM only wakes up when the rules give up.</p>
            <ul className="bullets">
              <li><span><b>Rules first.</b> City aliases (Bangalore, BLR, Bengaluru) and role words resolve in under a millisecond.</span></li>
              <li><span><b>LLM second.</b> Only when nothing matches, with a 2.5 s timeout. If it is down, search still works.</span></li>
              <li><span><b>CDN in front.</b> The same query is served from the edge cache until the next daily build.</span></li>
            </ul>
          </div>
          <div className="panel">
            <div className="ask"><span style={{ color: "var(--accent)" }}>›</span><span className="typed" data-text="pune me backend internship chahiye">pune me backend internship chahiye</span><span className="caret" /></div>
            <div className="cascade">
              <div><span>L0</span><span><b>Edge cache</b> · same URL, same answer</span><em>~20 ms</em></div>
              <div><span>L1</span><span><b>Rules</b> · city=Pune · role=Software · type=internship</span><em>0 tokens</em></div>
              <div><span>L2</span><span><b>LLM rewrite</b> · only if L1 finds nothing</span><em>≤ 2.5 s</em></div>
              <div><span>DB</span><span><b>SQLite FTS5</b> · BM25 rank inside the function</span><em>&lt; 5 ms</em></div>
            </div>
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="sec">
        <div className="wrap">
          <div className="eyebrow">Measured, not claimed</div>
          <h2 className="h2 wide">We hand-checked the AI. <span className="serif accent">Here is the score.</span></h2>
          <p className="sub">{ev?.n ?? 50} posts were labelled by hand without looking at the model output, then scored with 95% confidence intervals. Every post and every miss is public on the evals page.</p>
          <div className="nums">
            <div className="num"><b data-count={(ev?.llm.role_lenient.acc ?? 0) * 100} data-suf="%">{((ev?.llm.role_lenient.acc ?? 0) * 100).toFixed(0)}%</b><span>Role accuracy</span><small>{evName} set · rules-only baseline {((ev?.rules_baseline.role_lenient.acc ?? 0) * 100).toFixed(0)}%</small></div>
            <div className="num"><b data-count={(ev?.llm.city.acc ?? 0) * 100} data-suf="%">{((ev?.llm.city.acc ?? 0) * 100).toFixed(0)}%</b><span>City accuracy</span><small>exact match of the full city set</small></div>
            <div className="num"><b data-count={(ev?.llm.verdict.acc ?? 0) * 100} data-suf="%">{((ev?.llm.verdict.acc ?? 0) * 100).toFixed(0)}%</b><span>Fresher verdict</span><small>on {ev?.llm.verdict.n ?? 0} posts a human could decide</small></div>
            <div className="num"><b data-count={cost} data-dec="2" data-pre="$">${cost.toFixed(2)}</b><span>Per 1,000 posts</span><small>measured tokens × list price · $0 on re-runs</small></div>
          </div>
          <div className="cta-row"><Link className="btn btn-ghost" href="/evals">Read every labelled post →</Link></div>
        </div>
      </section>

      {/* ENGINEERING */}
      <section className="sec">
        <div className="wrap">
          <div className="eyebrow">Built to stay up</div>
          <h2 className="h2 wide">Boring infrastructure. <span className="serif accent">On purpose.</span></h2>
          <div className="cards">
            <div className="card"><div className="ix">01 · ZERO DB HOP</div><h4>The database ships with the code</h4><p>A read-only SQLite FTS5 file is baked into every deploy. Search scales with the functions. No pool, no cold DB, nothing to page you at 3 am.</p></div>
            <div className="card"><div className="ix">02 · PAY ONCE</div><h4>Content-hash cache</h4><p>A post is only sent to the LLM when its text, the prompt or the model changes. A quiet day costs close to $0.</p></div>
            <div className="card"><div className="ix">03 · FAIL STATIC</div><h4>Quality gate + grace window</h4><p>A run that loses 40% of posts is refused. A source that hiccups keeps its posts for 2 days. The site never goes blank.</p></div>
            <div className="card"><div className="ix">04 · EVALS AS CI</div><h4>Prompts are code</h4><p>Every prompt has a hash. A change that drops accuracy below the gate fails the build before it reaches users.</p></div>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section className="final">
        <div className="wrap">
          <div className="mega" aria-label="beep.">{"beep".split("").map((c, i) => <span key={i} style={{ display: "inline-block" }}>{c}</span>)}<span style={{ display: "inline-block" }}><i>.</i></span></div>
          <p className="sub" style={{ margin: "26px auto 30px" }}>The job board that shows its work.</p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary" href="/jobs">Find your first job →</Link>
            <a className="btn btn-ghost" href="https://github.com/vinitpatil519/beep" target="_blank" rel="noopener noreferrer">Read the code</a>
          </div>
        </div>
      </section>
      <footer className="foot">
        <div className="wrap">
          <span>Beep · data refreshed {s.last ? new Date(s.last.at).toUTCString().slice(5, 22) + " UTC" : "daily"}</span>
          <span>Jobs from public APIs of Greenhouse, Lever, Ashby, SmartRecruiters and <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Himalayas</a>. Apply links go to the original post.</span>
          <span><a href="/llms.txt">llms.txt</a> · <a href="/api/health">status</a></span>
        </div>
      </footer>
    </div>
  );
}
