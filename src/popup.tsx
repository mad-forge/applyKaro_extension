import "~style.css"

import { useEffect, useMemo, useState } from "react"

import type { JobData, RuntimeMessage } from "~lib/types"

type SavedJob = {
  id: string
  title: string
  company: string
  description: string
  source_url: string | null
  status: "applied" | "interviewing" | "rejected"
  created_at: string
  updated_at: string
}

type OptimizeResponse = {
  missing_keywords: string[]
  ats_score_out_of_100: number
  rewritten_bullet_points: Array<{ original: string; optimized: string }>
}

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000"
const DEMO_USER_ID =
  process.env.PLASMO_PUBLIC_DEMO_USER_ID || "00000000-0000-0000-0000-000000000001"

const apiHeaders = {
  "Content-Type": "application/json",
  "x-user-id": DEMO_USER_ID
}

function IndexPopup() {
  const [job, setJob] = useState<JobData | null>(null)
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([])
  const [loadingJob, setLoadingJob] = useState(true)
  const [loadingSavedJobs, setLoadingSavedJobs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [savingResume, setSavingResume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OptimizeResponse | null>(null)
  const [showSavedJobs, setShowSavedJobs] = useState(false)
  const [showOptimizer, setShowOptimizer] = useState(false)
  const [resumeText, setResumeText] = useState("")

  const shortDescription = useMemo(() => {
    if (!job?.description) return ""
    return job.description.length > 220 ? `${job.description.slice(0, 220)}...` : job.description
  }, [job])

  useEffect(() => {
    const scrapeActiveTabDirectly = async (tabId: number): Promise<JobData | null> => {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const textFrom = (element: Element | null): string =>
            (element?.textContent || "").replace(/\s+/g, " ").trim()

          const formattedTextFrom = (element: Element | null): string => {
            if (!element) return ""
            const raw =
              element instanceof HTMLElement
                ? element.innerText || element.textContent || ""
                : element.textContent || ""

            return raw
              .replace(/\r/g, "")
              .replace(/[ \t]+\n/g, "\n")
              .replace(/\n[ \t]+/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .replace(
                /(About the job|What You'll Do|Key Responsibilities|What You'll Need|Technical Skills|Preferred \/ Nice To Have|Education & Experience|How We Work(?: \(core Competencies\))?|Responsibilities|Qualifications|Requirements|Minimum qualifications|Preferred qualifications|Skills)(?=\s+[A-Z(])/g,
                "\n\n$1\n"
              )
              .trim()
          }

          const first = (selectors: string[]): Element | null => {
            for (const selector of selectors) {
              const match = document.querySelector(selector)
              if (match) return match
            }
            return null
          }

          const visibleText = (selectors: string[]): string => {
            for (const selector of selectors) {
              for (const element of Array.from(document.querySelectorAll(selector))) {
                const rect = element.getBoundingClientRect()
                const text = textFrom(element)
                if (rect.width > 0 && rect.height > 0 && text) return text
              }
            }
            return ""
          }

          if (!window.location.href.includes("linkedin.com/jobs")) return null

          const title = visibleText([
            ".jobs-search__job-details--container h1",
            ".job-view-layout h1",
            ".jobs-details h1",
            ".jobs-unified-top-card h1",
            ".jobs-details__main-content h1",
            "h1.t-24.t-bold.inline",
            "h1.job-details-jobs-unified-top-card__job-title"
          ])

          const company = visibleText([
            ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name a",
            ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name",
            ".job-view-layout .job-details-jobs-unified-top-card__company-name a",
            ".job-view-layout .job-details-jobs-unified-top-card__company-name",
            ".jobs-unified-top-card__company-name a",
            ".jobs-unified-top-card__company-name"
          ])

          const descriptionContainer =
            first([
              ".jobs-search__job-details--container .jobs-description-content__text",
              ".jobs-search__job-details--container .jobs-box__html-content",
              ".jobs-search__job-details--container .jobs-description__content",
              ".job-view-layout .jobs-description-content__text",
              ".job-view-layout .jobs-box__html-content",
              ".job-view-layout .jobs-description__content",
              ".jobs-details .jobs-description-content__text",
              ".jobs-details .jobs-box__html-content",
              ".jobs-details .jobs-description__content"
            ]) ||
            first([
              ".jobs-search__job-details--container",
              ".job-view-layout",
              ".jobs-details__main-content",
              ".jobs-details"
            ])

          const description = formattedTextFrom(descriptionContainer)
          if (!title || !company || description.length < 80) return null

          return {
            title,
            company,
            description,
            url: window.location.href,
            scrapedAt: new Date().toISOString()
          }
        }
      })

      return (injection?.result as JobData | null) || null
    }

    const load = async () => {
      setLoadingJob(true)
      setError(null)

      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_LATEST_JOB_DATA"
        } as RuntimeMessage)
        setJob(response?.job || null)
      } catch {
        // Continue with direct tab scrape fallback.
      }

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        setLoadingJob(false)
        return
      }

      try {
        await chrome.tabs.sendMessage(activeTab.id, { type: "SCRAPE_JOB_PAGE" } as RuntimeMessage)
      } catch {
        if (activeTab.url?.includes("linkedin.com/jobs")) {
          const fallbackJob = await scrapeActiveTabDirectly(activeTab.id)
          if (fallbackJob) setJob(fallbackJob)
        }
      } finally {
        setLoadingJob(false)
      }
    }

    const listener = (message: RuntimeMessage) => {
      if (message.type === "JOB_DATA_UPDATED") {
        setJob(message.payload)
        setLoadingJob(false)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    load().catch(() => {
      setLoadingJob(false)
      setError("Could not load LinkedIn job details.")
    })

    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const fetchSavedJobs = async () => {
    setLoadingSavedJobs(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`, { headers: apiHeaders })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Could not load saved jobs")
      setSavedJobs(body.jobs || [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingSavedJobs(false)
    }
  }

  const saveJob = async () => {
    if (!job) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          description: job.description,
          source_url: job.url
        })
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "Failed to save job")
      await fetchSavedJobs()
      setShowSavedJobs(true)
    } catch (e) {
      setError((e as Error).message || "Failed to save job to dashboard.")
    } finally {
      setSaving(false)
    }
  }

  const openSavedJobs = async () => {
    setShowSavedJobs(true)
    await fetchSavedJobs()
  }

  const openJobOptimizer = async (targetJob: JobData) => {
    await chrome.storage.local.set({ interviewMintActiveJob: targetJob })
    await chrome.tabs.create({ url: chrome.runtime.getURL("tabs/optimizer.html") })
    window.close()
  }

  const openOptimizer = async () => {
    if (!job) return
    await openJobOptimizer(job)
  }

  const optimizeSavedJob = async (savedJob: SavedJob) => {
    await openJobOptimizer({
      title: savedJob.title,
      company: savedJob.company,
      description: savedJob.description,
      url: savedJob.source_url || "",
      scrapedAt: savedJob.updated_at || savedJob.created_at
    })
  }

  const openOptimizerModal = async () => {
    setShowOptimizer(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/resume`, { headers: apiHeaders })
      if (response.ok) {
        const body = await response.json()
        setResumeText(body?.base_resume || "")
      }
    } catch {
      // Empty resume is fine; user can paste/upload in the modal.
    }
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
    setError(null)

    try {
      await saveResume()
      const response = await fetch(`${API_BASE_URL}/api/optimize`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          job_description: job.description,
          base_resume: resumeText
        })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || "Failed to optimize resume")
      setResult(body as OptimizeResponse)
    } catch (e) {
      setError((e as Error).message || "Failed to optimize resume.")
    } finally {
      setOptimizing(false)
    }
  }

  const readResumeFile = async (file: File | undefined) => {
    if (!file) return
    setResumeText(await file.text())
  }

  return (
    <div className="plasmo-relative plasmo-w-[380px] plasmo-min-h-[560px] plasmo-overflow-hidden plasmo-bg-[#050505] plasmo-text-slate-100">
      <style>{`
        .glass-runner-btn {
          position: relative;
          overflow: hidden;
          transition: transform 220ms ease, box-shadow 220ms ease, background 220ms ease;
        }

        .glass-runner-btn::after {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35), rgba(255,255,255,0.08) 45%, transparent 72%);
          filter: blur(8px);
          opacity: 0;
          transition: opacity 220ms ease;
          pointer-events: none;
          z-index: 0;
        }

        .glass-runner-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          padding: 1.2px;
          border-radius: 9999px;
          background: linear-gradient(110deg, rgba(255,255,255,0.2), rgba(255,255,255,0.85), rgba(255,255,255,0.2));
          background-size: 220% 220%;
          animation: borderFlow 2.6s linear infinite;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .glass-runner-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255,255,255,0.24), inset 0 1px 0 rgba(255,255,255,0.35);
        }

        .glass-runner-btn:hover::after {
          opacity: 0.9;
        }

        @keyframes borderFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      <div className="plasmo-pointer-events-none plasmo-absolute plasmo-inset-0 plasmo-bg-gradient-to-br plasmo-from-black/58 plasmo-via-[#1f1f1f]/44 plasmo-to-[#2c2b2b]/54" />
      <div className="plasmo-pointer-events-none plasmo-absolute plasmo-inset-0 plasmo-bg-[linear-gradient(115deg,transparent_18%,rgba(170,176,186,0.12)_50%,transparent_82%)]" />
      <div className="plasmo-pointer-events-none plasmo-absolute plasmo--top-24 plasmo-right-[-72px] plasmo-h-56 plasmo-w-56 plasmo-rounded-full plasmo-bg-slate-300/10 plasmo-blur-3xl" />
      <div className="plasmo-pointer-events-none plasmo-absolute plasmo-bottom-[-90px] plasmo-left-[-70px] plasmo-h-56 plasmo-w-56 plasmo-rounded-full plasmo-bg-slate-400/10 plasmo-blur-3xl" />
      <div className="plasmo-relative plasmo-p-4">
        <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-3">
          <div>
            <p className="plasmo-text-xs plasmo-font-medium plasmo-uppercase plasmo-tracking-widest plasmo-text-slate-300">
              applyKaro
            </p>
            <h1 className="plasmo-mt-1.5 plasmo-text-[24px] plasmo-leading-[1.08] plasmo-font-semibold plasmo-text-slate-50">
              Job Optimizer
            </h1>
          </div>
          <button
            type="button"
            onClick={openSavedJobs}
            className="glass-runner-btn plasmo-whitespace-nowrap plasmo-rounded-full plasmo-border plasmo-border-white/30 plasmo-bg-[linear-gradient(140deg,rgba(140,146,156,0.3),rgba(97,104,114,0.24))] plasmo-px-5 plasmo-py-2 plasmo-text-[11px] plasmo-font-semibold plasmo-text-slate-100 plasmo-shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_18px_rgba(0,0,0,0.22)] plasmo-backdrop-blur-xl hover:plasmo-bg-[linear-gradient(140deg,rgba(162,168,178,0.36),rgba(114,122,132,0.3))]">
            View Saved Jobs
          </button>
        </div>

        <div className="plasmo-mt-4 plasmo-rounded-[30px] plasmo-border plasmo-border-white/28 plasmo-bg-[linear-gradient(140deg,rgba(112,118,128,0.24),rgba(50,52,58,0.2))] plasmo-p-4 plasmo-shadow-[0_14px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] plasmo-backdrop-blur-2xl">
          {loadingJob && <p className="plasmo-text-sm plasmo-text-slate-400">Loading job details...</p>}
          {!loadingJob && !job && (
            <p className="plasmo-text-sm plasmo-text-slate-400">
              Open a LinkedIn job page to extract title, company, and description.
            </p>
          )}
          {job && (
            <>
              <h2 className="plasmo-text-[18px] plasmo-leading-[1.2] plasmo-font-semibold plasmo-text-slate-50">{job.title}</h2>
              <p className="plasmo-mt-1.5 plasmo-text-[13px] plasmo-font-medium plasmo-text-slate-300">{job.company}</p>
              <p className="plasmo-mt-3 plasmo-text-[12px] plasmo-leading-[1.45] plasmo-text-slate-200">
                {shortDescription}
              </p>
            </>
          )}
        </div>

        <div className="plasmo-mt-4 plasmo-flex plasmo-gap-2.5">
          <button
            type="button"
            onClick={saveJob}
            disabled={!job || saving}
            className="glass-runner-btn plasmo-flex-1 plasmo-whitespace-nowrap plasmo-rounded-full plasmo-border plasmo-border-white/32 plasmo-bg-[linear-gradient(140deg,rgba(158,164,174,0.3),rgba(98,104,114,0.24))] plasmo-px-4 plasmo-py-2.5 plasmo-text-[12px] plasmo-font-semibold plasmo-text-slate-100 plasmo-shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_10px_24px_rgba(0,0,0,0.22)] hover:plasmo-bg-[linear-gradient(140deg,rgba(176,182,192,0.36),rgba(116,122,132,0.3))] disabled:plasmo-border-white/15 disabled:plasmo-bg-slate-700/80 disabled:plasmo-text-slate-400">
            {saving ? "Saving..." : "Save Job"}
          </button>
          <button
            type="button"
            onClick={openOptimizer}
            disabled={!job}
            className="glass-runner-btn plasmo-flex-1 plasmo-whitespace-nowrap plasmo-rounded-full plasmo-border plasmo-border-white/32 plasmo-bg-[linear-gradient(140deg,rgba(128,134,146,0.34),rgba(95,101,113,0.25))] plasmo-px-4 plasmo-py-2.5 plasmo-text-[12px] plasmo-font-semibold plasmo-text-slate-100 plasmo-shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_9px_18px_rgba(0,0,0,0.2)] plasmo-backdrop-blur-xl hover:plasmo-bg-[linear-gradient(140deg,rgba(151,157,169,0.42),rgba(114,121,133,0.3))] disabled:plasmo-border-white/15 disabled:plasmo-text-slate-500">
            Optimize Resume
          </button>
        </div>

        {error && <p className="plasmo-mt-3 plasmo-text-xs plasmo-text-rose-300">{error}</p>}
      </div>

      {showSavedJobs && (
        <div className="plasmo-absolute plasmo-inset-0 plasmo-z-10 plasmo-bg-slate-950/70 plasmo-p-5 plasmo-backdrop-blur-xl">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <h2 className="plasmo-text-lg plasmo-font-semibold">Saved Jobs</h2>
            <button
              type="button"
              onClick={() => setShowSavedJobs(false)}
              className="plasmo-rounded-xl plasmo-border plasmo-border-white/25 plasmo-bg-white/10 plasmo-px-3 plasmo-py-1 plasmo-text-xs plasmo-backdrop-blur-md">
              Close
            </button>
          </div>

          <div className="plasmo-mt-4 plasmo-max-h-[520px] plasmo-space-y-3 plasmo-overflow-y-auto">
            {loadingSavedJobs && <p className="plasmo-text-sm plasmo-text-slate-400">Loading saved jobs...</p>}
            {!loadingSavedJobs && savedJobs.length === 0 && (
              <p className="plasmo-text-sm plasmo-text-slate-400">No saved jobs yet.</p>
            )}
            {savedJobs.map((savedJob) => (
              <div
                key={savedJob.id}
                className="plasmo-rounded-xl plasmo-border plasmo-border-white/20 plasmo-bg-white/10 plasmo-p-4 plasmo-backdrop-blur-lg">
                <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-3">
                  <div>
                    <p className="plasmo-text-sm plasmo-font-semibold">{savedJob.title}</p>
                    <p className="plasmo-mt-1 plasmo-text-xs plasmo-text-slate-300">{savedJob.company}</p>
                  </div>
                  <div className="plasmo-flex plasmo-gap-2">
                    <button
                      type="button"
                      onClick={() => optimizeSavedJob(savedJob)}
                      className="plasmo-rounded-lg plasmo-border plasmo-border-white/25 plasmo-bg-white/10 plasmo-px-3 plasmo-py-1 plasmo-text-xs plasmo-font-semibold plasmo-text-slate-100 plasmo-backdrop-blur-md">
                      Optimize
                    </button>
                    <button
                      type="button"
                      onClick={() => savedJob.source_url && chrome.tabs.create({ url: savedJob.source_url })}
                      className="plasmo-rounded-lg plasmo-border plasmo-border-white/25 plasmo-bg-white/15 plasmo-px-3 plasmo-py-1 plasmo-text-xs plasmo-font-semibold plasmo-text-slate-100 hover:plasmo-bg-white/25">
                      Apply
                    </button>
                  </div>
                </div>

                <div className="plasmo-mt-3 plasmo-border-l plasmo-border-slate-700 plasmo-pl-3 plasmo-text-xs plasmo-text-slate-400">
                  <p>Saved {new Date(savedJob.created_at).toLocaleDateString()}</p>
                  <p>LinkedIn job page saved</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOptimizer && (
        <div className="plasmo-absolute plasmo-inset-0 plasmo-z-20 plasmo-bg-slate-950/70 plasmo-p-5 plasmo-backdrop-blur-xl">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <h2 className="plasmo-text-lg plasmo-font-semibold">Resume Optimizer</h2>
            <button
              type="button"
              onClick={() => setShowOptimizer(false)}
              className="plasmo-rounded-xl plasmo-border plasmo-border-white/25 plasmo-bg-white/10 plasmo-px-3 plasmo-py-1 plasmo-text-xs plasmo-backdrop-blur-md">
              Close
            </button>
          </div>

          <div className="plasmo-mt-4 plasmo-rounded-xl plasmo-border plasmo-border-white/20 plasmo-bg-white/10 plasmo-p-4 plasmo-backdrop-blur-lg">
            <p className="plasmo-text-sm plasmo-font-semibold">{job?.title}</p>
            <p className="plasmo-mt-1 plasmo-text-xs plasmo-text-slate-300">{job?.company}</p>
          </div>

          <label className="plasmo-mt-4 plasmo-block plasmo-text-xs plasmo-font-medium plasmo-text-slate-300">
            Base resume
          </label>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            className="plasmo-mt-2 plasmo-h-44 plasmo-w-full plasmo-resize-none plasmo-rounded-xl plasmo-border plasmo-border-white/20 plasmo-bg-slate-900/60 plasmo-p-3 plasmo-text-xs plasmo-leading-relaxed plasmo-text-slate-100 plasmo-outline-none plasmo-backdrop-blur-md"
            placeholder="Paste your resume here..."
          />

          <input
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(event) => readResumeFile(event.target.files?.[0])}
            className="plasmo-mt-3 plasmo-block plasmo-w-full plasmo-text-xs plasmo-text-slate-300 file:plasmo-mr-3 file:plasmo-rounded-lg file:plasmo-border-0 file:plasmo-bg-white/20 file:plasmo-px-3 file:plasmo-py-2 file:plasmo-text-slate-100"
          />

          <div className="plasmo-mt-4 plasmo-flex plasmo-gap-2">
            <button
              type="button"
              onClick={saveResume}
              disabled={savingResume || !resumeText.trim()}
              className="plasmo-flex-1 plasmo-rounded-xl plasmo-border plasmo-border-white/25 plasmo-bg-white/10 plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-font-semibold plasmo-backdrop-blur-md disabled:plasmo-text-slate-500">
              {savingResume ? "Saving..." : "Save Resume"}
            </button>
            <button
              type="button"
              onClick={optimizeResume}
              disabled={optimizing || !job || !resumeText.trim()}
              className="plasmo-flex-1 plasmo-rounded-xl plasmo-border plasmo-border-white/28 plasmo-bg-white/15 plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-font-semibold plasmo-text-slate-100 hover:plasmo-bg-white/25 disabled:plasmo-bg-slate-700 disabled:plasmo-text-slate-400">
              {optimizing ? "Optimizing..." : "Run ATS"}
            </button>
          </div>

          {result && (
            <div className="plasmo-mt-4 plasmo-rounded-xl plasmo-border plasmo-border-white/20 plasmo-bg-white/10 plasmo-p-4 plasmo-backdrop-blur-lg">
              <p className="plasmo-text-sm plasmo-font-semibold">
                ATS Score: <span className="plasmo-text-slate-200">{result.ats_score_out_of_100}/100</span>
              </p>
              <p className="plasmo-mt-3 plasmo-text-xs plasmo-leading-relaxed plasmo-text-slate-300">
                Missing Keywords: {result.missing_keywords.join(", ") || "None"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default IndexPopup
