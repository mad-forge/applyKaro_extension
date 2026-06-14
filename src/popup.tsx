import "~style.css"

import { useEffect, useMemo, useState } from "react"

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
const isLinkedinUrl = (url?: string) => {
  try {
    const hostname = new URL(url || "").hostname.toLowerCase()
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
  } catch {
    return false
  }
}
const isLinkedinJobsUrl = (url?: string) => {
  try {
    const parsed = new URL(url || "")
    return isLinkedinUrl(url) && /^\/jobs(?:\/|$)/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

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
        const profile = await new Promise<chrome.identity.UserInfo>((resolve, reject) => {
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

        const findLinkedinDescription = (): Element | null => {
          const heading = Array.from(document.querySelectorAll("h1, h2, h3, h4, div, span")).find(
            (element) => textFrom(element).toLowerCase() === "about the job"
          )

          if (!heading) return null

          let container: Element | null = heading.parentElement
          while (container && container !== document.body) {
            const text = formattedTextFrom(container)
            if (text.length >= 200 && text.length <= 30000) return container
            container = container.parentElement
          }

          return null
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
          ".jobs-search__job-details--wrapper h1",
          ".scaffold-layout__detail h1",
          ".job-view-layout h1",
          ".jobs-details h1",
          ".jobs-unified-top-card h1",
          ".jobs-details__main-content h1",
          "h1.t-24.t-bold.inline",
          "h1.job-details-jobs-unified-top-card__job-title",
          ".job-details-jobs-unified-top-card__job-title h1",
          ".job-details-jobs-unified-top-card__job-title",
          "h1[data-test-id='job-details-jobs-unified-top-card__job-title']"
        ])

        const company = visibleText([
          ".jobs-search__job-details--wrapper a[href*='/company/']",
          ".scaffold-layout__detail a[href*='/company/']",
          ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name a",
          ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name",
          ".job-view-layout .job-details-jobs-unified-top-card__company-name a",
          ".job-view-layout .job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name a",
          ".jobs-unified-top-card__company-name",
          "a.topcard__org-name-link"
        ])

        const detailsText = visibleText([
          ".jobs-search__job-details--wrapper .job-details-jobs-unified-top-card__primary-description-container",
          ".scaffold-layout__detail .job-details-jobs-unified-top-card__primary-description-container",
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
            ".jobs-description-content__text--stretch",
            ".jobs-description__container",
            ".jobs-description",
            "#job-details",
            "[data-test-id='job-details-description']"
          ]) ||
          findLinkedinDescription() ||
          first([
            ".jobs-search__job-details--wrapper",
            ".scaffold-layout__detail",
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "SCRAPE_JOB_PAGE"
        } as RuntimeMessage)
        const detectedJob = response?.job as JobData | null | undefined
        if (detectedJob) {
          setJob(detectedJob)
          return
        }
      } catch {
        // The content script may not exist yet on tabs opened before the extension was loaded.
      }

      const fallbackJob = await scrapeLinkedinTabDirectly(tabId).catch(() => null)
      if (fallbackJob) {
        await publishImportedJob(fallbackJob)
        return
      }

      if (attempt < 2) await wait(700)
    }

    throw new Error("Could not load LinkedIn job details. Refresh the job page and try again.")
  }

  const loadNonLinkedinJob = async (tabId: number, url: string) => {
    setImportingUrl(true)
    try {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "SCRAPE_JOB_PAGE"
        } as RuntimeMessage)
        const detectedJob = response?.job as JobData | null | undefined
        if (detectedJob) {
          setJob(detectedJob)
          return
        }
      } catch {
        // Fall back to importing the URL for tabs that predate this extension load.
      }

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
          await loadNonLinkedinJob(activeTab.id, activeUrl)
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
        await loadNonLinkedinJob(activeTab.id, activeUrl)
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
    setResumeText("")
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

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${API_BASE_URL}/api/parse-resume`, {
        method: "POST",
        body: formData
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error || "Could not read PDF resume")
        return
      }
      setResumeText(body?.text || "")
      return
    }

    setResumeText(await file.text())
  }

  return (
    <div className="ak-popup-v2">
      {!showSavedJobs && (
        <div className="ak-popup-screen">
          <header className="ak-popup-header-v2">
            <div>
              <p className="ak-popup-kicker">ApplyKro</p>
              <h1>Career Console</h1>
              <span>{activeUserLabel}</span>
            </div>
            <button type="button" onClick={openSavedJobs} className="ak-popup-button ak-popup-button-secondary">
              Saved
            </button>
          </header>

          <section className={job ? "ak-popup-job-card ak-popup-job-ready" : "ak-popup-job-card"}>
            {loadingJob && <p className="ak-popup-muted">Loading job details...</p>}
            {!loadingJob && !job && (
              <p className="ak-popup-muted">
                {isLinkedinPage
                  ? "Open a LinkedIn job page to auto fetch title, company, and job description."
                  : "Paste a job URL or use Selector Mode to capture this role."}
              </p>
            )}
            {job && (
              <>
                <span className="ak-popup-status">Detected job</span>
                <h2>{job.title}</h2>
                <p className="ak-popup-company">{job.company}</p>
                {(job.location || job.workplace) && (
                  <p className="ak-popup-meta">{[job.location, job.workplace].filter(Boolean).join(" · ")}</p>
                )}
                <p className="ak-popup-desc">{shortDescription}</p>
              </>
            )}
          </section>

          {showUniversalTools && (
            <section className="ak-popup-card">
              <label>Paste Job URL</label>
              <div className="ak-popup-inline-form">
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(event) => setJobUrl(event.target.value)}
                  placeholder="https://company.com/jobs/role"
                  className="ak-popup-input"
                />
                <button
                  type="button"
                  onClick={importJobUrl}
                  disabled={importingUrl}
                  className="ak-popup-button ak-popup-button-primary">
                  {importingUrl ? "Fetch..." : "Fetch"}
                </button>
              </div>
            </section>
          )}

          {showUniversalTools && (
            <div className="ak-popup-grid">
              <button
                type="button"
                onClick={detectActiveJob}
                disabled={loadingJob}
                className="ak-popup-button ak-popup-button-secondary">
                {loadingJob ? "Detecting..." : "Detect Job"}
              </button>
              <button
                type="button"
                onClick={startSelectorMode}
                disabled={selectorMode}
                className="ak-popup-button ak-popup-button-secondary">
                {selectorMode ? "Selecting..." : "Selector Mode"}
              </button>
            </div>
          )}

          <div className="ak-popup-grid ak-popup-main-actions">
            <button
              type="button"
              onClick={saveJob}
              disabled={!job || saving}
              className="ak-popup-button ak-popup-button-secondary">
              {saving ? "Saving..." : isLinkedinPage ? "Save Job" : "Analyze"}
            </button>
            <button
              type="button"
              onClick={openOptimizer}
              disabled={!job}
              className="ak-popup-button ak-popup-button-primary">
              Optimize Resume
            </button>
          </div>

          {error && <p className="ak-popup-error">{error}</p>}
        </div>
      )}

      {showSavedJobs && (
        <div className="ak-popup-screen">
          <header className="ak-popup-header-v2 ak-popup-subheader">
            <div>
              <p className="ak-popup-kicker">Job tracker</p>
              <h1>Saved Jobs</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowSavedJobs(false)}
              className="ak-popup-button ak-popup-button-secondary">
              Close
            </button>
          </header>

          <div className="ak-saved-list">
            {loadingSavedJobs && <p className="ak-popup-muted">Loading saved jobs...</p>}
            {!loadingSavedJobs && savedJobs.length === 0 && (
              <p className="ak-popup-muted">No saved jobs yet.</p>
            )}
            {savedJobs.map((savedJob) => (
              <article key={savedJob.id} className="ak-saved-job-card">
                <div className="ak-saved-job-top">
                  <div>
                    <h2>{savedJob.title}</h2>
                    <p>{savedJob.company}</p>
                    {(savedJob.location || savedJob.workplace) && (
                      <span>{[savedJob.location, savedJob.workplace].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                  <div className="ak-saved-actions">
                    <button
                      type="button"
                      onClick={() => optimizeSavedJob(savedJob)}
                      className="ak-popup-button ak-popup-button-primary">
                      Optimize
                    </button>
                    <button
                      type="button"
                      onClick={() => savedJob.source_url && chrome.tabs.create({ url: savedJob.source_url })}
                      className="ak-popup-button ak-popup-button-secondary">
                      Apply
                    </button>
                  </div>
                </div>

                {savedJob.description && <p className="ak-saved-desc">{getPreviewText(savedJob.description)}</p>}

                <div className="ak-saved-meta">
                  <p>Saved {new Date(savedJob.created_at).toLocaleDateString()}</p>
                  <p>{getExpiryLabel(savedJob.created_at)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {showOptimizer && (
        <div className="ak-popup-overlay">
          <header className="ak-popup-header-v2 ak-popup-subheader">
            <div>
              <p className="ak-popup-kicker">ATS check</p>
              <h1>Resume Optimizer</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowOptimizer(false)}
              className="ak-popup-button ak-popup-button-secondary">
              Close
            </button>
          </header>

          <section className="ak-popup-job-card ak-popup-job-ready">
            <span className="ak-popup-status">Current role</span>
            <h2>{job?.title}</h2>
            <p className="ak-popup-company">{job?.company}</p>
          </section>

          <label className="ak-popup-field-label">Base resume</label>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            className="ak-popup-input ak-popup-resume-box"
            placeholder="Paste your resume here..."
          />

          <label className="ak-popup-file">
            <input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(event) => readResumeFile(event.target.files?.[0])}
            />
            Upload resume file
          </label>

          <div className="ak-popup-grid ak-popup-main-actions">
            <button
              type="button"
              onClick={saveResume}
              disabled={savingResume || !resumeText.trim()}
              className="ak-popup-button ak-popup-button-secondary">
              {savingResume ? "Saving..." : "Save Resume"}
            </button>
            <button
              type="button"
              onClick={optimizeResume}
              disabled={optimizing || !job || !resumeText.trim()}
              className="ak-popup-button ak-popup-button-primary">
              {optimizing ? "Optimizing..." : "Run ATS"}
            </button>
          </div>

          {result && (
            <section className="ak-popup-score-card">
              <div>
                <p>ATS Score</p>
                <strong>{result.ats_score_out_of_100}/100</strong>
              </div>
              <p>Missing Keywords: {result.missing_keywords.join(", ") || "None"}</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default IndexPopup
