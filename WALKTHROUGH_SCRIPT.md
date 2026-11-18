# 5-Minute Technical Walkthrough Script (Loom: Face + Screen)

**Objective**: Deliver a high-signal, concise technical walkthrough demonstrating the production system, pipeline architecture, extraction accuracy, and unit economics within 5 minutes.

---

## Timeline & Camera Cues

| Timestamp | Visual Focus | Core Topic |
|---|---|---|
| **0:00 – 0:50** | Browser (`localhost:3000` or `beep-jobs.vercel.app`) + Face | Product Overview & Grounded Receipts |
| **0:50 – 1:45** | VS Code / Architecture Diagram | Public ATS Ingestion & Deduplication Topology |
| **1:45 – 2:45** | Code (`prompt.ts`, `receipt.ts`) | Structured LLM Extraction & Deterministic Verification |
| **2:45 – 3:45** | Browser (`/evals`) | Statistical Evaluation & Unit Economics ($0.54 / 1k) |
| **3:45 – 4:45** | GitHub Actions (`refresh.yml`) | Automated Daily Pipeline & Quality Gates |
| **4:45 – 5:00** | Camera / Summary | Conclusion & Wrap-Up |

---

### [0:00 – 0:50] 1. Product Overview & Grounded Receipts
- **Screen**: Main Job Board (`/jobs`).
- **Talking Points**:
  > *"Hi Beep engineering team. Today I'm walking through **beep-jobs**, an AI-powered intelligence board tracking over 740 active fresher and internship opportunities across India.*
  > *Rather than relying on ungrounded model outputs, the platform enforces a core invariant: **'No quote, no tag'**.*
  > *Every role categorization, canonical city tag, and fresher verdict is accompanied by a verbatim 3-to-15 word excerpt extracted directly from the raw job description.*
  > *Our UI is built with Next.js and optimized for low-latency client filtering across locations (Bengaluru, Hyderabad, Gurugram, Remote), roles, and experience levels, allowing candidates to immediately inspect the verifiable evidence behind every AI classification."*

---

### [0:50 – 1:45] 2. Ingestion Architecture & Deduplication Topology
- **Screen**: `pipeline/sources/registry.json` and `pipeline/dedupe.ts`.
- **Talking Points**:
  > *"Collecting real fresher jobs via traditional HTML scrapers causes frequent bot bans and stale data. Instead, our pipeline queries **official, public ATS REST APIs**—specifically Greenhouse, Lever, Ashby, and SmartRecruiters—across 80+ top Indian tech employers like Razorpay, Meesho, CRED, InMobi, and Thoughtworks, combined with live Hasjob Atom feeds.*
  > *Because jobs in India are heavily cross-posted, we run a three-stage deduplication pipeline:*
  > *1. Exact URL canonicalization stripping tracking parameters.*
  > *2. Normalized company-slug plus title fingerprinting.*
  > *3. 64-bit SimHash text similarity clustering.*
  > *This merges ~18% cross-posted duplicates into unified clusters while preserving the primary source link."*

---

### [1:45 – 2:45] 3. Structured LLM Extraction & Deterministic Verification
- **Screen**: `pipeline/tagger/prompt.ts` and `core.test.ts`.
- **Talking Points**:
  > *"For extraction, we use Gemini 3.5 Flash Lite with strict JSON schema enforcement.*
  > *The prompt resolves ambiguous corporate roles using explicit operational tie-breakers—for example, distinguishing between data science modeling (`data_ai`) versus AI annotation and RLHF gig work (`operations`).*
  > *Crucially, we do not trust model output blindly: a deterministic verification layer performs a character-for-character substring check ensuring that every returned receipt quote actually exists in the raw post.*
  > *If a quote is missing or mutated, the tag is rejected or flagged for review. We have 12 automated unit tests validating everything from city gazetteer normalization to receipt enforcement."*

---

### [2:45 – 3:45] 4. Evaluation Methodology & Cost Analysis
- **Screen**: Live `/evals` page.
- **Talking Points**:
  > *"To evaluate accuracy, we established a **held-out test set of 100 posts** (and a 50-post sample) labelled **completely blind** prior to model inference.*
  > *Our results:*
  > *- **Role Accuracy**: **98.0%** (Lenient) / **90.0%** (Strict), with a Wilson 95% confidence interval of 93% to 99%.*
  > *- **City Accuracy**: **95.0%** against our canonical gazetteer.*
  > *- **Combined Accuracy**: **93.0%** for both labels correct on the same posting.*
  > *- **Verdict Accuracy**: **96.4%** identifying genuine fresher roles.*
  > *Crucially, a deterministic rules-only baseline achieves only **56.0%** on role tagging—meaning the LLM delivers an indispensable **+42% accuracy gain**.*
  > *On **Cost**: telemetry from our production run shows 468 input and 161 output tokens per post. At standard Google list prices, our cost is **$0.54 per 1,000 posts** (about ₹45 INR). With SHA-1 content addressing, unchanged posts cost **$0.00**, keeping daily incremental refresh costs under **$0.03 per day**."*

---

### [3:45 – 4:45] 5. Automated Daily Refresh & Quality Gates
- **Screen**: `.github/workflows/refresh.yml`.
- **Talking Points**:
  > *"The system is entirely automated. A GitHub Actions workflow triggers daily at 08:00 AM IST.*
  > *The runner executes our test suite, collects latest postings, deduplicates against existing clusters, tags net-new postings via Gemini, verifies quotes, tests the quality gate, and commits the updated data.*
  > *Vercel automatically detects the commit and redeploys the updated static search bundle with zero human intervention."*

---

### [4:45 – 5:00] 6. Summary
- **Screen**: Camera / GitHub repo.
- **Talking Points**:
  > *"To conclude: 749 live fresher jobs, 98% role tagging accuracy with verifiable receipts, $0.54 per 1,000 posts inference cost, and automated daily refreshes. All evaluation datasets, prompts, and code are open and fully reproducible in the repository. Thank you!"*
