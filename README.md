# InterviewMint Job Optimizer

InterviewMint is a Chrome Extension + Backend service that helps job seekers:

- scrape LinkedIn job details
- save jobs to a dashboard data store
- compare resume vs job description for ATS alignment
- generate an optimized resume output
- export optimized resume as PDF (LaTeX pipeline)

## Stack

- Extension: Plasmo (Manifest V3), React, Tailwind
- Backend: Next.js App Router (`backend/`)
- Database: Supabase
- AI: OpenRouter/OpenAI-compatible chat completions
- PDF: LaTeX (`pdflatex` via MacTeX)

## Project Structure

- `src/popup.tsx` - extension popup UI
- `src/content.ts` - LinkedIn page content script
- `src/background.ts` - background messaging
- `src/tabs/optimizer.tsx` - full-page resume optimizer UI
- `backend/src/app/api/*` - backend API routes
- `backend/src/lib/*` - backend utilities and templates
- `backend/supabase/*` - schema + migration SQL

## End-to-End Flow

1. User opens LinkedIn job page.
2. Content script extracts:
- job title
- company
- job description
3. Popup displays extracted data.
4. `Save Job` stores job in Supabase (`/api/jobs`).
5. `Optimize Resume` opens optimizer tab.
6. User uploads/pastes resume.
7. Backend parses resume text (`/api/parse-resume`).
8. Backend runs optimization (`/api/optimize`):
- keyword extraction
- ATS score
- suggested changes
- strict LaTeX resume output
9. `Download PDF` compiles LaTeX (`/api/export-resume-pdf`) and returns final PDF.

## Setup

## 1) Install dependencies

Root extension:

```bash
cd /Users/shashwat/extension
npm install
```

Backend:

```bash
cd /Users/shashwat/extension/backend
npm install
```

## 2) Configure environment

Extension `.env`:

```env
PLASMO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
PLASMO_PUBLIC_DEMO_USER_ID=00000000-0000-0000-0000-000000000001
```

Backend `.env.local`:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001

OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemma-3-4b-it
```

## 3) Apply database schema

Run SQL from:

- `backend/supabase/schema.sql`
- if needed for FK fixes: `backend/supabase/migrations/001_remove_auth_users_fk.sql`

## 4) Install LaTeX compiler (required for PDF export)

```bash
brew install --cask mactex
eval "$(/usr/libexec/path_helper)"
which pdflatex
```

## Run Locally

Terminal A (backend):

```bash
cd /Users/shashwat/extension/backend
npm run dev
```

Terminal B (extension):

```bash
cd /Users/shashwat/extension
npm run dev
```

Load extension in Chrome:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked: `build/chrome-mv3-dev`
4. Keep both dev servers running

## API Routes

- `GET/POST /api/jobs` - list/save jobs
- `PATCH /api/jobs` - update job status
- `GET/POST /api/resume` - get/save base resume
- `POST /api/parse-resume` - parse uploaded resume (PDF/text)
- `POST /api/optimize` - ATS optimization + strict LaTeX output
- `POST /api/export-resume-pdf` - compile and return PDF

## UI Notes

- Popup and optimizer use glassmorphism-inspired dark theme.
- Optimizer panel includes:
- ATS score
- missing keywords
- change log
- optimized resume text
- PDF export action

## Current Constraints

- Exact visual preservation for every uploaded PDF is not guaranteed.
- Current strict mode preserves template design and updates content sections.
- If AI provider fails, fallback logic returns safe normalized output.

## Security Notes

- Never commit real API keys.
- Rotate exposed service/API keys immediately.
- Use per-environment keys for dev/staging/prod.

## Build

Extension:

```bash
cd /Users/shashwat/extension
npm run build
```

Backend:

```bash
cd /Users/shashwat/extension/backend
npm run build
```

## Build in Public

Current status: active build phase (MVP hardening, ATS quality tuning, PDF fidelity improvements).
