# Prompt Engineering & LLM Tagger Documentation

This document describes the exact prompt design, schema enforcement, taxonomy rules, and receipt verification logic used by the `beep-jobs` LLM tagger.

---

## 1. System Prompt & Instructions

The prompt enforces strict structured extraction without using any external pre-training biases about company locations or reputation.

```typescript
export const SYSTEM = `You tag job posts for a job board for freshers (students and new graduates) in India.
For every post return one object. Use ONLY the post text. Never use outside knowledge about the company.

ROLE - what the person does day to day, not the company's industry. Pick exactly one id:
- software: Software engineer, developer, full-stack, frontend, backend, mobile, embedded, systems, QA, SDET, firmware, security engineer.
- data_ai: Machine learning engineer, data scientist, research scientist, AI/LLM researcher, computer vision, NLP. Building or researching models.
- data_analytics: Data analyst, business intelligence, data engineer, analytics engineer, SQL developer.
- design: UI/UX designer, product designer, graphic designer, web designer, brand designer, visual designer, 3D artist.
- product: Product manager, associate PM, technical PM, product owner, program manager, project manager.
- sales: SDR, BDR, business development executive, account executive, partnership manager, inside sales, growth lead.
- marketing: Content writer, copywriter, SEO specialist, performance marketer, social media manager, community manager, growth marketer.
- operations: Operations associate, supply operations, logistics, vendor management, HR/recruiter, talent acquisition, customer operations, AI annotation/labeling.
- finance: Financial analyst, accountant, auditor, risk analyst, investment analyst, trading support, tax associate.
- support: Customer support, customer success, tech support, application support engineer, desktop support.
- consulting: Solution architect, technical consultant, implementation specialist, functional consultant.
- other: Roles that do not cleanly fit above (e.g. legal, healthcare, front-desk, hospitality).

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

CITIES - Indian cities where the job is located. Pick every one that applies from the allowed list:
Allowed: Ahmedabad, Bengaluru, Chandigarh, Chennai, Delhi, Gurugram, Hyderabad, Jaipur, Kochi, Kolkata, Mumbai, Noida, Pune, Remote, Pan-India, Other.
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

RECEIPTS - for role, cities and verdict give a quote that proves your answer:
- Each quote must be copied VERBATIM, character for character, from the post (TITLE, LOCATION or DESCRIPTION). 3 to 15 words. Do not paraphrase, do not fix typos, do not join distant fragments.
- exp_quote: the phrase that states the experience requirement or the fresher signal. Empty string only when verdict is "unclear".

OTHER:
- work_mode: onsite | hybrid | remote | unknown.
- employment: internship | full_time | contract | apprenticeship.
- skills: up to 6 concrete skills or tools named in the post, lowercase.
- pay: stipend or salary exactly as written in the post, else null.`;
```

---

## 2. Structured Output JSON Schema

The LLM is invoked with rigid JSON schema enforcement (`responseSchema` in Gemini / OpenAI structured outputs):

```json
{
  "type": "ARRAY",
  "items": {
    "type": "OBJECT",
    "properties": {
      "i": { "type": "INTEGER" },
      "role": { "type": "STRING", "enum": ["software", "data_ai", "data_analytics", "design", "product", "sales", "marketing", "operations", "finance", "support", "consulting", "other"] },
      "role_quote": { "type": "STRING" },
      "cities": { "type": "ARRAY", "items": { "type": "STRING" } },
      "city_quote": { "type": "STRING" },
      "verdict": { "type": "STRING", "enum": ["fresher", "early", "experienced", "unclear"] },
      "min_exp_years": { "type": "NUMBER", "nullable": true },
      "exp_quote": { "type": "STRING" },
      "work_mode": { "type": "STRING", "enum": ["onsite", "hybrid", "remote", "unknown"] },
      "employment": { "type": "STRING", "enum": ["internship", "full_time", "contract", "apprenticeship"] },
      "skills": { "type": "ARRAY", "items": { "type": "STRING" } },
      "pay": { "type": "STRING", "nullable": true }
    },
    "required": ["i", "role", "role_quote", "cities", "city_quote", "verdict", "min_exp_years", "exp_quote", "work_mode", "employment", "skills", "pay"]
  }
}
```

---

## 3. Receipt Verification Algorithm (Code Verification)

Every quote returned by the model is checked against the raw job post using strict substring matching with normalized whitespace:

```typescript
export function checkReceipt(text: string, quote: string | null | undefined): { ok: boolean; quote: string } {
  if (!quote || !quote.trim()) return { ok: false, quote: "" };
  const q = quote.trim();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
  const ok = norm(text).includes(norm(q));
  return { ok, quote: q };
}
```

If the quote does not appear verbatim in the post:
- The receipt is rejected (`ok: false`).
- The post's trust tier is downgraded to `review`.
- Only verified quotes are surfaced in the UI receipt cards.
