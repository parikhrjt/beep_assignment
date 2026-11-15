# Source compliance

Beep only reads data that publishers expose **on purpose, through documented public APIs**. It does not scrape HTML, log in, bypass rate limits or read pages that a site's `robots.txt` disallows.

| Source | Endpoint | Why it is allowed | What Beep does to respect it |
|---|---|---|---|
| Greenhouse Job Board API | `boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true` | Greenhouse docs: "Job Board data is publicly available, so authentication is not required for any GET endpoints." | GET only. One request per board per day. Apply links point to the company's own Greenhouse page. |
| Lever Postings API | `api.lever.co/v0/postings/{company}?mode=json` | Lever docs: "all job postings in the `published` state are publicly viewable." | GET only, one request per company per day. No application POSTs. |
| Ashby Public Job Posting API | `api.ashbyhq.com/posting-api/job-board/{board}` | Documented public job-board endpoint, no key. | Skips postings with `isListed: false` (direct-link-only jobs). |
| SmartRecruiters Posting API | `api.smartrecruiters.com/v1/companies/{id}/postings` | Public posting API used by career sites. | Filters to `country=in` server-side; bounded concurrency of 4. |
| Himalayas Remote Jobs API | `himalayas.app/jobs/api/search` | Documented free API, no key. | **Terms honoured:** visible attribution link to himalayas.app on every Himalayas post and in the footer; `applicationLink` passed through **unchanged**; expired jobs removed; 1.1 s between pages; **no re-syndication** (no JobPosting structured data, no feed to other boards). |

## Sources deliberately excluded

| Site | Reason |
|---|---|
| Internshala | `robots.txt` disallows `/internship/details/`, `/job/details/`, `/api/` and all query strings. |
| Naukri, LinkedIn, Indeed, Glassdoor | Terms of service prohibit automated collection. |
| The Muse API | Returned HTTP 403 to our client during evaluation; not retried. |

## Identification

Every request sends `User-Agent: BeepJobsBot/1.0 (+https://github.com/vinitpatil519/beep; polite; daily)` so publishers can identify and contact the operator.

## Data handling

- Only job-posting content is stored. No personal data about applicants is collected.
- The web app collects no accounts, no cookies and no analytics.
- A post that disappears from its source is removed after a 2-day grace window.
