import "~style.css"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"

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

const toText = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback

const toList = (value: unknown, fallback: string[] = []) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean)
  }

  if (typeof value === "string" && value.trim()) return [value.trim()]

  return fallback
}

const toScore = (value: unknown, fallback = 0) => {
  const score = Number(value)
  if (!Number.isFinite(score)) return fallback

  const percentScore = score > 0 && score <= 1 ? score * 100 : score
  return Math.max(0, Math.min(100, Math.round(percentScore)))
}

const normalizeQuestions = (value: unknown): InterviewQuestion[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(Boolean)
    .map((item: any) => ({
      question: toText(item?.question, "Tell me about a relevant project from your resume."),
      why_asked: toText(item?.why_asked ?? item?.whyAsked, "This maps to the target role."),
      evaluates: toText(item?.evaluates, "Role readiness and depth of experience."),
      talking_points: toList(item?.talking_points ?? item?.talkingPoints, ["Context", "Action", "Result"])
    }))
}

const normalizeCareerAnalysis = (body: any, job: JobData, resumeText: string): CareerAnalysis => {
  const jobProfile = body?.job_profile ?? body?.jobProfile ?? {}
  const candidateProfile = body?.candidate_profile ?? body?.candidateProfile ?? {}
  const matchAnalysis = body?.match_analysis ?? body?.matchAnalysis ?? {}
  const resumeOptimization = body?.resume_optimization ?? body?.resumeOptimization ?? {}
  const interviewPrep = body?.interview_prep ?? body?.interviewPrep ?? {}
  const careerCopilot = body?.career_copilot ?? body?.careerCopilot ?? {}
  const improvementPriority = careerCopilot?.improvement_priority ?? careerCopilot?.improvementPriority ?? {}
  const fitPrediction = body?.fit_prediction ?? body?.fitPrediction ?? {}

  return {
    job_profile: {
      title: toText(jobProfile?.title, job.title || "Target Role"),
      company: toText(jobProfile?.company, job.company || "Target Company"),
      skills: toList(jobProfile?.skills),
      responsibilities: toList(jobProfile?.responsibilities),
      requirements: toList(jobProfile?.requirements),
      experience: toText(jobProfile?.experience, "Experience requirements inferred from the JD."),
      technologies: toList(jobProfile?.technologies),
      summary: toText(jobProfile?.summary, `${job.title || "This role"} at ${job.company || "the company"}.`)
    },
    candidate_profile: {
      skills: toList(candidateProfile?.skills),
      projects: toList(candidateProfile?.projects),
      experience: toList(candidateProfile?.experience),
      education: toList(candidateProfile?.education),
      certifications: toList(candidateProfile?.certifications),
      achievements: toList(candidateProfile?.achievements)
    },
    match_analysis: {
      match_score: toScore(matchAnalysis?.match_score ?? matchAnalysis?.matchScore, 65),
      skill_match: toScore(matchAnalysis?.skill_match ?? matchAnalysis?.skillMatch, 60),
      experience_match: toScore(matchAnalysis?.experience_match ?? matchAnalysis?.experienceMatch, 60),
      keyword_match: toScore(matchAnalysis?.keyword_match ?? matchAnalysis?.keywordMatch, 60),
      matched_skills: toList(matchAnalysis?.matched_skills ?? matchAnalysis?.matchedSkills),
      missing_skills: toList(matchAnalysis?.missing_skills ?? matchAnalysis?.missingSkills),
      missing_keywords: toList(matchAnalysis?.missing_keywords ?? matchAnalysis?.missingKeywords),
      weak_areas: toList(matchAnalysis?.weak_areas ?? matchAnalysis?.weakAreas),
      explanation: toText(matchAnalysis?.explanation, "Score is based on resume evidence against the job description.")
    },
    resume_optimization: {
      better_summary: toList(resumeOptimization?.better_summary ?? resumeOptimization?.betterSummary),
      better_experience_points: toList(
        resumeOptimization?.better_experience_points ?? resumeOptimization?.betterExperiencePoints
      ),
      better_project_points: toList(resumeOptimization?.better_project_points ?? resumeOptimization?.betterProjectPoints),
      ats_keywords_suggestions: toList(
        resumeOptimization?.ats_keywords_suggestions ?? resumeOptimization?.atsKeywordsSuggestions
      )
    },
    interview_prep: {
      technical: normalizeQuestions(interviewPrep?.technical),
      role_specific: normalizeQuestions(interviewPrep?.role_specific ?? interviewPrep?.roleSpecific),
      behavioral: normalizeQuestions(interviewPrep?.behavioral)
    },
    career_copilot: {
      why_not_matching: toList(careerCopilot?.why_not_matching ?? careerCopilot?.whyNotMatching),
      hiring_manager_perspective: toList(
        careerCopilot?.hiring_manager_perspective ?? careerCopilot?.hiringManagerPerspective
      ),
      improvement_priority: {
        high: toList(improvementPriority?.high),
        medium: toList(improvementPriority?.medium),
        low: toList(improvementPriority?.low)
      }
    },
    fit_prediction: {
      label: ["Strong Fit", "Moderate Fit", "Weak Fit"].includes(fitPrediction?.label)
        ? fitPrediction.label
        : "Moderate Fit",
      reason: toList(fitPrediction?.reason, ["Resume evidence partially matches this role."]),
      missing: toList(fitPrediction?.missing)
    }
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

function OptimizerPage() {
  const [job, setJob] = useState<JobData | null>(null)
  const [resumeText, setResumeText] = useState("")
  const [result, setResult] = useState<OptimizeResponse | null>(null)
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null)
  const [savingResume, setSavingResume] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [parsingResume, setParsingResume] = useState(false)
  const [resumePageCount, setResumePageCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optimizationProgress, setOptimizationProgress] = useState(0)
  const [showQuestions, setShowQuestions] = useState(false)

  const importantQuestions = useMemo(() => {
    const questions = [
      ...(analysis?.interview_prep.technical || []),
      ...(analysis?.interview_prep.role_specific || []),
      ...(analysis?.interview_prep.behavioral || [])
    ]

    if (questions.length) return questions.slice(0, 6)

    return [
      {
        question: "Walk me through the most relevant project on your resume for this role.",
        why_asked: "Interviewers want proof that your resume experience maps to the JD.",
        evaluates: "Project depth, ownership, and role fit.",
        talking_points: ["Problem", "Tech choices", "Impact"]
      },
      {
        question: "Which JD skill is your strongest, and where have you used it?",
        why_asked: "This validates the match beyond keywords.",
        evaluates: "Hands-on skill depth.",
        talking_points: ["Specific example", "Your contribution", "Result"]
      },
      {
        question: "What is one missing skill from the JD, and how would you learn it quickly?",
        why_asked: "Gaps are normal; recruiters check self-awareness.",
        evaluates: "Learning plan and honesty.",
        talking_points: ["Gap", "Plan", "Timeline"]
      },
      {
        question: "Tell me about a time you improved performance, quality, or reliability.",
        why_asked: "Most technical roles value measurable improvement.",
        evaluates: "Impact and practical problem solving.",
        talking_points: ["Before", "Action", "After"]
      },
      {
        question: "How do you handle unclear requirements or changing priorities?",
        why_asked: "This checks collaboration and ownership.",
        evaluates: "Communication and execution style.",
        talking_points: ["Clarifying questions", "Tradeoffs", "Delivery"]
      },
      {
        question: "Tell me about a challenge or failure and what you changed after it.",
        why_asked: "Interviewers assess growth mindset and resilience.",
        evaluates: "Ownership, reflection, and execution maturity.",
        talking_points: ["Situation", "What went wrong", "What improved next"]
      }
    ]
  }, [analysis])

  useEffect(() => {
    const load = async () => {
      if (hasChromeExtensionApi()) {
        const stored = await chrome.storage.local.get("interviewMintActiveJob")
        setJob((stored.interviewMintActiveJob as JobData | undefined) || null)
      }
      setResumeText("")
    }

    load().catch(() => {
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
    setShowQuestions(false)

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
      const normalizedAnalysis = normalizeCareerAnalysis(analysisBody, job, resumeText)
      if (hasChromeExtensionApi()) {
        const stored = await chrome.storage.local.get(RECENT_ANALYSES_KEY)
        const recent = ((stored[RECENT_ANALYSES_KEY] || []) as Array<{ job: JobData; analysis: CareerAnalysis; createdAt: string }>)
          .filter((item) => item.job.url !== job.url)
        await chrome.storage.local.set({
          [RECENT_ANALYSES_KEY]: [
            { job, analysis: normalizedAnalysis, createdAt: new Date().toISOString() },
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
      setAnalysis(normalizedAnalysis)
      setResult(normalizeOptimizeResult(body, resumeText))
    } catch (e) {
      setError((e as Error).message || "Failed to optimize resume.")
    } finally {
      setOptimizing(false)
    }
  }

  const jobStatus = job ? `${job.title || "Role"} at ${job.company || "company"}` : "No job detected"
  const canUpdateResume = Boolean(job && resumeText.trim() && !optimizing && !parsingResume)

  return (
    <ThemeProvider theme={pageTheme}>
      <PageGlobalStyles />
      <main className="ak-bg ak-dashboard-bg ak-optimizer-page">
        <div className="ak-optimizer-shell">
          <header className="ak-optimizer-header">
            <div>
              <p className="ak-kicker">ApplyKro</p>
              <h1>Resume Optimizer</h1>
              <p className="ak-header-copy">Update your resume, review the changes, and prep for the interview.</p>
            </div>
            <div className={job ? "ak-job-pill ak-job-pill-ready" : "ak-job-pill"}>
              <span>{job ? "Job ready" : "Waiting for job"}</span>
              <strong>{jobStatus}</strong>
            </div>
          </header>

          <section className="ak-workspace">
            <div className="ak-panel ak-input-panel">
              <div className="ak-panel-heading">
                <div>
                  <p className="ak-step-label">Step 1</p>
                  <h2>Base Resume</h2>
                </div>
                <label className="ak-file-button">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                    onChange={(event) => readResumeFile(event.target.files?.[0])}
                  />
                  Upload PDF
                </label>
              </div>

              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                className="ak-input ak-resume-input"
                placeholder={parsingResume ? "Reading PDF resume..." : "Paste your base resume here..."}
              />

              <div className="ak-action-row">
                <Button
                  variant="raised"
                  type="button"
                  onClick={saveResume}
                  disabled={savingResume || parsingResume || !resumeText.trim()}
                  className="ak-button-secondary">
                  {savingResume ? "Saving..." : "Save Resume"}
                </Button>
                <Button
                  variant="raised"
                  type="button"
                  onClick={optimizeResume}
                  disabled={!canUpdateResume}
                  className="ak-primary-action">
                  {optimizing ? "Updating..." : "Update Your Resume"}
                </Button>
              </div>

              {optimizing && (
                <div className="ak-progress-panel">
                  <div className="ak-progress-copy">
                    <span>Optimizing resume</span>
                    <strong>{Math.floor(optimizationProgress)}%</strong>
                  </div>
                  <ProgressBar value={Math.floor(optimizationProgress)} />
                </div>
              )}

              {error && <p className="ak-error">{error}</p>}
            </div>

            <div className="ak-panel ak-output-panel">
              <div className="ak-panel-heading ak-output-heading">
                <div>
                  <p className="ak-step-label">Step 2</p>
                  <h2>Updated Resume</h2>
                </div>
                {result && (
                  <div className="ak-output-actions">
                    <Button
                      variant="raised"
                      type="button"
                      onClick={downloadOptimizedResume}
                      className="ak-button-secondary">
                      Download PDF
                    </Button>
                    <Button
                      variant="raised"
                      type="button"
                      onClick={() => setShowQuestions((value) => !value)}
                      className="ak-primary-action">
                      Important Questions
                    </Button>
                  </div>
                )}
              </div>

              {result ? (
                <textarea
                  readOnly
                  value={result.optimized_resume_text || ""}
                  className="ak-input ak-updated-resume"
                />
              ) : (
                <div className="ak-empty-state">
                  <h3>Your updated resume will appear here.</h3>
                  <p>Paste your resume and run the update once a job is detected.</p>
                </div>
              )}
            </div>
          </section>

          {result && (
            <section className="ak-results-grid">
              {showQuestions && (
                <div className="ak-panel ak-questions-panel">
                  <div className="ak-panel-heading">
                    <div>
                      <p className="ak-step-label">Interview prep</p>
                      <h2>Important Questions</h2>
                    </div>
                  </div>
                  <div className="ak-question-list">
                    {importantQuestions.map((item, index) => (
                      <div key={`${item.question}-${index}`} className="ak-question-item">
                        <span>{index + 1}</span>
                        <p>{item.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.change_log && result.change_log.length > 0 && (
                <div className="ak-panel ak-changes-panel">
                  <div className="ak-panel-heading">
                    <div>
                      <p className="ak-step-label">Resume edits</p>
                      <h2>What Updated</h2>
                    </div>
                  </div>
                  <div className="ak-change-list">
                    {result.change_log.map((change, index) => (
                      <article key={`${change.section}-${index}`} className="ak-change-item">
                        <span>{change.section}</span>
                        <p><strong>Before:</strong> {change.before}</p>
                        <p><strong>After:</strong> {change.after}</p>
                        {change.reason && <p><strong>Why:</strong> {change.reason}</p>}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </ThemeProvider>
  )
}

export default OptimizerPage
