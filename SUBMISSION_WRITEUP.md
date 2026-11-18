# Task Submission: Gen AI Job Board (India Fresher & Internship Intelligence)

**Candidate**: Rajat Parikh  
**Repository**: [https://github.com/parikhrjt/beep_assignment](https://github.com/parikhrjt/beep_assignment)  
**Live Application**: [https://beep-jobs.vercel.app](https://beep-jobs.vercel.app) · [Evaluation Suite](https://beep-jobs.vercel.app/evals) · [LLM Endpoint](https://beep-jobs.vercel.app/llms.txt)

---

## 1. Executive Summary & Required Metrics

| Evaluation Metric | Measured Result | Methodology & Statistical Bounds |
|---|---|---|
| **Tagging Accuracy (Role)** | **98.0%** (Lenient) / **90.0%** (Strict) | **100 held-out posts** (and 100% on 50-sample), labelled **blind** prior to inference. Wilson 95% CI: **[93.0%, 99.4%]**. |
| **Tagging Accuracy (City)** | **95.0%** | Wilson 95% CI: **[88.8%, 97.8%]**. Validated against canonical Indian metro gazetteer. |
| **Combined Accuracy (Role + City)** | **93.0%** | Wilson 95% CI: **[86.3%, 96.6%]**. Both labels correct on the same posting. |
| **Fresher Verdict Accuracy** | **96.4%** (80/83) | Evaluates whether minimum experience requirement $\le 2$ years. Baseline rules: 88.0%. |
| **Rules-Only Baseline (Role)** | **56.0%** | Regex/keyword baseline fails on umbrella titles; **LLM provides a +42.0% absolute accuracy delta**. |
| **Inference Cost per 1,000 Posts** | **$0.544 USD** (~₹45 INR) | Real token telemetry (`usageMetadata`) on Gemini 3.5 Flash Lite ($0.30/M in, $2.50/M out). Average: 468 prompt + 161 completion tokens/post. |
| **Marginal Daily Refresh Cost** | **$0.00** (Cached) / **~$0.02** (New) | SHA-1 content-addressed store (`sha1(title + company + location + text)`). Unchanged posts bypass LLM calls entirely. |

---

## 2. Engineering Findings & System Architecture

### Architectural Pipeline
```
[Public ATS APIs & Atom Feeds]
 (Greenhouse, Lever, Ashby, SmartRecruiters, Hasjob, Himalayas)
               │
               ▼
[Normalizer & Filter] ──> Drop non-India locations & senior requirements (>2 YOE)
               │
               ▼
[Multi-Stage Deduplication]
 ├─ Exact URL Canonicalization (strip tracking tokens & query params)
 ├─ Slug Fingerprinting: sha1(company_slug + normalized_title)
 └─ Text Fingerprinting: 64-bit SimHash near-duplicate clustering
               │
               ▼
[Content-Hash Cache] ──> Match on sha1(text + prompt_v + model) ──> Cache Hit ($0.00)
               │ (Cache Miss)
               ▼
[Structured LLM Extraction] (Gemini 3.5 Flash Lite)
 ├─ Strict JSON Schema Output (Role, Canonical Cities, Verdict, Min YOE)
 └─ Verbatim Receipt Extraction (3–15 word character-for-character quote)
               │
               ▼
[Deterministic Verification Gate]
 ├─ Substring match: Assert receipt quote exists verbatim in raw post
 └─ City reconciliation: Validate model output against Indian city gazetteer
               │
               ▼
[Quality Gate & Publish] ──> Commit to SQLite DB + Static Deployment
```

---

### What I Found (In My Own Words)

#### 1. First-Party Public ATS Endpoints vs Unstructured HTML Scraping
Scraping client-rendered HTML from aggregate job portals (LinkedIn, Naukri, Indeed) is inherently brittle—subject to Cloudflare bot-detection, non-deterministic DOM mutations, and stale listings.  
Instead, targeting **official public ATS REST APIs** (`boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`, `api.smartrecruiters.com`) across 80+ active Indian tech organizations (Razorpay, Meesho, CRED, InMobi, Freshworks, Thoughtworks, Rubrik, Atlan) yields 100% active, verifiable postings with structured metadata, zero IP throttling, and zero HTML parsing overhead.

#### 2. Where the LLM Earns Its Cost (+42% Role Delta)
A deterministic gazetteer performs well on normalized location fields (achieving **97.0%** city accuracy). However, heuristics fail severely on role classification (**56.0%** accuracy) due to corporate title ambiguity:
* **Umbrella Titles**: Postings titled *"Associate, Technology"* or *"Graduate Trainee"* convey zero role signal to regex. The LLM parses job responsibilities (e.g. Go microservices, Kafka pipelines) to correctly classify the role as `software`.
* **Disambiguating AI Gig Work from AI Engineering**: A title like *"AI Conversation Contributor"* matches `data_ai` under naive keyword heuristics. The LLM applies operational tie-breakers, categorizing data annotation/RLHF evaluation as `operations`.

#### 3. Hallucination Mitigation via Verbatim Grounding ("No Quote, No Tag")
To eliminate hallucinated tags without complex secondary validation models, the extraction prompt mandates a **verbatim quote (3–15 words) copied character-for-character from the raw text** for every assigned tag.  
A deterministic post-processor verifies that `raw_text.toLowerCase().includes(quote.toLowerCase())`. If verification fails, the tag is rejected or flagged for review. This enforces a strict audit trail ("receipts") accessible directly in the UI.

#### 4. Sub-Linear Operational Unit Economics
Running daily LLM extraction on 1,000+ jobs does not require significant compute expenditure. With Gemini 3.5 Flash Lite structured JSON outputs:
* 1,000 cold posts cost **$0.54 USD**.
* Daily delta ingestion processes only net-new postings (typically 30–50 posts/day).
* SHA-1 content addressing ensures unchanged posts cost **$0.00**.
* Total steady-state maintenance cost: **<$0.03 USD / day (<₹3 INR/day)**.

---

## 3. Deliverables & Documentation Index

| Deliverable | Path / Reference | Description |
|---|---|---|
| **Live Repository** | [github.com/parikhrjt/beep_assignment](https://github.com/parikhrjt/beep_assignment) | Complete production codebase, pipelines, and test suites. |
| **Live Web App** | [beep-jobs.vercel.app](https://beep-jobs.vercel.app) | Production Next.js UI with live filters, drawer details, and verified receipts. |
| **Interactive Evals** | [beep-jobs.vercel.app/evals](https://beep-jobs.vercel.app/evals) | Real-time accuracy scorecard, cost breakdown, and full audit table. |
| **Machine-Readable API** | [beep-jobs.vercel.app/llms.txt](https://beep-jobs.vercel.app/llms.txt) | LLM crawler-friendly plain text endpoint. |
| **50 Hand-Checked Dataset** | [`data/evaluation_50_handcheck.csv`](file:///Users/parikhrjt/Downloads/beep%20assignment/data/evaluation_50_handcheck.csv) | Ground truth vs LLM predictions, match flags, verbatim quotes, error notes. |
| **Live Database (749 Posts)** | [`data/posts_749_live.csv`](file:///Users/parikhrjt/Downloads/beep%20assignment/data/posts_749_live.csv) / [`data/posts.jsonl`](file:///Users/parikhrjt/Downloads/beep%20assignment/data/posts.jsonl) | All 749 verified fresher posts currently indexed. |
| **Walkthrough Script** | [`WALKTHROUGH_SCRIPT.md`](file:///Users/parikhrjt/Downloads/beep%20assignment/WALKTHROUGH_SCRIPT.md) | Structured script for the 5-minute Loom screen + face demonstration. |
| **Prompt Specifications** | [`docs/PROMPTS.md`](file:///Users/parikhrjt/Downloads/beep%20assignment/docs/PROMPTS.md) | System instructions, JSON schemas, few-shot boundaries, receipt validation. |
| **Evaluation Report** | [`docs/EVALUATION_REPORT.md`](file:///Users/parikhrjt/Downloads/beep%20assignment/docs/EVALUATION_REPORT.md) | Formal statistical breakdown, error categorization, and Wilson score intervals. |

---

## 4. Local Reproduction & Verification

```bash
# 1. Clone & install
git clone https://github.com/parikhrjt/beep_assignment.git
cd beep_assignment
npm install

# 2. Run deterministic unit test suite (12 tests)
npm test

# 3. Build SQLite search index from 749 live posts
npm run db

# 4. Start Next.js development server
npm run dev
# App available at http://localhost:3000
# Evals dashboard at http://localhost:3000/evals
```

---

## 5. Production Considerations & Scaling Roadmap

In an enterprise production deployment, the following extensions would be prioritized:
1. **Automated ATS Discovery Engine**: Crawl Indian venture portfolio sites (Peak XV, Blume, Accel India) to dynamically discover career boards matching `*.greenhouse.io`, `*.lever.co`, and `*.ashbyhq.com`, eliminating static registry curation.
2. **Workday & Enterprise Adapters**: Integrate legacy enterprise career endpoints to ingest high-volume campus hiring pipelines from TCS, Infosys, Wipro, and Accenture.
3. **Dead-Link / Expiry Reaper**: Implement automated daily `HEAD` requests across active apply URLs to prune closed listings and prevent ghost jobs.
4. **Hybrid Semantic Search**: Layer Reciprocal Rank Fusion (BM25 + `sqlite-vec` embeddings) over SQLite to support natural language queries (e.g. *"remote agentic workflows with Python"*).
5. **Context Caching**: Implement Gemini Prompt Caching over the static taxonomy instructions, reducing baseline prompt token costs by ~75% (<$0.20 per 1,000 posts).

