import { CITIES, EMPLOYMENTS, MODES, ROLES, ROLE_IDS, VERDICTS } from "../../lib/taxonomy.ts";
import { sha1 } from "../util.ts";

export const MODEL = process.env.BEEP_JOBS_MODEL || "gemini-3.5-flash-lite";
// List price, USD per 1M tokens, Standard tier. Source: https://aistudio.google.com/docs/pricing (read 2026-11-16).
// Output price includes thinking tokens. Batch API would halve both numbers.
export const PRICE = { in_per_m: 0.3, out_per_m: 2.5, as_of: "2026-11-16", source: "https://aistudio.google.com/docs/pricing" };

export const SYSTEM = `You tag job posts for a job board for freshers (students and new graduates) in India.
For every post return one object. Use ONLY the post text. Never use outside knowledge about the company.

ROLE - what the person does day to day, not the company's industry. Pick exactly one id:
${ROLES.map((r) => `- ${r.id}: ${r.hint}`).join("\n")}
Tie-breaks, decide by the duties and not by a word in the title:
- data_ai is only for people who BUILD or RESEARCH models. Freelance or gig work that produces or checks AI training data (annotation, labelling, rating answers, recording speech, transcription, validating translations, evaluating model outputs as a subject expert) is operations.
- Interpreting, translating for clients, acting, teaching, tutoring, and front-line healthcare or hotel service jobs are other. Finding deals or partners for a hotel or hospitality business is sales.
- An engineer whose duties are ML/GenAI is data_ai even if the title is just "Engineer". Data Engineer is data_analytics. Generic "Engineer"/"SDE"/"Developer" is software.
- Talking to leads or customers to sell something (also loans, courses, hotel deals, partnerships) is sales, whatever the product. Calling customers to collect dues or verify details is operations. Answering customer questions is support.
- finance is for accounting, audit, tax, treasury, risk, credit, investing, trading and trade support, even at a technology company.
- Web, graphic, UI or visual design is design, even when the title says "web". Writing the code for a website is software.
- Solution consultant, value engineer, implementation or ERP functional consultant: consulting if they advise and configure, software if they mainly write code, sales if they carry a quota.
- Program, project or delivery management is product. Fixing access issues and running internal tools or IT systems is devops.
- A "Business Analyst" who mostly writes SQL/dashboards is data_analytics, otherwise consulting. "Technical Support Engineer" is support.
- A page that is not one concrete job (referral form, general talent pool, "join our network") is other.

CITIES - Indian cities where the job is located. Pick every one that applies from the allowed list.
- Map spellings to the canonical name (Bangalore -> Bengaluru, Gurgaon -> Gurugram, Navi Mumbai/Thane -> Mumbai, Mohali -> Chandigarh).
- Fully remote job -> "Remote". Remote job that also names a city -> both.
- India with no city named -> "Pan-India". Never add "Pan-India" when a city or "Remote" is already chosen.
- An Indian city or town not in the list (for example Shillong) -> "Other", also when it is named only in the description.
- Ignore every non-Indian location.

VERDICT - is this really a fresher job? Based on the MINIMUM experience the post requires:
- fresher: internship, traineeship, apprenticeship, student or campus programme, new-grad hire, or minimum experience is 0 ("0-1 years", "0-2 years", "freshers welcome", "no experience required").
- early: minimum experience is more than 0 and at most 2 years ("1+ years", "1-3 years", "2 years").
- experienced: minimum experience is more than 2 years ("3+ years", "4-6 years"), whatever the title says.
- unclear: the post states no experience requirement and gives no fresher signal.
min_exp_years: the LOWEST number of years the post requires, as a number. "2+ years" -> 2, "2-4 years" -> 2, "6 months" -> 0.5, fresher signals -> 0. null when not stated.
The verdict follows from min_exp_years: 0 -> fresher, more than 0 up to and including 2 -> early, more than 2 -> experienced.

RECEIPTS - for role, cities and verdict give a quote that proves your answer.
- Each quote must be copied VERBATIM, character for character, from the post (TITLE, LOCATION or DESCRIPTION). 3 to 15 words. Do not paraphrase, do not fix typos, do not join distant fragments.
- exp_quote: the phrase that states the experience requirement or the fresher signal. Empty string only when verdict is "unclear".

OTHER
- work_mode: onsite | hybrid | remote | unknown.
- employment: internship | full_time | contract | apprenticeship.
- skills: up to 6 concrete skills or tools named in the post, lowercase.
- pay: stipend or salary exactly as written in the post, else null.`;

const S = (o: object) => o;
export const SCHEMA = S({
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" },
      role: { type: "STRING", enum: ROLE_IDS },
      role_quote: { type: "STRING" },
      cities: { type: "ARRAY", items: { type: "STRING", enum: CITIES } },
      city_quote: { type: "STRING" },
      verdict: { type: "STRING", enum: [...VERDICTS] },
      min_exp_years: { type: "NUMBER", nullable: true },
      exp_quote: { type: "STRING" },
      work_mode: { type: "STRING", enum: [...MODES] },
      employment: { type: "STRING", enum: [...EMPLOYMENTS] },
      skills: { type: "ARRAY", items: { type: "STRING" } },
      pay: { type: "STRING", nullable: true },
    },
    required: ["i", "role", "role_quote", "cities", "city_quote", "verdict", "min_exp_years", "exp_quote", "work_mode", "employment", "skills", "pay"],
    propertyOrdering: ["i", "role_quote", "role", "city_quote", "cities", "exp_quote", "min_exp_years", "verdict", "work_mode", "employment", "skills", "pay"],
  },
});

// Any change to the prompt, schema or model yields a new version, which invalidates the tag cache
// and makes every number on /evals attributable to an exact prompt.
export const PROMPT_V = sha1(SYSTEM + JSON.stringify(SCHEMA)).slice(0, 8);

export type TagInput = { title: string; company: string; location_raw: string; text: string; employment_hint?: string };
export const renderPost = (p: TagInput, i: number) =>
  `### POST ${i}\nTITLE: ${p.title}\nCOMPANY: ${p.company}\nLOCATION: ${p.location_raw}${p.employment_hint ? `\nTYPE_HINT: ${p.employment_hint}` : ""}\nDESCRIPTION:\n${p.text}`;

const SIGNAL = /\b(years?|yrs?|experience|fresher|graduat|batch|stipend|ctc|lpa|salary|compensation|remote|hybrid|on-?site|work from|location|based in|degree|b\.?\s?tech|b\.?e\b|mba|pursuing|intern|duration|months?)\b/i;
/** Token diet: keep the head of the description plus every line that carries a tagging signal. Requirements often sit 3,000 chars deep, below the company blurb. */
export function excerpt(text: string, budget = 1900): string {
  if (text.length <= budget) return text;
  const head = text.slice(0, 650);
  const headEnd = head.lastIndexOf("\n") > 300 ? head.lastIndexOf("\n") : 650;
  const out = [text.slice(0, headEnd).trim()];
  let used = headEnd;
  for (const line of text.slice(headEnd).split("\n")) {
    const l = line.trim();
    if (l.length < 12 || !SIGNAL.test(l)) continue;
    const cut = l.slice(0, 260);
    if (used + cut.length > budget) break;
    out.push(cut);
    used += cut.length + 1;
  }
  return out.join("\n");
}
