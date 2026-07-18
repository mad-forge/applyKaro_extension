# ApplyKro — AI Resume Tailor

A Chrome side-panel extension that reads the job description you're looking at, scores your resume against it like an ATS would, and generates a tailored, ATS-friendly PDF resume — **without ever changing your facts**. Companies, job titles, dates, education, and certifications are locked by construction; only wording, bullet emphasis, keyword placement, summary, and skills ordering are optimized.

<p align="center">
  <em>Open a job posting → extract the JD → see your ATS match → download a tailored one-page resume in the classic LaTeX (Computer Modern) style.</em>
</p>

---

## How it works

```mermaid
flowchart LR
    subgraph Chrome["Chrome side panel (React + Vite)"]
        A[Job page] -->|inject extractor| B[JD text]
        B --> C[Wizard UI<br/>Job → Resume → Report → Result]
        H[tailoredData JSON] -->|@react-pdf/renderer<br/>CMU Serif fonts| I[Tailored PDF]
    end

    subgraph Backend["Next.js backend (localhost:3000)"]
        D["/api/analyze"] --> E[Deep JD analysis<br/>AI, cached per JD]
        E --> F[Weighted ATS score<br/>+ gap analysis]
        G["/api/tailor (async job)"] --> E
        G --> X[Phase 1: Extract facts<br/>AI, verbatim, cached per resume]
        X --> Y[Phase 2: Optimize<br/>summary / bullets / skill order only]
        Y --> Z[Assemble in code<br/>facts locked + quality guards]
    end

    C -->|resume + JD| D
    C -->|resume + JD| G
    Z --> H
```

### The pipeline, step by step

1. **JD extraction (extension)** — A self-contained script is injected into the active tab (`chrome.scripting.executeScript`) and scrapes the job description from LinkedIn/Indeed layouts, with a content-script fallback. The side panel re-extracts automatically when you switch tabs, and never overwrites hand-pasted text.

2. **Deep JD analysis (AI, cached 30 min per JD)** — The LLM extracts the role title, seniority, responsibilities, qualifications, exact ATS keyword phrases, and every skill with a **priority** (`critical` / `important` / `nice-to-have`) and matching aliases. "Must have" lists are captured exhaustively; either/or requirements ("React **or** Angular") match through aliases. If the text isn't a job description at all, the API says so instead of returning a garbage score. A deterministic 31-skill taxonomy is the offline fallback.

3. **ATS scoring (deterministic, no AI)** — The resume text is matched against the analysis with alias/fuzzy matching. Scoring is priority-weighted (critical ×3, important ×2, nice-to-have ×1) plus ATS-keyword coverage, education, and experience components. Gaps are classified as **visibility** (buried too deep), **wording** (alias instead of the JD's term), or **capability** (genuinely missing — and the tool refuses to fake those).

4. **Facts-locked tailoring (two AI phases)** —
   - **Phase 1 — Extract** (cached 24 h per resume): the resume is parsed into structured facts *verbatim* — every value validated against the source text, duplicate projects merged, skill groups preserved with the source's own labels.
   - **Phase 2 — Optimize**: the model receives the locked facts plus the prioritized JD targets and may return **only** a summary, a skills ordering, and rewritten bullets per item ID.
   - **Assembly (code, not AI)**: the final resume is built in code — name, employers, titles, dates, education, and certifications are copied from Phase 1 and never pass through the optimizer's output, so the AI *cannot* alter them. Skills are constrained to the source list (a smuggled "Kubernetes" gets silently dropped).

5. **Quality guards (deterministic)** — Bolted-on keyword endings (", demonstrating Communication") are detected by regex, retried with corrections, and stripped as a last resort. The summary's lead title must exist in the source's own job titles/summary — a QA/frontend candidate cannot be relabeled "Fullstack Engineer". The tailored resume is re-scored so the UI can show an honest before → after.

6. **PDF generation (client-side)** — The extension renders the final PDF locally with `@react-pdf/renderer` using bundled **Computer Modern** (LaTeX) fonts: compact one-page layout, grouped bold-label skills, bold titles with right-aligned dates, italic organizations. Font ligature tables are stripped so extracted text stays byte-exact for ATS parsers, and hyphenation is disabled so URLs never break.

### Hostile-input handling

Users upload anything, so every entry point defends itself:

| Input | Behavior |
|---|---|
| Text/scanned/designer PDF | Text extraction; image-only PDFs fall back to **AI OCR** |
| DOCX | `mammoth` text extraction |
| PNG / JPEG / WEBP screenshot of a resume | Accepted, read via AI OCR |
| File renamed to `.pdf` | Caught by magic-byte detection → clear 400 |
| Password-protected / corrupt PDF | Specific 422 messages |
| A JD/invoice/article uploaded as "resume" | "Doesn't look like a resume" 422 |
| Lyrics/lorem-ipsum pasted as the JD | "Doesn't look like a job description" 422 |

---

## Repo layout

```
applyKro/
├── frontend/                 # Chrome extension (Vite + React 19, MV3)
│   ├── public/manifest.json  # side_panel, permissions, content script matches
│   ├── src/
│   │   ├── App.jsx           # wizard state + JD extraction + API calls
│   │   ├── components/       # Stepper, JdCard, AtsReportCard, ResumePDF, ...
│   │   ├── assets/fonts/     # CMU Serif TTFs (ligatures stripped)
│   │   ├── background.js     # opens the side panel on toolbar click
│   │   └── content.js        # declared JD scraper (fallback path)
│   └── dist/                 # build output → "Load unpacked" here
└── backend/                  # Next.js 16 API (TypeScript)
    └── src/
        ├── app/api/
        │   ├── analyze/      # POST resume+jd → ATS report
        │   ├── tailor/       # POST → jobId; GET ?jobId= → poll result
        │   └── user-resume/  # resume metadata sync (Supabase + local fallback)
        └── lib/
            ├── ai/openrouter.ts        # shared LLM client (text/file/image)
            ├── ats/                    # deep JD analyzer, weighted scoring, taxonomy fallback
            ├── resume/                 # extract (facts), optimize (+quality guards),
            │                           # factual-validation, OCR, change preview, file parsing
            └── http/                   # rate limiting, request validation
```

## Setup (local development)

**Backend**

```bash
cd backend
npm install
# create .env.local with at least:
#   OPENROUTER_API_KEY=sk-or-...
#   AI_MODEL=meta-llama/llama-3.3-70b-instruct   # main text model (JD analysis, extract, optimize)
#   AI_VISION_MODEL=google/gemini-2.5-flash-lite # OCR for scanned/image resumes (needs vision)
# optional: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (user-resume sync)
# optional (cloud links via Cloudflare R2): S3_ENDPOINT, S3_REGION=auto,
#   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_PRIVATE
#   (S3_ALLOW_SELF_SIGNED=true / OPENROUTER_ALLOW_SELF_SIGNED=true behind a
#   TLS-intercepting proxy)
npm run dev                    # http://localhost:3000
npx vitest run                 # unit tests
node scripts/r2-healthcheck.mjs                        # live R2 upload/download check
npx vitest run scripts/render-sample-pdf.test.tsx      # render a sample PDF to scripts/out/
```

**Extension**

```bash
cd frontend
npm install
npm run build        # outputs dist/
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `frontend/dist`. Click the toolbar icon on a LinkedIn/Indeed job page to open the side panel. After code changes: rebuild + reload the extension (and refresh already-open job tabs once).

## API reference

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/analyze` | POST | multipart `resume` (file) + `jd` (text) | Full ATS report (`atsScore`, `gapAnalysis`, `jdAnalysis`, `keywordAnalysis`) |
| `/api/tailor` | POST | multipart `resume` + `jd` | `202 { jobId, pollUrl }` |
| `/api/tailor?jobId=` | GET | — | `pending / processing / completed / failed`; on success: report + `tailoredAtsScore` + `resumeChanges` + `tailoredData` (render PDF client-side) |
| `/api/user-resume` | POST/GET | JSON metadata / `?email=` | Persisted resume preference |
| `/api/extract-jd` | POST | JSON `{ text, url? }` (Readability page text) | `{ isJobDescription, jd }` — AI filter that isolates the JD from page noise |
| `/api/resume-pdf` | POST | multipart `pdf` (the rendered tailored PDF) | `201 { key, downloadUrl, expiresAt }` — stores in Cloudflare R2, returns a 7-day presigned link |

Rate limits (per IP, in-memory): analyze 20/hr, tailor 5/hr, user-resume 60/hr, extract-jd 30/hr, resume-pdf 20/hr. JD length 80–60,000 chars; resume files ≤ 8 MB.

### JD capture tiers (extension)

1. **Highlight & click** — highlighted text on *any* page wins: right-click → **ApplyKro: Tailor with selected text** (opens the side panel with the selection as the JD), or highlight and press **Extract**.
2. **Known job boards** — LinkedIn/Indeed selector-based scraping (unchanged).
3. **Any other site** — `@mozilla/readability` strips the page to its main article in the side panel, then `/api/extract-jd` uses the LLM to isolate the job description; falls back to the raw article text if the backend/AI is unreachable.

## What the AI can and cannot change

| Locked (copied verbatim in code) | Optimized (AI, evidence-bound) |
|---|---|
| Name, contact details | Professional summary (source-supported title only) |
| Employers, job titles, employment dates | Bullet wording + ordering (no invented tech/metrics) |
| Education, degrees, years | Skills ordering + JD-terminology renames |
| Certifications, languages, personal details | Which JD keywords get surfaced (source-supported only) |
| Project names & structure | — |

## Current limitations (read before publishing)

- **Backend URL is hardcoded to `http://localhost:3000`** in the extension — every user must run the backend, so this is a dev setup, not a distributable product yet.
- **All state is in-memory** (tailor jobs, caches, rate limits): fine on one long-lived Node server, **breaks on serverless** (Vercel functions don't share memory between invocations — the poll endpoint would 404). Deploying for real users needs Redis/DB for the job store or a synchronous/streaming tailor endpoint.
- **No authentication** — anyone who can reach the API spends your OpenRouter credits. Per-IP limits reset on restart and are easy to sidestep.
- CORS is `*`; JD extraction only supports LinkedIn/Indeed hosts.
- Costs roughly $0.001–0.003 per tailor run (2 uncached AI calls + caching); OCR uploads cost slightly more.

**Publish checklist**: deploy the backend (persistent job store) → make the API base URL configurable → add auth/quotas → restrict CORS → then Chrome Web Store.

## License / status

Personal project, under active development. PDF typeface: CMU Serif (cm-unicode, SIL OFL).
