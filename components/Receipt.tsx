import { ROLE_LABEL, VERDICT_LABEL, type Verdict } from "@/lib/taxonomy";
import type { Hit } from "@/lib/search";
import { SOURCE_LABEL } from "@/lib/format";

/** The brand object: a thermal-paper receipt that shows each AI tag next to the verbatim quote that proves it. */
export function Receipt({ p, compact = false }: { p: Pick<Hit, "id" | "title" | "company" | "role" | "cities" | "verdict" | "min_exp" | "receipts" | "trust" | "model" | "prompt_v" | "source" | "tagger">; compact?: boolean }) {
  const Q = ({ q, ok }: { q: string; ok: boolean }) =>
    q ? (
      <div className="quote">
        <span className={ok ? "ck" : "ck no"} title={ok ? "Quote found verbatim in the post" : "Quote NOT found in the post"}>{ok ? "✓ VERBATIM" : "✗ NOT FOUND"}</span>“{q}”
      </div>
    ) : (
      <div className="quote" style={{ opacity: 0.6 }}>no experience requirement stated in the post</div>
    );
  return (
    <div className="receipt" role="figure" aria-label={`Tag receipt for ${p.title}`}>
      {!compact && (
        <>
          <div className="r-row" style={{ fontSize: 10.5, letterSpacing: "0.14em" }}><span>BEEP-JOBS · TAG RECEIPT</span><span>#{p.id.slice(0, 8).toUpperCase()}</span></div>
          <hr className="rule" />
        </>
      )}
      <h4>{p.title}</h4>
      <div className="co">{p.company} · via {SOURCE_LABEL[p.source] ?? p.source}</div>
      <hr className="rule" />
      <div className="r-row"><span className="k">Role</span><span className="v">{ROLE_LABEL[p.role] ?? p.role}</span></div>
      <Q q={p.receipts.role.quote} ok={p.receipts.role.ok} />
      <div className="r-row"><span className="k">City</span><span className="v">{p.cities.join(", ")}</span></div>
      <Q q={p.receipts.city.quote} ok={p.receipts.city.ok} />
      <div className="r-row"><span className="k">Fresher?</span><span className="v">{VERDICT_LABEL[p.verdict as Verdict] ?? p.verdict}</span></div>
      <Q q={p.receipts.exp.quote} ok={p.receipts.exp.ok} />
      <hr className="rule" />
      <div className="r-row"><span className="k">Trust</span><span className="v">{p.trust === "verified" ? "VERIFIED · all quotes match" : "NEEDS REVIEW"}</span></div>
      <div className="r-row"><span className="k">Tagger</span><span className="v">{p.tagger === "llm" ? p.model : "rules fallback"} · prompt {p.prompt_v}</span></div>
      {!compact && <><div className="barcode" aria-hidden /><div className="r-foot"><span>NO QUOTE, NO TAG.</span><span>THANK YOU FOR NOT TRUSTING AI BLINDLY</span></div></>}
    </div>
  );
}
