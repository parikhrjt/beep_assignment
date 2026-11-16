"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Receipt } from "./Receipt";
import type { SearchResult, Hit } from "@/lib/search";
import { ROLE_LABEL, VERDICT_LABEL, type Verdict } from "@/lib/taxonomy";
import { ago, n, SOURCE_LABEL } from "@/lib/format";

type State = { q: string; role: string[]; city: string[]; verdict: string[]; type: string; mode: string; sort: string; page: number; rejected: boolean };
const EXAMPLES = ["backend intern bengaluru", "pune me data analyst", "remote marketing internship", "ml fresher hyderabad", "wfh customer support", "react developer gurgaon"];

function toParams(s: State) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.role.length) p.set("role", s.role.join(","));
  if (s.city.length) p.set("city", s.city.join(","));
  if (s.verdict.length) p.set("verdict", s.verdict.join(","));
  if (s.type) p.set("type", s.type);
  if (s.mode) p.set("mode", s.mode);
  if (s.sort !== "relevance") p.set("sort", s.sort);
  if (s.page > 1) p.set("page", String(s.page));
  if (s.rejected) p.set("rejected", "1");
  return p;
}

export function JobsApp({ initial, initialState, freshness }: { initial: SearchResult; initialState: State; freshness: { at: string | null; live: number; rejected: number } }) {
  const [s, setS] = useState<State>(initialState);
  const [r, setR] = useState<SearchResult>(initial);
  const [loading, startT] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialState.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const p = toParams(s);
    window.history.replaceState(null, "", `/jobs${p.size ? `?${p}` : ""}`);
    ctrl.current?.abort();
    const c = (ctrl.current = new AbortController());
    startT(async () => {
      try {
        const res = await fetch(`/api/search?${p}`, { signal: c.signal });
        if (res.ok) setR(await res.json());
      } catch { /* aborted */ }
    });
  }, [s]);

  // Debounce typing; Enter searches at once.
  useEffect(() => {
    if (draft === s.q) return;
    const t = setTimeout(() => setS((x) => ({ ...x, q: draft, page: 1 })), 280);
    return () => clearTimeout(t);
  }, [draft, s.q]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const [showFilters, setShowFilters] = useState(false);
  const toggle = useCallback((k: "role" | "city" | "verdict", v: string) => setS((x) => ({ ...x, page: 1, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] })), []);
  const u = r.understood;
  const hasFilters = s.role.length || s.city.length || s.verdict.length || s.type || s.mode || s.q;

  return (
    <div className="app wrap">
      <div className="app-head">
        <div>
          <h1 className="display">{s.rejected ? "Hidden posts" : "Fresher jobs in India"}</h1>
          <p>{s.rejected ? "These posts say entry-level or fresher, but ask for more than 2 years. Each one shows the sentence that gave it away." : "Open a receipt to see the sentence behind each tag."}</p>
        </div>
        <div className="fresh">{n(freshness.live)} live jobs, updated {ago(freshness.at)}</div>
      </div>

      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); setS((x) => ({ ...x, q: draft, page: 1 })); }}>
                <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Try: pune me backend internship" aria-label="Search jobs" />
        <span className="kbd hide-m">/</span>
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
      </form>

      <div className="understood" aria-live="polite">
        {s.q && u.via !== "none" ? (
          <>
            <span>{u.via === "llm" ? "Read by the AI as" : "Read as"}</span>
            {u.roles.map((x) => <span key={x} className="tag">{ROLE_LABEL[x]}</span>)}
            {u.cities.map((x) => <span key={x} className="tag">{x}</span>)}
            {u.employment && <span className="tag">{u.employment.replace("_", " ")}</span>}
            {u.mode && <span className="tag">{u.mode}</span>}
            {u.verdict && <span className="tag ok">fresher only</span>}
            {u.terms.map((x) => <span key={x} className="tag">&ldquo;{x}&rdquo;</span>)}
          </>
        ) : !s.q ? (
          <>
            <span>Try</span>
            {EXAMPLES.map((x) => <button key={x} className="tag" type="button" onClick={() => { setDraft(x); setS((y) => ({ ...y, q: x, page: 1 })); }}>{x}</button>)}
          </>
        ) : null}
      </div>

      <button type="button" className="btn btn-ghost btn-sm filters-btn" aria-expanded={showFilters} aria-controls="filters" onClick={() => setShowFilters((x) => !x)}>{showFilters ? "Hide filters" : "Filters"}</button>
      <div className="layout">
        <aside id="filters" className={showFilters ? "side open" : "side"} aria-label="Filters">
          <Facet title="Is it really fresher?" items={Object.entries(r.facets.verdict).sort((a, b) => b[1] - a[1])} active={s.verdict} label={(k) => VERDICT_LABEL[k as Verdict] ?? k} onPick={(k) => toggle("verdict", k)} />
          <Facet title="Role" items={Object.entries(r.facets.role)} active={s.role} label={(k) => ROLE_LABEL[k] ?? k} onPick={(k) => toggle("role", k)} />
          <Facet title="City" items={Object.entries(r.facets.city).slice(0, 16)} active={s.city} label={(k) => k} onPick={(k) => toggle("city", k)} />
          <Facet title="Type" items={Object.entries(r.facets.employment)} active={s.type ? [s.type] : []} label={(k) => k.replace("_", " ")} onPick={(k) => setS((x) => ({ ...x, page: 1, type: x.type === k ? "" : k }))} />
          <div>
            <h6>Hidden posts</h6>
            <div className="facet">
              <button aria-pressed={s.rejected} onClick={() => setS((x) => ({ ...x, rejected: !x.rejected, verdict: [], page: 1 }))}>
                <span>{s.rejected ? "Back to live jobs" : "Show hidden posts"}</span><span>{n(freshness.rejected)}</span>
              </button>
            </div>
          </div>
        </aside>

        <main>
          <div className="bar">
            <span>
              <b style={{ color: "var(--ink)" }}>{n(r.total)}</b> {s.rejected ? "hidden posts" : r.total === 1 ? "job" : "jobs"}
              {hasFilters ? <>{" "}<button style={{ textDecoration: "underline" }} onClick={() => { setDraft(""); setS({ q: "", role: [], city: [], verdict: [], type: "", mode: "", sort: "relevance", page: 1, rejected: s.rejected }); }}>Clear filters</button></> : null}
            </span>
            <select aria-label="Sort" value={s.sort} onChange={(e) => setS((x) => ({ ...x, sort: e.target.value, page: 1 }))}>
              <option value="relevance">Best match</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          {r.relaxed?.length > 0 && <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>Nothing matched every part of your search. Showing results <b>{r.relaxed.join(", then ")}</b>.</div>}
          <div className="list" style={{ opacity: loading ? 0.55 : 1, transition: "opacity .2s" }}>
            {r.hits.length === 0 && <div className="empty">No jobs match. Try fewer words, or <button style={{ textDecoration: "underline" }} onClick={() => { setDraft(""); setS((x) => ({ ...x, q: "", role: [], city: [], verdict: [], page: 1 })); }}>clear everything</button>.</div>}
            {r.hits.map((h) => <Job key={h.id} h={h} open={open === h.id} onToggle={() => setOpen(open === h.id ? null : h.id)} />)}
          </div>
          {r.pages > 1 && (
            <div className="pager">
              <button className="btn btn-ghost btn-sm" disabled={s.page <= 1} onClick={() => { setS((x) => ({ ...x, page: x.page - 1 })); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Previous</button>
              <span>Page {s.page} of {r.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={s.page >= r.pages} onClick={() => { setS((x) => ({ ...x, page: x.page + 1 })); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Next</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Facet({ title, items, active, label, onPick }: { title: string; items: [string, number][]; active: string[]; label: (k: string) => string; onPick: (k: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <h6>{title}</h6>
      <div className="facet">
        {items.map(([k, c]) => (
          <button key={k} aria-pressed={active.includes(k)} onClick={() => onPick(k)}><span>{label(k)}</span><span>{c}</span></button>
        ))}
      </div>
    </div>
  );
}

const verdictTag = (v: string) => (v === "fresher" ? "tag ok" : v === "early" ? "tag warn" : v === "experienced" ? "tag bad" : "tag");

function Snip({ s }: { s?: string }) {
  if (!s) return null;
  const parts = s.split(/(\[\[.*?\]\])/g);
  return <p className="snip">{parts.map((x, i) => (x.startsWith("[[") ? <b key={i}>{x.slice(2, -2)}</b> : <span key={i}>{x}</span>))}</p>;
}

function Job({ h, open, onToggle }: { h: Hit; open: boolean; onToggle: () => void }) {
  return (
    <article className="job">
      <div className="job-main">
        <div className="job-top">
          <div>
            <h3>{h.title}</h3>
            <div className="co"><span>{h.company}</span><span>{h.cities.join(", ")}</span><span>{ago(h.posted_at)}</span></div>
          </div>
          <div className="job-actions">
            <button className="rcpt-btn" aria-expanded={open} onClick={onToggle}>{open ? "Hide" : "Receipt"}</button>
            <a className="btn btn-primary btn-sm" href={h.apply_url} target="_blank" rel="noopener noreferrer nofollow">Apply</a>
          </div>
        </div>
        <div className="meta">
          <span className="tag">{ROLE_LABEL[h.role] ?? h.role}</span>
          <span className={verdictTag(h.verdict)}>{VERDICT_LABEL[h.verdict as Verdict]}</span>
          {h.employment === "internship" && <span className="tag">Internship</span>}
          {h.pay && <span className="tag">{h.pay.slice(0, 40)}</span>}
          {h.trust !== "verified" && <span className="tag warn" title="At least one tag quote did not match the post text">Needs review</span>}
        </div>
        {h.receipts.exp.quote && <div className="why">{h.verdict === "experienced" ? "Asks for" : "Experience"}: <q>{h.receipts.exp.quote}</q></div>}
        <Snip s={h.snippet} />
      </div>
      {open && (
        <div className="job-rcpt">
          <Receipt p={h} />
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14 }}>
            Original post on <a href={h.url} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration: "underline" }}>{SOURCE_LABEL[h.source] ?? h.source}</a>
            {h.source === "himalayas" && <>. Job data from <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Himalayas</a></>}
            {h.dup_count > 1 && <>. Merged {h.dup_count} copies of this post.</>}
          </p>
        </div>
      )}
    </article>
  );
}
