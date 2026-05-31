import "~style.css"

import { useEffect, useMemo, useState } from "react"

import LightRays from "~components/LightRays"
import { extractJob, genericExtractor } from "~lib/extraction"
import type { JobData, RuntimeMessage } from "~lib/types"

type SavedJob = {
  id: string
  title: string
  company: string
  location?: string
  workplace?: string
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

const LOCAL_USER_ID_KEY = "interviewMintLocalUserId"
const SAVED_JOB_META_KEY = "interviewMintSavedJobMeta"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")

const deriveDeterministicUuid = async (seed: string): Promise<string> => {
  const input = new TextEncoder().encode(seed)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input))
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const getApiHeaders = (userId: string) => {
  return {
    "Content-Type": "application/json",
    "x-user-id": userId
  }
}

const inferWorkplace = (text: string) => {
  if (/\bremote\b/i.test(text)) return "Remote"
  if (/\bhybrid\b/i.test(text)) return "Hybrid"
  if (/\bon[-\s]?site\b/i.test(text)) return "On-site"
  return ""
}

const getExpiryLabel = (createdAt: string) => {
  const expiresAt = new Date(new Date(createdAt).getTime() + 3 * 24 * 60 * 60 * 1000)
  const diffMs = expiresAt.getTime() - Date.now()

  if (diffMs <= 0) return "Auto-removes soon"

  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000))
  if (diffHours < 24) return `Auto-removes in ${diffHours}h`

  return `Auto-removes in ${Math.ceil(diffHours / 24)}d`
}

const getPreviewText = (text: string, maxLength = 150) => {
  const cleaned = text.replace(/\s+/g, " ").trim()
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength).trim()}...` : cleaned
}

const isHttpUrl = (url?: string) => Boolean(url && /^https?:\/\//i.test(url))
const isLinkedinUrl = (url?: string) => Boolean(url && /https?:\/\/(?:www\.)?linkedin\.com\//i.test(url))
const isLinkedinJobsUrl = (url?: string) => Boolean(url && /https?:\/\/(?:www\.)?linkedin\.com\/jobs/i.test(url))

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
  const [jobUrl, setJobUrl] = useState("")
  const [importingUrl, setImportingUrl] = useState(false)
  const [selectorMode, setSelectorMode] = useState(false)
  const [activeTabUrl, setActiveTabUrl] = useState("")
  const [activeUserId, setActiveUserId] = useState(DEMO_USER_ID)
  const [activeUserLabel, setActiveUserLabel] = useState("Chrome profile")

  const apiHeaders = useMemo(() => getApiHeaders(activeUserId), [activeUserId])
  const isLinkedinPage = isLinkedinUrl(activeTabUrl)
  const isLinkedinJobPage = isLinkedinJobsUrl(activeTabUrl)
  const showUniversalTools = isHttpUrl(activeTabUrl) && !isLinkedinPage

  const shortDescription = useMemo(() => {
    if (!job?.description) return ""
    return job.description.length > 220 ? `${job.description.slice(0, 220)}...` : job.description
  }, [job])

  useEffect(() => {
    const getOrCreateLocalUserId = async (): Promise<string> => {
      const stored = await chrome.storage.local.get([LOCAL_USER_ID_KEY])
      const existing = String(stored?.[LOCAL_USER_ID_KEY] || "").trim()
      if (UUID_PATTERN.test(existing)) return existing

      const generated = crypto.randomUUID()
      await chrome.storage.local.set({ [LOCAL_USER_ID_KEY]: generated })
      return generated
    }

    const loadIdentity = async () => {
      try {
        const profile = await new Promise<chrome.identity.ProfileUserInfo>((resolve, reject) => {
          chrome.identity.getProfileUserInfo((info) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
              return
            }
            resolve(info)
          })
        })

        const profileId = String(profile?.id || "").trim()
        const profileEmail = String(profile?.email || "").trim()

        if (profileId) {
          const seed = profileEmail ? `email:${profileEmail}` : `profile:${profileId}`
          const profileUuid = await deriveDeterministicUuid(seed)
          setActiveUserId(profileUuid)
          setActiveUserLabel(profileEmail || "Chrome profile")
          return
        }
      } catch {
        // Fallback to local stable ID when Chrome profile is unavailable.
      }

      const localUserId = await getOrCreateLocalUserId()
      setActiveUserId(localUserId)
      setActiveUserLabel("Local profile")
    }

    loadIdentity().catch(() => {
      setActiveUserId(DEMO_USER_ID)
      setActiveUserLabel("Chrome profile")
    })
  }, [])

  const scrapeLinkedinTabDirectly = async (tabId: number): Promise<JobData | null> => {
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

        const parseLocationAndWorkplace = (text: string) => {
          const cleaned = text.replace(/\s+/g, " ").trim()
          const workplaceMatch = cleaned.match(/\b(remote|hybrid|on-site|onsite)\b/i)
          const workplace = workplaceMatch
            ? workplaceMatch[1].replace(/^onsite$/i, "On-site").replace(/^on-site$/i, "On-site")
            : ""

          const location = cleaned
            .replace(/\b(remote|hybrid|on-site|onsite)\b/gi, "")
            .replace(/\b(full-time|part-time|contract|internship|temporary|volunteer)\b/gi, "")
            .replace(/\b\d+\s*(applicants?|reposts?)\b/gi, "")
            .replace(/\bpromoted\b/gi, "")
            .replace(/\s*[·|]\s*/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()

          return { location, workplace }
        }

        const inferWorkplace = (text: string) => {
          if (/\bremote\b/i.test(text)) return "Remote"
          if (/\bhybrid\b/i.test(text)) return "Hybrid"
          if (/\bon[-\s]?site\b/i.test(text)) return "On-site"
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
          "h1.job-details-jobs-unified-top-card__job-title",
          "h1[data-test-id='job-details-jobs-unified-top-card__job-title']"
        ])

        const company = visibleText([
          ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name a",
          ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name",
          ".job-view-layout .job-details-jobs-unified-top-card__company-name a",
          ".job-view-layout .job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name a",
          ".jobs-unified-top-card__company-name",
          "a.topcard__org-name-link"
        ])

        const detailsText = visibleText([
          ".jobs-search__job-details--container .job-details-jobs-unified-top-card__primary-description-container",
          ".job-view-layout .job-details-jobs-unified-top-card__primary-description-container",
          ".jobs-unified-top-card__primary-description",
          ".jobs-unified-top-card__bullet",
          ".job-details-jobs-unified-top-card__tertiary-description-container",
          ".topcard__flavor-row"
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
            ".jobs-details .jobs-description__content",
            "[data-test-id='job-details-description']"
          ]) ||
          first([
            ".jobs-search__job-details--container",
            ".job-view-layout",
            ".jobs-details__main-content",
            ".jobs-details"
          ])

        const description = formattedTextFrom(descriptionContainer)
        const parsedDetails = parseLocationAndWorkplace(detailsText)
        const workplace = parsedDetails.workplace || inferWorkplace(`${detailsText}\n${description}`)
        if (!title || !company || description.length < 80) return null

        return {
          title,
          company,
          location: parsedDetails.location,
          workplace,
          description,
          url: window.location.href,
          source: "linkedin",
          extractionMethod: "linkedin",
          scrapedAt: new Date().toISOString()
        }
      }
    })

    return (injection?.result as JobData | null) || null
  }

  const normalizeJobUrl = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) throw new Error("Paste a job URL first.")
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP or HTTPS job URLs are supported.")
    return url.toString()
  }

  const fetchJobFromUrl = async (value: string) => {
    const normalizedUrl = normalizeJobUrl(value)
    const response = await fetch(normalizedUrl, { credentials: "omit" })
    if (!response.ok) throw new Error(`Could not fetch this URL (${response.status}).`)

    const html = await response.text()
    const documentRef = new DOMParser().parseFromString(html, "text/html")
    const importedJob = extractJob(
      { document: documentRef, url: normalizedUrl, source: "url-import" },
      [genericExtractor]
    )

    if (!importedJob) {
      throw new Error("Fetched the page, but could not find a job description. Try Selector Mode.")
    }

    return importedJob
  }

  const publishImportedJob = async (importedJob: JobData) => {
    setJob(importedJob)
    await chrome.runtime.sendMessage({ type: "JOB_DATA_UPDATED", payload: importedJob } as RuntimeMessage)
  }

  const loadLinkedinJob = async (tabId: number) => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_JOB_PAGE" } as RuntimeMessage)
      return
    } catch {
      const fallbackJob = await scrapeLinkedinTabDirectly(tabId)
      if (fallbackJob) {
        await publishImportedJob(fallbackJob)
        return
      }
      throw new Error("Could not load LinkedIn job details.")
    }
  }

  const loadNonLinkedinJob = async (url: string) => {
    setImportingUrl(true)
    try {
      const importedJob = await fetchJobFromUrl(url)
      await publishImportedJob(importedJob)
    } finally {
      setImportingUrl(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoadingJob(true)
      setError(null)

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeUrl = activeTab?.url || ""
      setActiveTabUrl(activeUrl)

      if (isHttpUrl(activeUrl) && !isLinkedinUrl(activeUrl)) {
        setJobUrl(activeUrl)
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_LATEST_JOB_DATA"
        } as RuntimeMessage)
        const latestJob = response?.job as JobData | null | undefined
        if (latestJob?.url === activeUrl) setJob(latestJob)
      } catch {
        // Continue with direct tab scrape or URL import fallback.
      }

      if (!activeTab?.id || !isHttpUrl(activeUrl)) {
        setLoadingJob(false)
        return
      }

      try {
        if (isLinkedinJobsUrl(activeUrl)) {
          await loadLinkedinJob(activeTab.id)
        } else if (isLinkedinUrl(activeUrl)) {
          setJob(null)
        } else {
          await loadNonLinkedinJob(activeUrl)
        }
      } catch (e) {
        setError((e as Error).message || "Could not detect this page yet. Try Paste Job URL or Selector Mode.")
      } finally {
        setLoadingJob(false)
      }
    }

    const listener = (message: RuntimeMessage) => {
      if (message.type === "JOB_DATA_UPDATED") {
        setJob(message.payload)
        setSelectorMode(false)
        setLoadingJob(false)
      }
      if (message.type === "SELECTOR_MODE_CANCELLED") {
        setSelectorMode(false)
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    load().catch(() => {
      setLoadingJob(false)
      setError("Could not load job details.")
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
      const storedMeta = await chrome.storage.local.get(SAVED_JOB_META_KEY)
      const metaByUrl = (storedMeta?.[SAVED_JOB_META_KEY] || {}) as Record<
        string,
        Pick<JobData, "location" | "workplace">
      >
      const jobs = ((body.jobs || []) as SavedJob[]).map((savedJob) => {
        const cached = savedJob.source_url ? metaByUrl[savedJob.source_url] : undefined
        return {
          ...savedJob,
          location: savedJob.location || cached?.location,
          workplace: savedJob.workplace || cached?.workplace || inferWorkplace(savedJob.description)
        }
      })
      setSavedJobs(jobs)
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
          location: job.location,
          workplace: job.workplace,
          description: job.description,
          source_url: job.url
        })
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || "Failed to save job")
      const storedMeta = await chrome.storage.local.get(SAVED_JOB_META_KEY)
      const metaByUrl = (storedMeta?.[SAVED_JOB_META_KEY] || {}) as Record<
        string,
        Pick<JobData, "location" | "workplace">
      >
      await chrome.storage.local.set({
        [SAVED_JOB_META_KEY]: {
          ...metaByUrl,
          [job.url]: {
            location: job.location,
            workplace: job.workplace
          }
        }
      })
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

  const detectActiveJob = async () => {
    setLoadingJob(true)
    setError(null)

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeUrl = activeTab?.url || ""
      setActiveTabUrl(activeUrl)
      if (!activeTab?.id || !isHttpUrl(activeUrl)) throw new Error("Open a job page first.")

      if (isLinkedinJobsUrl(activeUrl)) {
        await loadLinkedinJob(activeTab.id)
      } else if (isLinkedinUrl(activeUrl)) {
        throw new Error("Open a LinkedIn job page to auto extract the job description.")
      } else {
        setJobUrl(activeUrl)
        await loadNonLinkedinJob(activeUrl)
      }
    } catch (e) {
      setError((e as Error).message || "Could not detect this page. Try Paste Job URL or Selector Mode.")
    } finally {
      setLoadingJob(false)
    }
  }

  const importJobUrl = async () => {
    setImportingUrl(true)
    setError(null)

    try {
      const importedJob = await fetchJobFromUrl(jobUrl)
      await publishImportedJob(importedJob)
    } catch (e) {
      setError((e as Error).message || "Could not import this job URL.")
    } finally {
      setImportingUrl(false)
    }
  }

  const startSelectorMode = async () => {
    setError(null)
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.id) {
      setError("Open the job page first, then start Selector Mode.")
      return
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: "START_SELECTOR_MODE" } as RuntimeMessage)
      setSelectorMode(true)
      window.close()
    } catch {
      setError("Selector Mode could not start on this page. Refresh the page and try again.")
    }
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
    <div className="ak-bg ak-popup-bg plasmo-relative plasmo-w-[380px] plasmo-min-h-[580px] plasmo-overflow-hidden plasmo-text-sky-50">
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
      <div
        style={{ position: "relative", zIndex: 1 }}
        className={showSavedJobs ? "plasmo-hidden" : "plasmo-px-4 plasmo-pb-4 plasmo-pt-8"}>
        <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-3">
          <div>
            <p className="plasmo-text-xs plasmo-font-medium plasmo-text-sky-50/90">
              applyKaro
            </p>
            <h1 className="plasmo-mt-1.5 plasmo-text-[25px] plasmo-leading-[1.08] plasmo-font-semibold plasmo-text-white">
              Career Console
            </h1>
            <p className="ak-card-soft plasmo-mt-2 plasmo-inline-flex plasmo-max-w-[190px] plasmo-items-center plasmo-rounded-md plasmo-px-2.5 plasmo-py-1 plasmo-text-[10px] plasmo-font-medium plasmo-text-sky-100">
              {activeUserLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={openSavedJobs}
            className="ak-button ak-button-secondary plasmo-relative plasmo-overflow-hidden plasmo-rounded-md plasmo-whitespace-nowrap plasmo-px-4 plasmo-py-2 plasmo-text-[11px] plasmo-font-semibold">
            View Saved Jobs
          </button>
        </div>

        <div className="ak-card-soft plasmo-mt-4 plasmo-rounded-lg plasmo-p-4">
          {loadingJob && <p className="plasmo-text-sm plasmo-text-sky-100/70">Loading job details...</p>}
          {!loadingJob && !job && (
            <p className="plasmo-text-sm plasmo-text-sky-100/70">
              {isLinkedinPage
                ? "Open a LinkedIn job page to auto fetch title, company, and job description."
                : "For non-LinkedIn job sites, paste a job URL or use Selector Mode."}
            </p>
          )}
          {job && (
            <>
              <h2 className="plasmo-text-[18px] plasmo-leading-[1.2] plasmo-font-semibold plasmo-text-white">{job.title}</h2>
              <p className="plasmo-mt-1.5 plasmo-text-[13px] plasmo-font-medium plasmo-text-sky-100/80">{job.company}</p>
              {(job.location || job.workplace) && (
                <p className="plasmo-mt-1 plasmo-text-[11px] plasmo-font-medium plasmo-text-sky-200/70">
                  {[job.location, job.workplace].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="plasmo-mt-3 plasmo-text-[12px] plasmo-leading-[1.45] plasmo-text-sky-50/78">
                {shortDescription}
              </p>
            </>
          )}
        </div>

        {showUniversalTools && (
          <div className="ak-card-soft plasmo-mt-4 plasmo-rounded-lg plasmo-p-3">
            <label className="plasmo-block plasmo-text-[11px] plasmo-font-semibold plasmo-text-sky-100/75">
              Paste Job URL
            </label>
            <div className="plasmo-mt-2 plasmo-flex plasmo-gap-2">
              <input
                type="url"
                value={jobUrl}
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="https://company.com/jobs/role"
                className="ak-input plasmo-min-w-0 plasmo-flex-1 plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-xs plasmo-outline-none"
              />
              <button
                type="button"
                onClick={importJobUrl}
                disabled={importingUrl}
                className="ak-button plasmo-relative plasmo-overflow-hidden plasmo-rounded-md plasmo-px-3 plasmo-py-2 plasmo-text-[11px] plasmo-font-semibold">
                {importingUrl ? "Fetch..." : "Fetch"}
              </button>
            </div>
          </div>
        )}

        {showUniversalTools && (
          <div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-2.5">
            <button
              type="button"
              onClick={detectActiveJob}
              disabled={loadingJob}
              className="ak-button ak-button-secondary plasmo-relative plasmo-flex-1 plasmo-overflow-hidden plasmo-rounded-md plasmo-whitespace-nowrap plasmo-px-4 plasmo-py-2.5 plasmo-text-[12px] plasmo-font-semibold">
              {loadingJob ? "Detecting..." : "Detect Job"}
            </button>
            <button
              type="button"
              onClick={startSelectorMode}
              disabled={selectorMode}
              className="ak-button ak-button-secondary plasmo-relative plasmo-flex-1 plasmo-overflow-hidden plasmo-rounded-md plasmo-whitespace-nowrap plasmo-px-4 plasmo-py-2.5 plasmo-text-[12px] plasmo-font-semibold">
              {selectorMode ? "Selecting..." : "Selector Mode"}
            </button>
          </div>
        )}

        <div className="plasmo-mt-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-2.5">
          <button
            type="button"
            onClick={saveJob}
            disabled={!job || saving}
            className="ak-button ak-button-secondary plasmo-relative plasmo-flex-1 plasmo-overflow-hidden plasmo-rounded-md plasmo-whitespace-nowrap plasmo-px-4 plasmo-py-2.5 plasmo-text-[12px] plasmo-font-semibold">
            {saving ? "Saving..." : isLinkedinPage ? "Save Job" : "Analyze"}
          </button>
          <button
            type="button"
            onClick={openOptimizer}
            disabled={!job}
            className="ak-button plasmo-relative plasmo-flex-1 plasmo-overflow-hidden plasmo-rounded-md plasmo-whitespace-nowrap plasmo-px-4 plasmo-py-2.5 plasmo-text-[12px] plasmo-font-semibold">
            Open Dashboard
          </button>
        </div>

        {error && <p className="plasmo-mt-3 plasmo-text-xs plasmo-text-rose-300">{error}</p>}
      </div>

      {showSavedJobs && (
        <div style={{ position: "relative", zIndex: 1 }} className="plasmo-px-4 plasmo-pb-4 plasmo-pt-8">
          <div className="plasmo-relative plasmo-z-10 plasmo-flex plasmo-items-center plasmo-justify-between">
            <h2 className="plasmo-text-[18px] plasmo-font-semibold plasmo-text-white">Saved Jobs</h2>
            <button
              type="button"
              onClick={() => setShowSavedJobs(false)}
              className="ak-button ak-button-secondary plasmo-rounded-md plasmo-px-3 plasmo-py-1.5 plasmo-text-[11px] plasmo-font-semibold">
              Close
            </button>
          </div>

          <div className="plasmo-mt-4 plasmo-max-h-[500px] plasmo-space-y-3 plasmo-overflow-y-auto plasmo-pr-1">
            {loadingSavedJobs && <p className="plasmo-text-sm plasmo-text-sky-100/70">Loading saved jobs...</p>}
            {!loadingSavedJobs && savedJobs.length === 0 && (
              <p className="plasmo-text-sm plasmo-text-sky-100/70">No saved jobs yet.</p>
            )}
            {savedJobs.map((savedJob) => (
              <div
                key={savedJob.id}
                className="ak-card-soft plasmo-rounded-lg plasmo-p-3">
                <div className="plasmo-flex plasmo-items-start plasmo-justify-between plasmo-gap-2">
                  <div className="plasmo-min-w-0 plasmo-flex-1">
                    <p className="plasmo-text-sm plasmo-font-semibold plasmo-text-white">{savedJob.title}</p>
                    <p className="plasmo-mt-1 plasmo-text-xs plasmo-text-sky-100/75">{savedJob.company}</p>
                    {(savedJob.location || savedJob.workplace) && (
                      <p className="plasmo-mt-1 plasmo-text-[11px] plasmo-font-medium plasmo-text-sky-200/65">
                        {[savedJob.location, savedJob.workplace].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="plasmo-flex plasmo-shrink-0 plasmo-gap-1.5">
                    <button
                      type="button"
                      onClick={() => optimizeSavedJob(savedJob)}
                      className="ak-button plasmo-relative plasmo-overflow-hidden plasmo-rounded-md plasmo-px-2.5 plasmo-py-1 plasmo-text-[11px] plasmo-font-semibold">
                      Optimize
                    </button>
                    <button
                      type="button"
                      onClick={() => savedJob.source_url && chrome.tabs.create({ url: savedJob.source_url })}
                      className="ak-button ak-button-secondary plasmo-relative plasmo-overflow-hidden plasmo-rounded-md plasmo-px-2.5 plasmo-py-1 plasmo-text-[11px] plasmo-font-semibold">
                      Apply
                    </button>
                  </div>
                </div>

                {savedJob.description && (
                  <p className="plasmo-mt-3 plasmo-text-[11px] plasmo-leading-5 plasmo-text-sky-50/72">
                    {getPreviewText(savedJob.description)}
                  </p>
                )}

                <div className="plasmo-mt-3 plasmo-border-l-2 plasmo-border-cyan-300/35 plasmo-pl-3 plasmo-text-xs plasmo-leading-5 plasmo-text-sky-100/65">
                  <p>Saved {new Date(savedJob.created_at).toLocaleDateString()}</p>
                  <p>{getExpiryLabel(savedJob.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOptimizer && (
        <div className="ak-bg ak-popup-bg plasmo-absolute plasmo-inset-0 plasmo-z-20 plasmo-p-5">
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
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-white">Resume Optimizer</h2>
            <button
              type="button"
              onClick={() => setShowOptimizer(false)}
              className="ak-button ak-button-secondary plasmo-rounded-md plasmo-px-3 plasmo-py-1.5 plasmo-text-xs plasmo-font-semibold">
              Close
            </button>
          </div>

          <div className="ak-card-soft plasmo-relative plasmo-z-10 plasmo-mt-4 plasmo-rounded-lg plasmo-p-4">
            <p className="plasmo-text-sm plasmo-font-semibold plasmo-text-white">{job?.title}</p>
            <p className="plasmo-mt-1 plasmo-text-xs plasmo-text-sky-100/70">{job?.company}</p>
          </div>

          <label className="plasmo-relative plasmo-z-10 plasmo-mt-4 plasmo-block plasmo-text-xs plasmo-font-medium plasmo-text-sky-100/75">
            Base resume
          </label>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            className="ak-input plasmo-relative plasmo-z-10 plasmo-mt-2 plasmo-h-44 plasmo-w-full plasmo-resize-none plasmo-rounded-lg plasmo-p-3 plasmo-text-xs plasmo-leading-relaxed plasmo-outline-none"
            placeholder="Paste your resume here..."
          />

          <input
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(event) => readResumeFile(event.target.files?.[0])}
            className="plasmo-relative plasmo-z-10 plasmo-mt-3 plasmo-block plasmo-w-full plasmo-text-xs plasmo-text-sky-100/75 file:plasmo-mr-3 file:plasmo-rounded-md file:plasmo-border file:plasmo-border-cyan-200/30 file:plasmo-bg-sky-500/25 file:plasmo-px-3 file:plasmo-py-2 file:plasmo-text-sky-50"
          />

          <div className="plasmo-relative plasmo-z-10 plasmo-mt-4 plasmo-flex plasmo-gap-2">
            <button
              type="button"
              onClick={saveResume}
              disabled={savingResume || !resumeText.trim()}
              className="ak-button ak-button-secondary plasmo-relative plasmo-flex-1 plasmo-overflow-hidden plasmo-rounded-md plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-font-semibold">
              {savingResume ? "Saving..." : "Save Resume"}
            </button>
            <button
              type="button"
              onClick={optimizeResume}
              disabled={optimizing || !job || !resumeText.trim()}
              className="ak-button plasmo-relative plasmo-flex-1 plasmo-overflow-hidden plasmo-rounded-md plasmo-px-3 plasmo-py-3 plasmo-text-sm plasmo-font-semibold">
              {optimizing ? "Optimizing..." : "Run ATS"}
            </button>
          </div>

          {result && (
            <div className="ak-card-soft plasmo-relative plasmo-z-10 plasmo-mt-4 plasmo-rounded-lg plasmo-p-4">
              <p className="plasmo-text-sm plasmo-font-semibold plasmo-text-white">
                ATS Score: <span className="plasmo-text-cyan-200">{result.ats_score_out_of_100}/100</span>
              </p>
              <p className="plasmo-mt-3 plasmo-text-xs plasmo-leading-relaxed plasmo-text-sky-100/70">
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
