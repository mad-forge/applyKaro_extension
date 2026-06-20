# ApplyKaro Extension

ApplyKaro is a Chrome extension plus Next.js backend for tailoring resumes against job descriptions. It can extract job details from supported job pages, analyze ATS fit, remember the user's selected resume, and generate a tailored PDF resume.

## What It Does

- Extracts job descriptions from job pages such as LinkedIn.
- Lets users upload a base PDF resume once.
- Remembers the selected resume in Chrome storage so users do not need to reselect it every time.
- Reads the user's Chrome Google profile email when available.
- Saves selected resume metadata against the user in Supabase.
- Runs ATS analysis and gap detection.
- Generates optimized resume content and PDF output through backend APIs.

## Tech Stack

- Chrome Extension: Manifest V3, React, Plasmo
- Backend: Next.js App Router in `backend/`
- Database: Supabase
- AI: OpenRouter/OpenAI-compatible models
- PDF: Backend PDF export routes plus React PDF resume component

## Project Structure

```text
.
├── src/                         # Extension source
│   ├── background.ts
│   ├── content.ts
│   ├── popup.tsx
│   └── tabs/
├── backend/                     # Next.js backend
│   ├── src/app/api/             # API routes
│   ├── src/components/          # PDF resume component
│   ├── src/lib/                 # Backend utilities
│   └── supabase/                # SQL setup files
├── package.json                 # Extension scripts
└── backend/package.json         # Backend scripts
```

## Environment Variables

Create `.env` in the project root for the extension:

```env
PLASMO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
PLASMO_PUBLIC_DEMO_USER_ID=00000000-0000-0000-0000-000000000001
```

Create `backend/.env.local` for the backend:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001

OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemma-3-4b-it

OPENAI_API_KEY=your_openai_key_if_used
```

Never commit real API keys or service role keys.

## Supabase Setup

Run this SQL in the Supabase SQL editor:

```text
backend/supabase/user_resume_preferences.sql
```

That creates `public.user_resume_preferences`, which stores:

- Google account email
- Google profile id, when Chrome provides it
- selected resume filename/type/size
- selected resume metadata
- last updated timestamp

The extension stores the actual PDF locally in Chrome storage. Supabase stores metadata only.

## Local Development

Install extension dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Run backend:

```bash
cd backend
npm run dev
```

Run extension:

```bash
npm run dev
```

Load the extension in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select the generated extension build folder.

## Build

Build extension:

```bash
npm run build
```

Build backend:

```bash
cd backend
npm run build
```

## Backend API Routes

- `POST /api/user-resume` - save selected resume metadata for a Google account.
- `GET /api/user-resume?email=...` - fetch saved resume metadata.
- `POST /api/parse-resume` - parse uploaded resume.
- `POST /api/optimize` - generate optimized resume content.
- `POST /api/export-resume-pdf` - export optimized resume PDF.
- `GET/POST /api/jobs` - save and manage job records.

## Vercel Deployment

For backend deployment, set Vercel Project Settings:

```text
Root Directory: backend
Build Command: npm run build
Install Command: npm install
```

Add backend environment variables in Vercel:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=google/gemma-3-4b-it
```

If Vercel says `The specified Root Directory "backend" does not exist`, check that the deployed branch contains the `backend/` folder. The current `main` branch is structured correctly.

## Security Notes

- Rotate any key that was pasted into chat, logs, or screenshots.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Do not expose service role keys to extension code.
- Use Vercel environment variables for production secrets.
- Keep `.env*` files untracked.

## Current Notes

- The selected resume PDF is remembered locally in the browser via Chrome storage.
- Supabase stores resume metadata, not the uploaded PDF file.
- If Supabase is unavailable, the backend falls back to a local JSON cache for development.
- On Vercel, fallback cache writes to `/tmp`.
