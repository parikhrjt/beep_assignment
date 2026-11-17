# Beep Task Submission: Gen AI Job Board

**Candidate Submission Document**  
**Task**: Live Web Tool for 200+ Indian Fresher Jobs, LLM Tagging with Receipts, Deduplication, Daily Refresh, 50-Post Hand Check & Cost Analysis.

---

## Quick Reference: Core Deliverables

| Deliverable | Details & Links |
|---|---|
| **Live Web Application** | **[https://beep-jobs.vercel.app](https://beep-jobs.vercel.app)** (or local: `npm run dev` at `http://localhost:3000`) |
| **Interactive Accuracy & Evals** | **[https://beep-jobs.vercel.app/evals](https://beep-jobs.vercel.app/evals)** |
| **Codebase Repository** | Complete git repository located in this folder (`beep assignment`) |
| **AI Machine-Readable Endpoint** | **[https://beep-jobs.vercel.app/llms.txt](https://beep-jobs.vercel.app/llms.txt)** |
| **Hand-Checked 50 Posts Dataset** | [`data/evaluation_50_handcheck.csv`](data/evaluation_50_handcheck.csv) |
| **All Live Jobs Dataset (749 Posts)** | [`data/posts_749_live.csv`](data/posts_749_live.csv) / [`data/posts.jsonl`](data/posts.jsonl) |
| **Loom Video Script** | [`WALKTHROUGH_SCRIPT.md`](WALKTHROUGH_SCRIPT.md) |
| **Prompt & Schema Docs** | [`docs/PROMPTS.md`](docs/PROMPTS.md) |
| **Detailed Evaluation Report** | [`docs/EVALUATION_REPORT.md`](docs/EVALUATION_REPORT.md) |

---

## The Two Mandatory Numbers

| Metric | Result | How It Was Measured |
|---|---|---|
| **Tagging Accuracy** | **Role: 98%** (100% on 50 sample; 98/100 on held-out)<br>**City: 95%** (100% on 50 sample; 95/100 on held-out)<br>**Both Correct: 93%**<br>**Fresher Verdict: 96%** | **Blind manual labeling** of 50 sampled posts (and expanded to 100 on a held-out test set drawn after prompt freeze). 50% first-party ATS, 50% aggregator posts. Scored with Wilson 95% confidence intervals. *Deterministic rules baseline scored only 56% on role on the exact same dataset.* |
| **Cost per 1,000 Posts** | **$0.54 USD** (~₹45 INR) | Measured from real token counts on Gemini 3.5 Flash Lite (`usageMetadata`) at $0.30/M in, $2.50/M out. 468 in-tokens + 161 out-tokens per post. With SHA-1 content-hash caching, unchanged posts cost **$0.00**, making daily incremental refresh cost **$0.02 - $0.03/day**. |

---

## (1) What I Found, In My Own Words

### 1. First-Party Public ATS APIs Crush Fragile Scraping
When collecting real, active fresher jobs in India, building traditional HTML/DOM web scrapers for platforms like LinkedIn, Indeed, or Naukri is a trap: they trigger Cloudflare captchas, change DOM classes weekly, and surface ghost or expired jobs.  
Instead, connecting directly to **official, public Applicant Tracking System (ATS) endpoints** (Greenhouse `boards-api`, Lever `api.lever.co`, Ashby `api.ashbyhq.com`, and SmartRecruiters) across 80+ top Indian tech employers (Razorpay, Meesho, CRED, InMobi, Freshworks, Thoughtworks, Rubrik, etc.) yielded 700+ verified, high-signal job postings with 100% uptime, zero rate limits, zero IP bans, and complete raw text.

### 2. The LLM Delivers +42% Role Accuracy Over Rules
A simple regex and dictionary gazetteer can match clean city names well (97% accuracy), but **fails completely on role classification (scoring only 56%)**.  
Why? Because real fresher listings in India use deceptive, umbrella, or hybrid titles:
- A title like *"Associate, Technology"* is meaningless to regex, but the LLM reads the description, identifies Go/Kubernetes API development, and correctly tags it `software`.
- Postings titled *"AI Conversation Recording Contributor"* or *"Data Associate"* look like AI roles to keyword matchers, but the LLM correctly distinguishes between building models (`data_ai`) and gig/annotation work (`operations`).

### 3. "No Quote, No Tag": Grounding Eliminates Hallucination
The biggest risk with using LLMs for production job categorization is hallucination—models inventing remote options or misattributing headquarters as the job location.  
We solved this by requiring the LLM to provide a **verbatim quote (3 to 15 words) from the post for every single tag** (role, city, and experience). Deterministic code then verifies that the quote exists character-for-character in the raw text. If the quote is missing or invented, the tag is rejected or flagged. This gives job seekers transparent trust and verifiable receipts.

### 4. Smart Deduplication is Essential in Indian Tech
Job postings in India are constantly cross-posted across boards with subtle title alterations (e.g., *"Graduate Engineer Trainee - 2026"* vs *"GET 2026 (Bangalore)"*).  
By combining URL canonicalization with MinHash / SimHash text fingerprinting, we deduplicated ~18% cross-posted duplicates into unified job clusters, recording duplicate sources while keeping the cleanest primary post.

### 5. Production LLM Workflows Can Cost Pennies
Running an LLM daily does not require expensive GPU clusters or high API bills. By using structured JSON outputs on Gemini Flash Lite with compact prompt excerpts and SHA-1 content-hash caching, re-tagging unchanged posts costs **$0.00**. Processing 1,000 posts costs only **$0.54**, and typical daily refresh costs **under ₹3 INR**, proving that GenAI applications can be production-grade, highly accurate, and extremely cheap to run.

---

## (2) Link to the Work Made

- **Live Deployed Web Application**: [https://beep-jobs.vercel.app](https://beep-jobs.vercel.app)
- **Interactive Accuracy & Ground Truth Validation**: [https://beep-jobs.vercel.app/evals](https://beep-jobs.vercel.app/evals)
- **Local Run Instructions**:
  ```bash
  git clone <repo-url>
  cd "beep assignment"
  npm install
  npm run db     # Builds SQLite database from 749 live posts
  npm test       # Runs 12 automated unit tests
  npm run dev    # Starts local Next.js dev server at http://localhost:3000
  ```

---

## (3) 5-Minute Loom Walkthrough

The minute-by-minute script with screen + face walkthrough is available in [`WALKTHROUGH_SCRIPT.md`](WALKTHROUGH_SCRIPT.md).  
- **Structure**:
  - `[0:00 - 0:45]`: Live UI demo, search & filtering 749 fresher jobs, AI tags & verbatim receipts.
  - `[0:45 - 1:45]`: Data ingestion pipeline querying Greenhouse, Lever, Ashby, and SmartRecruiters.
  - `[1:45 - 2:45]`: Deduplication engine and Gemini structured tagging prompt with receipt verification.
  - `[2:45 - 3:45]`: 50-post hand-check evaluation on `/evals`, accuracy breakdown, and cost math.
  - `[3:45 - 5:00]`: Automated daily GitHub Actions refresh workflow and summary.

---

## (4) Working Data, Prompts, and Evaluation Sheets

1. **50 Hand-Checked Posts (CSV Sheet)**:
   - [`data/evaluation_50_handcheck.csv`](data/evaluation_50_handcheck.csv): Includes Post ID, Title, Company, Raw Location, Gold Role, Gold City, LLM Predicted Role, LLM Predicted City, Match Verdicts, Verbatim Quotes, and Error Notes.
2. **Full Live Dataset (749 Jobs)**:
   - [`data/posts_749_live.csv`](data/posts_749_live.csv): Complete CSV export.
   - [`data/posts.jsonl`](data/posts.jsonl): Full JSONL dataset.
3. **Prompts & Schemas**:
   - [`docs/PROMPTS.md`](docs/PROMPTS.md): Complete system prompt, JSON response schema, and receipt validation code.
4. **Evaluation & Confidence Interval Report**:
   - [`docs/EVALUATION_REPORT.md`](docs/EVALUATION_REPORT.md): Wilson 95% confidence intervals, confusion analysis, and cost formulas.
