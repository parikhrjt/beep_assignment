# Labeling guide

The accuracy numbers on `/evals` compare the AI's tags with labels written by reading each post. This guide is the rule book for those labels. The tagger prompt follows the same rules, so a disagreement is either a model error or a gap in this guide, never two different definitions.

Each label is `[role, role_alt, cities, verdict]`. Labels are written **blind**: the labeller sees the title, company, location and full text, never the model's output.

## Role

Pick the role by what the person does day to day, not by the company's industry or one word in the title. Role ids and their scope are defined in `lib/taxonomy.ts`.

| Rule | Example |
|---|---|
| R1. Freelance or gig work that produces or checks AI training data (annotation, labelling, rating, speech recording, transcription, translation checking, expert model evaluation) is `operations`. `role_alt` is `other`. | "AI Conversation Recording Contributor" |
| R2. Interpreting, translating for clients, acting, teaching, tutoring, and front-line healthcare or hotel service jobs are `other`. | "Bengali Language Interpreter" |
| R3. Selling, including loans, courses, hotel deals and partnerships, is `sales`. Calling customers to collect dues or verify details is `operations`. Answering customer questions is `support`. | "Tele caller, collections" is `operations` |
| R4. Accounting, audit, tax, treasury, risk, credit, investing, trading and trade support are `finance`, even at a technology company. | "Intern, trade support" at a trading firm |
| R5. Web, graphic, UI or visual design is `design`. Writing the code for a website is `software`. | "Web Designer" |
| R6. Data Engineer is `data_analytics`. An engineer whose duties are ML or GenAI is `data_ai`. | |
| R7. `role_alt` is filled only when a careful reader could defend a second role. It is written before any scoring. | |

## Cities

| Rule | Example |
|---|---|
| C1. List every Indian city where the job is located, using canonical names (`Bangalore` is `Bengaluru`, `Gift City` is `Ahmedabad`). | "Gift City; Gurgaon" is `Ahmedabad, Gurugram` |
| C2. A city counts only if the location field names it, or the text says the job is done there. A company head office alone does not count. | Remote job by a Pune company is `Remote` |
| C3. Fully remote is `Remote`. Remote plus a named city is both. | "Bangalore or remote" is `Bengaluru, Remote` |
| C4. India with no city is `Pan-India`. It never appears next to a city or `Remote`. | |
| C5. An Indian town not in the list is `Other`. A non-place word in the location field ("Payments", "EngageHQ") is ignored. | |

## Fresher verdict

The verdict follows from the **lowest** number of years the post requires.

| Lowest requirement | Verdict |
|---|---|
| 0, "freshers welcome", "no experience", an internship, apprenticeship, campus or new-grad programme | `fresher` |
| more than 0, up to and including 2 years ("1+ years", "2-4 years", "6 months") | `early` |
| more than 2 years ("3+ years") | `experienced` |
| the post states nothing and gives no fresher signal | `null` (not scored) |

A title such as "Entry Level" does not decide the verdict. "Entry Level (1-3 years)" is `early`.

## Sets

| Set | Posts | Use |
|---|---|---|
| `golden.dev.jsonl` | 100 | Tuning. Holds the first dev set (50) and the first holdout (50), which became dev data once its misses were used to improve the prompt. |
| `golden.holdout.jsonl` | 100 | Headline numbers. Drawn and labelled after the prompt was final, from posts in neither dev set. Never used to change the prompt or the code. |

### Adjudication log

Changes made to labels after they were first written, and why. Each change applies a rule above; none was made to match a model output.

| Post | Before | After | Rule |
|---|---|---|---|
| AI Conversation Recording Contributor (944f7d577375) | other / operations | operations / other | R1 |
| IM & PA Medical Student SME, AI Model Evaluation (3c7908fe9971) | other / operations | operations / other | R1 |
| Translation Validator, Gujarati (71ce7f207a2d) | other / operations | operations / other | R1 |

The first dev and holdout sets were labelled before R1 was written down, and the two sets used opposite primary labels for this kind of post. R1 settles it in the direction the prompt already used.
