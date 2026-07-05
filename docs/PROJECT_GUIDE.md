# ApplyKro — Personal Project Guide

> Ye doc tumhare khud ke padhne ke liye hai — poora project kya hai, kaise kaam karta hai, kya tech use hui, kaunse decisions kyu liye, aur kaunse bugs mile aur kaise fix hue. Interview me is project ko explain karna ho to ye padh ke jao.

---

## 1. Ek line me project kya hai

**ApplyKro ek Chrome side-panel extension hai jo job posting ka JD padhta hai, tumhare resume ko ATS ki tarah score karta hai, aur ek tailored ATS-friendly PDF resume generate karta hai — bina tumhare facts (company, dates, degree) badle.**

Do hisse hain:
- **`frontend/`** — Chrome extension (side panel UI + PDF generation)
- **`backend/`** — Next.js API server (AI analysis + tailoring pipeline)

---

## 2. Tech stack aur "kyu ye"

| Layer | Tech | Kyu choose kiya |
|---|---|---|
| Extension UI | **React 19 + Vite** | Fast build, HMR; Vite multi-entry se popup + content.js + background.js ek saath bundle hote hain |
| Extension platform | **Chrome Manifest V3, Side Panel API** | Popup band ho jata tha click karte hi; side panel khula rehta hai jab tum job browse karte ho |
| Styling | **Custom CSS + design tokens** (Tailwind v4 installed hai but utilities kam use hui) | Popup chhota fixed-size hai, semantic classes kaafi thi; glassmorphism theme custom CSS me |
| PDF | **@react-pdf/renderer** (client-side) + **CMU Serif fonts** | Browser me hi PDF banta hai — server pe LaTeX compiler ki zaroorat nahi; CMU = LaTeX ka classic font |
| Backend | **Next.js 16 (App Router) + TypeScript** | API routes file-system se milte hain; TS se data contracts safe |
| AI | **OpenRouter → google/gemini-2.5-flash-lite** | Sasta (~$0.0006/analysis), structured JSON output deta hai, **vision support** (OCR ke liye PDF/image padh sakta hai) |
| File parsing | **pdf-parse** (PDF), **mammoth** (DOCX) | Pure-JS, koi native dependency nahi |
| Storage | **chrome.storage.local** (resume yaad rakhne ke liye), **Supabase** (metadata sync, optional) | Resume base64 me browser me save — dobara upload nahi karna padta |
| Tests | **Vitest** | 28 unit tests — scoring, facts-locking, quality guards, file detection |

---

## 3. Chrome extension basics (jo is project me use hue)

- **Manifest V3 (`public/manifest.json`)** — extension ka config: permissions, side panel, content scripts. Hamare permissions: `activeTab`, `scripting`, `storage`, `identity`, `sidePanel`; host permissions sirf LinkedIn/Indeed + localhost:3000.
- **Side panel** — `background.js` me `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` — toolbar icon click karte hi right side me panel khulta hai aur **khula rehta hai**.
- **Content script vs injected script** — `content.js` manifest se LinkedIn/Indeed pages me automatically load hota hai. **Problem**: extension reload karo to purane tabs ka content script *orphan* ho jata hai (message ka jawab nahi deta). **Solution**: `chrome.scripting.executeScript` se ek self-contained extractor function har baar **fresh inject** hota hai — ye kabhi orphan nahi hota. Content script ab sirf fallback hai.
- **Tab-change auto-extract** — side panel `chrome.tabs.onActivated` / `onUpdated` sunta hai; naya job kholte hi JD khud refresh hota hai. Guard: agar tumne manually JD paste kiya hai to overwrite nahi karta.
- **chrome.storage.local** — resume file base64 dataURL bana ke save hoti hai (`applyKro:selectedResume`); agli baar panel kholte hi resume selected milta hai.

---

## 4. Frontend flow (wizard)

`App.jsx` me 4-step wizard hai: **Job → Resume → Report → Result**

1. **Job**: JD auto-extract hota hai (ya paste karo). JD badla to aage ke steps re-lock ho jate hain (stale report nahi dikh sakti).
2. **Resume**: PDF/DOCX/image picker. File save hoti hai storage me.
3. **Report**: "Analyze ATS Match" → `POST /api/analyze` → score ring + matched/missing skills + gaps.
4. **Result**: "Generate Tailored Resume" → `POST /api/tailor` (async job, 3-second polling) → before/after score, incorporated keywords, change preview (real diff), aur PDF auto-download.

**PDF client-side kyu banta hai?** `tailoredData` JSON backend se aata hai, aur `ResumePDF.jsx` (react-pdf template) browser me hi PDF render karta hai. Server pe PDF banane ka load zero, aur LaTeX compiler jaisi fragile dependency nahi (purane repo me LaTeX try hua tha — bahut bugs aaye the).

**Font ka kissa**: LaTeX-look ke liye CMU Serif TTFs bundle kiye. **Bug mila**: font ke "fi"/"fl" *ligatures* (jude hue glyphs) ki wajah se PDF se text copy karne pe "workflows" → "workfows" nikal raha tha — **ATS parsing toot jati**. Fix: fonttools se fonts ki GSUB (ligature) table strip kar di. Hyphenation bhi disable hai taaki URLs na tootein.

---

## 5. Backend deep dive

### 5.1 Routes

| Route | Kya karta hai |
|---|---|
| `POST /api/analyze` | resume + JD → poora ATS report (sync, ~5-8s) |
| `POST /api/tailor` | async job banata hai, turant `jobId` return (202) |
| `GET /api/tailor?jobId=` | job status poll: pending → processing → completed/failed |
| `POST /api/user-resume` | resume metadata Supabase me sync (local JSON fallback) |

### 5.2 Deep JD Analysis (`lib/ats/jd-deep-analyzer.ts`)

AI ko JD dete hain, wo structured JSON nikalta hai:
- **Role title, seniority, summary** ("employer kya value karta hai")
- **Har skill priority ke saath**: `critical` (must-have/baar-baar mentioned) / `important` (day-to-day) / `nice-to-have` (preferred/bonus) + **aliases** (js = javascript = es6)
- **Responsibilities, qualifications, exact ATS keyword phrases** (JD ki apni wording)

Important rules jo prompt me enforce hain:
- **"Must have" sections exhaustive capture hote hain** — ek bhi skill drop nahi ho sakti (ye rule tab aaya jab NIQ JD me Angular/SQL/OAuth miss ho gaye the)
- **Either/or handling**: "React **or** Angular" → ek requirement, dono aliases me — koi bhi match ho to matched
- **Not-a-JD detection**: lyrics/lorem-ipsum paste karo to 422 error, garbage score nahi
- Output **minified JSON** hona chahiye (pretty-printed output token limit me truncate ho ke parse fail karta tha — real bug tha!)

**Caching**: JD ka SHA-256 hash → 30 min cache. Analyze ke baad Tailor same analysis reuse karta hai (dobara AI call nahi).
**Fallback**: AI fail ho to pehle ek compact retry, phir 31-skill hardcoded taxonomy (degraded but kaam chalta hai).

### 5.3 ATS Scoring (`lib/ats/ats-service.ts`) — pure code, no AI

```
score = 35% × critical+important skills coverage
      +  5% × nice-to-have coverage
      + 25% × priority-weighted keyword coverage (critical×3, important×2, nice×1)
      + 15% × ATS keyword-phrase coverage
      + 10% × education match
      + 10% × experience-years match
```

Matching normalize karke hota hai (React.js = reactjs = react js). Gaps 3 tarah ke:
- **Visibility gap** — skill hai par resume me bahut neeche hai (resume ke 55% ke baad)
- **Wording gap** — alias use hua hai, JD ki exact term nahi ("unit specs" vs "unit testing")
- **Capability gap** — skill hai hi nahi. **Tool isse kabhi fake nahi karta** — recommendation deta hai ("mat likho jab tak genuine experience na ho")

### 5.4 Facts-locked Tailoring — is project ka sabse important design

**Problem**: AI se poora resume regenerate karwao to wo dates/companies bigaad sakta hai. Validation se pakadna "trust but verify" hai — hum architecture se hi impossible banate hain.

**Phase 1 — Extract** (`lib/resume/extract.ts`, resume-hash pe 24h cached):
AI resume ko **verbatim** structured facts me todta hai — contact, har job (title/company/dates/original bullets), education, certifications, skill groups (source ke apne labels: "Languages:", "Frontend:"...). Har factual field source text se fuzzy-match validate hota hai; fail ho to correction retry. Duplicate projects merge hote hain. "Ye resume hi nahi hai" detection bhi yahin.

**Phase 2 — Optimize** (`lib/resume/optimize.ts`):
AI ko locked facts + prioritized JD targets milte hain, aur wo **sirf 3 cheezein** return kar sakta hai:
```json
{ "summary": "...", "skills": ["order"], "items": [{"id": "exp-0", "bullets": ["..."]}] }
```

**Assembly (code)**: final resume code me banta hai — naam, companies, dates, education **Phase 1 se copy** hote hain. AI ke output me ye fields *hote hi nahi*, to badalna namumkin. Skills source list tak constrained (AI "Kubernetes" ghusaye to code drop kar deta hai).

### 5.5 Quality guards (deterministic, prompt pe bharosa nahi)

- **Tack-on detector**: regex jo ", demonstrating Communication" jaise bolted-on keyword endings pakadta hai → correction retry → phir bhi bache to clause strip. (Ye tab bana jab ek run me har bullet ke end me keyword chipka mila.)
- **Title lock**: summary ka lead title source ke **job titles/summary** me hona chahiye — project bullet ka "built a full-stack app" kisi ko "Fullstack Engineer" nahi bana sakta. Fail → retry → hard fallback pehli job ke title pe.
- **Re-scoring**: tailored resume dobara score hota hai → UI me honest before/after (63 → 79 type).

### 5.6 Hostile inputs ("user ko hamesha bewkuf samjho")

- **Magic bytes** se file type detect hota hai, extension/naam se nahi (`%PDF`, `PK`, `‰PNG`...) — text file rename karke .pdf banao to clear 400
- **Scanned/image PDF** → AI OCR fallback (model ko PDF/image bhej ke text transcribe)
- **PNG/JPG resume screenshot** → directly accepted, OCR se
- Password-protected/corrupt PDF, empty file, 8MB+ — sab specific errors
- Resume ki jagah invoice/JD → "doesn't look like a resume" 422

### 5.7 Rate limiting & validation

Per-IP in-memory limiter (`lib/http/rate-limit.ts`): analyze 20/hr, tailor 5/hr. JD 80–60k chars. Proper 429 with Retry-After headers.

---

## 6. Ek request ki poori journey (interview me sunao)

"Generate Tailored Resume" dabane par:

1. Extension `POST /api/tailor` bhejta hai (resume file + JD text) → backend job banata hai, `jobId` return (202)
2. Background me: file ke **magic bytes** check → text extraction (zaroorat pe OCR)
3. **Parallel**: resume facts extraction (cached) + deep JD analysis (cached)
4. Original resume ka **ATS score** computed (pure code)
5. **Optimizer AI call** — sirf summary/bullets/skill-order, prioritized targets ke against
6. **Quality checks** — tack-ons, title claim → zaroorat pe correction retry
7. **Code assembly** — locked facts + optimized content merge
8. **Re-score** → before/after; **change preview** (original vs new bullets ka real diff)
9. Extension poll karta hai (3s interval) → `completed` milte hi `tailoredData` se **browser me PDF render** (CMU fonts) → auto-download

Total: ~10-15 sec (pehli baar resume pe +5s extraction ka; baad me cached).

---

## 7. Bugs jo mile aur kya seekha (war stories 😄)

| Bug | Root cause | Fix / Lesson |
|---|---|---|
| Analysis hamesha shallow (sirf frontend skills) | JD analysis AI se hota hi nahi tha — 31-skill hardcoded list se regex match | AI-powered deep analyzer banaya. *Lesson: pehle root cause dhundo* |
| Tailoring weak | `.env.local` me `AI_MODEL=gemma-3-4b-it` — itna chhota model ki structured output pe khaali `{}` deta tha | Model test karke gemini-2.5-flash-lite kiya. *Lesson: model capability verify karo, assume mat karo* |
| PDF text me "workfows", "Certifcate" | Font ligatures — fi/fl ek glyph ban ke extraction todte the | GSUB table strip. *Lesson: ATS ke liye PDF ka **extracted text** hi sach hai, dikhna nahi* |
| NIQ JD pe Angular/SQL/OAuth gayab, score 67% inflated | Model ka JSON 2500-token cap pe **truncate** → parse fail → silent taxonomy fallback | Token cap 6k, minified output, compact retry. *Lesson: silent fallbacks dangerous hain — degradation ko observable banao* |
| ", demonstrating Communication" bullets | Prompt ne keywords bolna kaha, model ne chipka diye | Regex detector + retry + stripper. *Lesson: prompt guideline hai, guarantee nahi — code se enforce karo* |
| Side panel me JD extract fail | Extension reload pe content script orphan | `chrome.scripting.executeScript` fresh injection primary |
| Watermark bg extension me invisible | `position: fixed` + `filter` + backdrop-filter ka Chrome compositing quirk | `position: absolute` + structure change. *Lesson: minimal repro banao, binary search karo* |
| "Languages" section me skills duplicate | Safety-net code ne skills-category label ko section samajh liya | Extraction pe trust karo, force-add hatao |

---

## 8. Important files (jaldi dhundhne ke liye)

```
frontend/src/App.jsx                       ← wizard state, JD extraction, API calls, polling
frontend/src/components/ResumePDF.jsx      ← PDF template (CMU fonts, layout)
frontend/src/index.css                     ← theme tokens + glassmorphism
frontend/public/manifest.json              ← MV3 config
backend/src/lib/ats/jd-deep-analyzer.ts    ← AI JD analysis + cache + fallback
backend/src/lib/ats/ats-service.ts         ← scoring math + gap analysis
backend/src/lib/resume/extract.ts          ← Phase 1: facts extraction (locked)
backend/src/lib/resume/optimize.ts         ← Phase 2: optimize + quality guards + assembly
backend/src/lib/resume/factual-validation.ts ← fuzzy source-matching (Levenshtein)
backend/src/lib/resume/pdf-text.ts         ← magic bytes, PDF/DOCX/image, OCR routing
backend/src/lib/ai/openrouter.ts           ← shared LLM client (text/file/image input)
backend/src/app/api/tailor/route.ts        ← async job orchestration
```

---

## 9. Scaling & publish notes (short)

- Abhi **localhost-only** (API URL hardcoded) — publish se pehle backend deploy + URL configurable
- **In-memory job store** — single Node server pe sैकड़ों users theek; **serverless (Vercel) pe tootega** (poll alag instance pe jayega) → Redis chahiye
- **Auth nahi hai** — publish kiya to tumhari OpenRouter key ka bill koi bhi badha sakta hai
- Cost: ~$0.001–0.003 (₹0.1–0.25) per tailor run; caching se repeat sasta

---

## 10. Glossary

- **ATS** — Applicant Tracking System; resume ko machine se parse/score karta hai, isliye keywords + simple layout matter karte hain
- **MV3** — Chrome Manifest V3, extensions ka current platform (service worker background, declarative permissions)
- **Ligature** — do letters ka juda glyph (fi → ﬁ); print me sundar, text-extraction me zeher
- **Magic bytes** — file ke shuru ke fixed bytes jo asli type batate hain
- **OCR** — Optical Character Recognition; image se text nikalna (yahan vision-model se)
- **Facts-locking** — hamara core pattern: factual fields AI ke output se nahi, code ke copy se aate hain
- **Taxonomy fallback** — AI unavailable ho to 31 hardcoded skills wala deterministic analyzer
```
