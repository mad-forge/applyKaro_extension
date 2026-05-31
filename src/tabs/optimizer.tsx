import "~style.css"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

import LightRays from "~components/LightRays"
import type { JobData } from "~lib/types"

const Button = ({
  className = "",
  variant: _variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
  <button className={`ak-button plasmo-rounded-md ${className}`} {...props} />
)

const ProgressBar = ({ value }: { value: number }) => (
  <div className="ak-progress">
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)

const ThemeProvider = ({ children }: { children: ReactNode; theme?: unknown }) => <>{children}</>
const PageGlobalStyles = () => null
const pageTheme = {}

type OptimizeResponse = {
  missing_keywords: string[]
  ats_score_out_of_100: number
  optimized_resume_text?: string
  optimized_latex_resume?: string
  keyword_injection_plan?: string[]
  change_log?: Array<{
    section: string
    before: string
    after: string
    reason: string
  }>
  rewritten_bullet_points: Array<{ original: string; optimized: string }>
}

type InterviewQuestion = {
  question: string
  why_asked: string
  evaluates: string
  talking_points: string[]
}

type CareerAnalysis = {
  job_profile: {
    title: string
    company: string
    skills: string[]
    responsibilities: string[]
    requirements: string[]
    experience: string
    technologies: string[]
    summary: string
  }
  candidate_profile: {
    skills: string[]
    projects: string[]
    experience: string[]
    education: string[]
    certifications: string[]
    achievements: string[]
  }
  match_analysis: {
    match_score: number
    skill_match: number
    experience_match: number
    keyword_match: number
    matched_skills: string[]
    missing_skills: string[]
    missing_keywords: string[]
    weak_areas: string[]
    explanation: string
  }
  resume_optimization: {
    better_summary: string[]
    better_experience_points: string[]
    better_project_points: string[]
    ats_keywords_suggestions: string[]
  }
  interview_prep: {
    technical: InterviewQuestion[]
    role_specific: InterviewQuestion[]
    behavioral: InterviewQuestion[]
  }
  career_copilot: {
    why_not_matching: string[]
    hiring_manager_perspective: string[]
    improvement_priority: {
      high: string[]
      medium: string[]
      low: string[]
    }
  }
  fit_prediction: {
    label: "Strong Fit" | "Moderate Fit" | "Weak Fit"
    reason: string[]
    missing: string[]
  }
}

const normalizeOptimizeResult = (body: any, resumeText: string): OptimizeResponse => {
  const scoreRaw =
    body?.ats_score_out_of_100 ??
    body?.ats_score ??
    body?.score ??
    body?.atsScoreOutOf100
  const score = Number.isFinite(Number(scoreRaw)) ? Math.max(0, Math.min(100, Number(scoreRaw))) : 65

  const missingKeywordsRaw = body?.missing_keywords ?? body?.missingKeywords ?? body?.missing
  const missingKeywords = Array.isArray(missingKeywordsRaw)
    ? missingKeywordsRaw.map((item: unknown) => String(item).trim()).filter(Boolean)
    : []

  const optimizedResumeTextRaw =
    body?.optimized_resume_text ?? body?.optimizedResumeText ?? body?.optimized_resume
  const optimizedResumeText =
    typeof optimizedResumeTextRaw === "string" && optimizedResumeTextRaw.trim().length > 0
      ? optimizedResumeTextRaw
      : resumeText

  const rewrittenRaw = body?.rewritten_bullet_points ?? body?.rewrittenBullets ?? []
  const rewrittenBullets = Array.isArray(rewrittenRaw)
    ? rewrittenRaw
        .map((item: any) => ({
          original: String(item?.original ?? "").trim(),
          optimized: String(item?.optimized ?? "").trim()
        }))
        .filter((item) => item.original && item.optimized)
    : []

  return {
    missing_keywords: missingKeywords,
    ats_score_out_of_100: score,
    optimized_resume_text: optimizedResumeText,
    optimized_latex_resume:
      typeof body?.optimized_latex_resume === "string" ? body.optimized_latex_resume : undefined,
    keyword_injection_plan: Array.isArray(body?.keyword_injection_plan)
      ? body.keyword_injection_plan.map((item: unknown) => String(item))
      : [],
    change_log: Array.isArray(body?.change_log) ? body.change_log : [],
    rewritten_bullet_points: rewrittenBullets
  }
}

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000"
const DEMO_USER_ID =
  process.env.PLASMO_PUBLIC_DEMO_USER_ID || "00000000-0000-0000-0000-000000000001"
const RECENT_ANALYSES_KEY = "applyKroRecentAnalyses"

const apiHeaders = {
  "Content-Type": "application/json",
  "x-user-id": DEMO_USER_ID
}

const hasChromeExtensionApi = () => typeof chrome !== "undefined" && Boolean(chrome.storage?.local)

const readJsonResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || ""

  if (!contentType.includes("application/json")) {
    const text = await response.text()
    throw new Error(text.includes("<!DOCTYPE") ? "Backend route is not ready. Restart the backend server." : text)
  }

  return response.json()
}

const sectionHeadings = [
  "About the job",
  "Job description",
  "What You'll Do",
  "Key Responsibilities",
  "What You'll Need",
  "Technical Skills",
  "Preferred / Nice To Have",
  "Education & Experience",
  "How We Work",
  "How We Work (core Competencies)",
  "Responsibilities",
  "Qualifications",
  "Requirements",
  "Minimum qualifications",
  "Preferred qualifications",
  "Skills"
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const sectionHeadingSource = sectionHeadings.map(escapeRegExp).join("|")

const splitJobDescription = (description: string) => {
  const normalized = description
    .replace(/\r/g, "")
    .replace(
      new RegExp(`(${sectionHeadingSource})(?=\\s+[A-Z(])`, "g"),
      "\n\n$1\n"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  const sections: Array<{ title: string; body: string }> = []
  const headingPattern = new RegExp(`^(${sectionHeadingSource})$`, "i")
  let currentTitle = "Description"
  let currentBody: string[] = []

  for (const line of normalized.split("\n").map((item) => item.trim()).filter(Boolean)) {
    if (headingPattern.test(line)) {
      if (currentBody.length) {
        sections.push({ title: currentTitle, body: currentBody.join("\n") })
      }
      currentTitle = line
      currentBody = []
      continue
    }

    currentBody.push(line)
  }

  if (currentBody.length) {
    sections.push({ title: currentTitle, body: currentBody.join("\n") })
  }

  return sections.length ? sections : [{ title: "Description", body: normalized }]
}

function OptimizerPage() {
  const [job, setJob] = useState<JobData | null>(null)
  const [resumeText, setResumeText] = useState("")
  const [result, setResult] = useState<OptimizeResponse | null>(null)
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingResume, setSavingResume] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [parsingResume, setParsingResume] = useState(false)
  const [resumePageCount, setResumePageCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optimizationProgress, setOptimizationProgress] = useState(0)

  const jobSections = useMemo(() => splitJobDescription(job?.description || ""), [job])

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      if (hasChromeExtensionApi()) {
        const stored = await chrome.storage.local.get("interviewMintActiveJob")
        setJob((stored.interviewMintActiveJob as JobData | undefined) || null)
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/resume`, { headers: apiHeaders })
        if (response.ok) {
          const body = await response.json()
          setResumeText(body?.base_resume || "")
        }
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => {
      setLoading(false)
      setError("Could not load optimizer data.")
    })
  }, [])

  useEffect(() => {
    if (!optimizing) {
      setOptimizationProgress(0)
      return
    }

    setOptimizationProgress(12)
    const timer = window.setInterval(() => {
      setOptimizationProgress((previousPercent) => {
        if (previousPercent >= 92) return previousPercent
        const diff = Math.random() * 11
        return Math.min(previousPercent + diff, 92)
      })
    }, 450)

    return () => {
      window.clearInterval(timer)
    }
  }, [optimizing])

  const readResumeFile = async (file: File | undefined) => {
    if (!file) return

    setParsingResume(true)
    setError(null)

    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch(`${API_BASE_URL}/api/parse-resume`, {
          method: "POST",
          body: formData
        })
        const body = await readJsonResponse(response)
        if (!response.ok) throw new Error(body?.error || "Could not read PDF resume")
        setResumeText(body.text || "")
        setResumePageCount(body.page_count || null)
        return
      }

      setResumeText(await file.text())
      setResumePageCount(null)
    } catch (e) {
      setError((e as Error).message || "Could not read resume file")
    } finally {
      setParsingResume(false)
    }
  }

  const downloadOptimizedResume = async () => {
    if (!result?.optimized_resume_text) return

    const response = await fetch(`${API_BASE_URL}/api/export-resume-pdf`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        latex_source: result.optimized_latex_resume,
        job_title: job?.title
      })
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.error || "Could not export PDF")
      return
    }

    const file = await response.blob()
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    const safeTitle = (job?.title || "optimized-resume").replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    link.href = url
    link.download = `${safeTitle}-interviewmint-resume.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveResume = async () => {
    setSavingResume(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ base_resume: resumeText })
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "Could not save resume")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingResume(false)
    }
  }

  const optimizeResume = async () => {
    if (!job) return

    setOptimizing(true)
    setResult(null)
    setAnalysis(null)
    setError(null)

    try {
      await saveResume()

      const analysisResponse = await fetch(`${API_BASE_URL}/api/analyze-career`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          job_title: job.title,
          company: job.company,
          job_description: job.description,
          base_resume: resumeText
        })
      })
      const analysisBody = await analysisResponse.json()
      if (!analysisResponse.ok) throw new Error(analysisBody?.error || "Failed to analyze fit")
      setAnalysis(analysisBody as CareerAnalysis)
      if (hasChromeExtensionApi()) {
        const stored = await chrome.storage.local.get(RECENT_ANALYSES_KEY)
        const recent = ((stored[RECENT_ANALYSES_KEY] || []) as Array<{ job: JobData; analysis: CareerAnalysis; createdAt: string }>)
          .filter((item) => item.job.url !== job.url)
        await chrome.storage.local.set({
          [RECENT_ANALYSES_KEY]: [
            { job, analysis: analysisBody as CareerAnalysis, createdAt: new Date().toISOString() },
            ...recent
          ].slice(0, 10)
        })
      }

      const response = await fetch(`${API_BASE_URL}/api/optimize`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          job_title: job.title,
          company: job.company,
          job_description: job.description,
          base_resume: resumeText,
          page_count: resumePageCount || 1
        })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Failed to optimize resume")
      setOptimizationProgress(100)
      setResult(normalizeOptimizeResult(body, resumeText))
    } catch (e) {
      setError((e as Error).message || "Failed to optimize resume.")
    } finally {
      setOptimizing(false)
    }
  }

  const renderList = (items: string[] | undefined, empty = "No evidence found yet.") => (
    <ul className="plasmo-mt-3 plasmo-space-y-2 plasmo-text-sm plasmo-leading-6 plasmo-text-stone-700">
      {(items?.length ? items : [empty]).map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  )

  const renderQuestionList = (title: string, questions: InterviewQuestion[] = []) => (
    <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
      <h3 className="plasmo-text-sm plasmo-font-semibold">{title}</h3>
      <div className="plasmo-mt-3 plasmo-space-y-3">
        {questions.map((item, index) => (
          <div key={`${item.question}-${index}`} className="plasmo-border-l-2 plasmo-border-stone-500/40 plasmo-pl-3">
            <p className="plasmo-text-sm plasmo-font-semibold plasmo-text-stone-950">{item.question}</p>
            <p className="plasmo-mt-1 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-700">
              Why: {item.why_asked}
            </p>
            <p className="plasmo-mt-1 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-700">
              Evaluates: {item.evaluates}
            </p>
            <p className="plasmo-mt-1 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-700">
              Talking points: {item.talking_points?.join(", ") || "Use concrete examples."}
            </p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <ThemeProvider theme={pageTheme}>
      <PageGlobalStyles />
      <main className="ak-bg ak-dashboard-bg plasmo-min-h-screen plasmo-text-sky-50">
        <div style={{ position: "absolute", inset: "0 0 auto 0", pointerEvents: "none", zIndex: 0 }}>
          <div style={{ width: "100%", height: "760px", position: "relative" }}>
            <LightRays
              raysOrigin="top-center"
              raysColor="#ffffff"
              raysSpeed={1}
              lightSpread={1.05}
              rayLength={4.8}
              followMouse={true}
              mouseInfluence={0.1}
              noiseAmount={0}
              distortion={0}
              className="custom-rays"
              pulsating={false}
              fadeDistance={1.2}
              saturation={1.15}
            />
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
      <div className="plasmo-mx-auto plasmo-grid plasmo-max-w-[1500px] plasmo-grid-cols-1 plasmo-gap-5 plasmo-p-6 lg:plasmo-grid-cols-[0.95fr_1.05fr]">
        <section className="ak-card-soft plasmo-rounded-lg plasmo-p-6">
          <p className="plasmo-text-xs plasmo-font-semibold plasmo-uppercase plasmo-tracking-widest plasmo-text-stone-700">
            applyKaro
          </p>
          <h1 className="plasmo-mt-2 plasmo-text-2xl plasmo-font-semibold">ApplyKro Dashboard</h1>

          {loading && <p className="plasmo-mt-5 plasmo-text-sm plasmo-text-stone-600">Loading job...</p>}

          {!loading && !job && (
            <p className="plasmo-mt-5 plasmo-text-sm plasmo-text-stone-600">
              Detect a job, paste a URL, or use Selector Mode from the extension popup.
            </p>
          )}

          {job && (
            <div className="plasmo-mt-5">
              <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-4">
                <div>
                  <h2 className="plasmo-text-2xl plasmo-font-semibold">{job.title}</h2>
                  <p className="plasmo-mt-1 plasmo-text-base plasmo-text-stone-700">{job.company}</p>
                  {(job.location || job.workplace) && (
                    <p className="plasmo-mt-1 plasmo-text-sm plasmo-font-medium plasmo-text-stone-700">
                      {[job.location, job.workplace].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Button variant="raised"
                  type="button"
                  onClick={() => {
                    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
                      chrome.tabs.create({ url: job.url })
                      return
                    }
                    window.open(job.url, "_blank", "noopener,noreferrer")
                  }}
                  className="plasmo-relative plasmo-overflow-hidden plasmo-px-5 plasmo-py-2 plasmo-text-sm plasmo-font-semibold plasmo-text-stone-950">
                  Apply
                </Button>
              </div>

              <div className="ak-card-soft plasmo-mt-5 plasmo-max-h-[72vh] plasmo-overflow-y-auto plasmo-rounded-lg plasmo-p-4">
                <div className="plasmo-space-y-5">
                  {jobSections.map((section, index) => (
                    <section key={`${section.title}-${index}`}>
                      <h3 className="plasmo-text-base plasmo-font-semibold plasmo-text-stone-950">
                        {section.title}
                      </h3>
                      <p className="plasmo-mt-3 plasmo-whitespace-pre-wrap plasmo-text-sm plasmo-leading-7 plasmo-text-stone-700">
                        {section.body}
                      </p>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="ak-card-soft plasmo-rounded-lg plasmo-p-6">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-3">
            <h2 className="plasmo-text-xl plasmo-font-semibold">Base resume</h2>
            <input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(event) => readResumeFile(event.target.files?.[0])}
              className="plasmo-max-w-[220px] plasmo-text-xs plasmo-text-stone-700 file:plasmo-mr-3 file:plasmo-border file:plasmo-border-stone-500 file:plasmo-bg-[#A0A0A0] file:plasmo-px-4 file:plasmo-py-2 file:plasmo-text-stone-950"
            />
          </div>

          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            className="ak-input plasmo-mt-4 plasmo-h-64 plasmo-w-full plasmo-resize-none plasmo-rounded-lg plasmo-p-4 plasmo-text-sm plasmo-leading-6 plasmo-outline-none"
            placeholder={parsingResume ? "Reading PDF resume..." : "Paste your base resume here..."}
          />

          <div className="plasmo-mt-4 plasmo-flex plasmo-gap-3">
            <Button variant="raised"
              type="button"
              onClick={saveResume}
              disabled={savingResume || parsingResume || !resumeText.trim()}
              className="plasmo-relative plasmo-overflow-hidden plasmo-px-5 plasmo-py-2 plasmo-text-sm plasmo-font-semibold disabled:plasmo-text-stone-500">
              {savingResume ? "Saving..." : "Save Resume"}
            </Button>
            <Button
              variant="raised"
              type="button"
              onClick={optimizeResume}
              disabled={optimizing || parsingResume || !job || !resumeText.trim()}
              className="ak-button plasmo-relative plasmo-overflow-hidden plasmo-px-6 plasmo-py-2 plasmo-text-sm plasmo-font-semibold">
              {optimizing ? "Analyzing..." : "Analyze Fit"}
            </Button>
          </div>

          {optimizing && (
            <div className="ak-card-soft plasmo-mt-4 plasmo-rounded-lg plasmo-p-3">
              <p className="plasmo-mb-2 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">
                Optimizing resume...
              </p>
              <ProgressBar value={Math.floor(optimizationProgress)} />
            </div>
          )}

          {error && <p className="plasmo-mt-4 plasmo-text-sm plasmo-text-rose-300">{error}</p>}

          {analysis && (
            <div className="plasmo-mt-5 plasmo-space-y-4">
              <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-3">
                  <div>
                    <h3 className="plasmo-text-sm plasmo-font-semibold">Overview</h3>
                    <p className="plasmo-mt-2 plasmo-text-sm plasmo-leading-6 plasmo-text-stone-700">
                      {analysis.job_profile.summary}
                    </p>
                  </div>
                  <div className="plasmo-text-right">
                    <p className="plasmo-text-3xl plasmo-font-semibold">{analysis.match_analysis.match_score}%</p>
                    <p className="plasmo-text-xs plasmo-text-stone-700">{analysis.fit_prediction.label}</p>
                  </div>
                </div>
                <div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-3 plasmo-gap-3">
                  <div>
                    <p className="plasmo-text-xs plasmo-text-stone-700">Skill Match</p>
                    <ProgressBar value={analysis.match_analysis.skill_match} />
                  </div>
                  <div>
                    <p className="plasmo-text-xs plasmo-text-stone-700">Experience</p>
                    <ProgressBar value={analysis.match_analysis.experience_match} />
                  </div>
                  <div>
                    <p className="plasmo-text-xs plasmo-text-stone-700">Keywords</p>
                    <ProgressBar value={analysis.match_analysis.keyword_match} />
                  </div>
                </div>
                <p className="plasmo-mt-3 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-700">
                  {analysis.match_analysis.explanation}
                </p>
              </div>

              <div className="plasmo-grid plasmo-grid-cols-1 plasmo-gap-4 xl:plasmo-grid-cols-2">
                <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                  <h3 className="plasmo-text-sm plasmo-font-semibold">Job Analysis</h3>
                  <p className="plasmo-mt-3 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Skills</p>
                  {renderList(analysis.job_profile.skills)}
                  <p className="plasmo-mt-4 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Technologies</p>
                  {renderList(analysis.job_profile.technologies)}
                </div>
                <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                  <h3 className="plasmo-text-sm plasmo-font-semibold">Resume Analysis</h3>
                  <p className="plasmo-mt-3 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Candidate Skills</p>
                  {renderList(analysis.candidate_profile.skills)}
                  <p className="plasmo-mt-4 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Achievements</p>
                  {renderList(analysis.candidate_profile.achievements)}
                </div>
              </div>

              <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                <h3 className="plasmo-text-sm plasmo-font-semibold">Why You're Not Matching</h3>
                {renderList(analysis.career_copilot.why_not_matching)}
                <p className="plasmo-mt-4 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Hiring Manager Perspective</p>
                {renderList(analysis.career_copilot.hiring_manager_perspective)}
              </div>

              <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                <h3 className="plasmo-text-sm plasmo-font-semibold">Optimization</h3>
                <p className="plasmo-mt-3 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Better Summary</p>
                {renderList(analysis.resume_optimization.better_summary)}
                <p className="plasmo-mt-4 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">Better Experience Points</p>
                {renderList(analysis.resume_optimization.better_experience_points)}
                <p className="plasmo-mt-4 plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">ATS Keywords</p>
                {renderList(analysis.resume_optimization.ats_keywords_suggestions)}
              </div>

              <div className="plasmo-grid plasmo-grid-cols-1 plasmo-gap-4 xl:plasmo-grid-cols-3">
                {renderQuestionList("Technical", analysis.interview_prep.technical)}
                {renderQuestionList("Role Specific", analysis.interview_prep.role_specific)}
                {renderQuestionList("Behavioral", analysis.interview_prep.behavioral)}
              </div>
            </div>
          )}

          {result && (
            <div className="plasmo-mt-5 plasmo-space-y-4">
              <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                <p className="plasmo-text-base plasmo-font-semibold">
                  ATS Score: <span className="plasmo-text-stone-800">{result.ats_score_out_of_100}/100</span>
                </p>
                <p className="plasmo-mt-1 plasmo-text-xs plasmo-text-stone-700">
                  Score is calculated from JD-keyword coverage and resume evidence match.
                </p>
                <p className="plasmo-mt-3 plasmo-text-sm plasmo-leading-6 plasmo-text-stone-700">
                  Missing Keywords: {result.missing_keywords?.join(", ") || "None"}
                </p>
              </div>

              <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-3">
                  <h3 className="plasmo-text-sm plasmo-font-semibold">Optimized resume</h3>
                  <Button
                    variant="raised"
                    type="button"
                    onClick={downloadOptimizedResume}
                    className="ak-button plasmo-relative plasmo-overflow-hidden plasmo-px-4 plasmo-py-2 plasmo-text-xs plasmo-font-semibold">
                    Download PDF
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={result.optimized_resume_text || ""}
                  className="ak-input plasmo-mt-3 plasmo-h-72 plasmo-w-full plasmo-resize-none plasmo-rounded-lg plasmo-p-3 plasmo-text-sm plasmo-leading-6"
                />
              </div>

              {result.keyword_injection_plan && (
                <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                  <h3 className="plasmo-text-sm plasmo-font-semibold">Keyword plan</h3>
                  <ul className="plasmo-mt-3 plasmo-max-h-44 plasmo-space-y-2 plasmo-overflow-y-auto plasmo-pr-2 plasmo-text-sm plasmo-leading-6 plasmo-text-stone-700">
                    {result.keyword_injection_plan.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.change_log && result.change_log.length > 0 && (
                <div className="ak-card-soft plasmo-rounded-lg plasmo-p-4">
                  <h3 className="plasmo-text-sm plasmo-font-semibold">Changes made</h3>
                  <div className="plasmo-mt-3 plasmo-max-h-[360px] plasmo-space-y-3 plasmo-overflow-y-auto plasmo-pr-2">
                    {result.change_log.map((change, index) => (
                      <div
                        key={`${change.section}-${index}`}
                        className="ak-card-soft plasmo-rounded-md plasmo-p-3">
                        <p className="plasmo-text-xs plasmo-font-semibold plasmo-text-stone-800">
                          {change.section}
                        </p>
                        <p className="plasmo-mt-2 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-600">
                          Before: {change.before}
                        </p>
                        <p className="plasmo-mt-1 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-800">
                          After: {change.after}
                        </p>
                        <p className="plasmo-mt-1 plasmo-text-xs plasmo-leading-5 plasmo-text-stone-600">
                          Why: {change.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
        </div>
      </main>
    </ThemeProvider>
  )
}

export default OptimizerPage
