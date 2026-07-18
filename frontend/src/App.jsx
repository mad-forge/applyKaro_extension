import { useEffect, useRef, useState } from 'react'
import { Readability } from '@mozilla/readability'
import './index.css'
import Header from './components/Header.jsx'
import Stepper from './components/Stepper.jsx'
import JdCard from './components/JdCard.jsx'
import ResumeUploadCard from './components/ResumeUploadCard.jsx'
import AtsReportCard from './components/AtsReportCard.jsx'
import KeywordsCard from './components/KeywordsCard.jsx'
import ChangesCard from './components/ChangesCard.jsx'
import ScoreImprovementCard from './components/ScoreImprovementCard.jsx'
import TemplatePickerCard from './components/TemplatePickerCard.jsx'
import ActionFooter from './components/ActionFooter.jsx'
import { DEFAULT_TEMPLATE_ID, getResumeTemplateMeta } from './components/resume-templates/index.js'

const API_BASE_URL = 'http://localhost:3000/api'
const REQUEST_TIMEOUT_MS = 180000
const POLL_INTERVAL_MS = 3000
const SAVED_RESUME_KEY = 'applyKro:selectedResume'
const USER_PROFILE_KEY = 'applyKro:userProfile'
const TEMPLATE_KEY = 'applyKro:selectedTemplate'
// Written by background.js when the user right-clicks "Tailor with selected text".
const PENDING_SELECTION_KEY = 'applyKro:pendingSelection'

const chromeStorageGet = (keys) => new Promise((resolve) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    resolve({})
    return
  }
  chrome.storage.local.get(keys, (items) => resolve(items || {}))
})

const chromeStorageSet = (items) => new Promise((resolve, reject) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    resolve()
    return
  }
  chrome.storage.local.set(items, () => {
    const error = chrome.runtime?.lastError
    if (error) reject(new Error(error.message))
    else resolve()
  })
})

const chromeStorageRemove = (keys) => new Promise((resolve, reject) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    resolve()
    return
  }
  chrome.storage.local.remove(keys, () => {
    const error = chrome.runtime?.lastError
    if (error) reject(new Error(error.message))
    else resolve()
  })
})

const getGoogleProfile = () => new Promise((resolve) => {
  if (typeof chrome === 'undefined' || !chrome.identity?.getProfileUserInfo) {
    resolve(null)
    return
  }
  chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (profile) => {
    const error = chrome.runtime?.lastError
    if (error || !profile?.email) {
      resolve(null)
      return
    }
    resolve({
      email: profile.email,
      id: profile.id || '',
    })
  })
})

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('Could not read resume file'))
  reader.readAsDataURL(file)
})

const dataUrlToFile = (dataUrl, metadata) => {
  const [header, base64 = ''] = dataUrl.split(',')
  const mime = header.match(/data:([^;]+);base64/)?.[1] || metadata?.type || 'application/pdf'
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], metadata?.name || 'Saved_Resume.pdf', {
    type: mime,
    lastModified: metadata?.lastModified || Date.now(),
  })
}

const resumeMetadataFromFile = (file) => ({
  name: file.name,
  type: file.type || 'application/pdf',
  size: file.size,
  lastModified: file.lastModified,
})

// The extractors below run inside the target tab via
// chrome.scripting.executeScript. They must be fully self-contained (no
// references to module scope) since only their source is injected. Kept in
// sync with content.js as a fresh-injection fallback that survives the
// content script being orphaned after an extension reload.

// Tier 1: highlighted text always wins — it works on any site and never
// needs selector maintenance.
function extractSelectionInPage() {
  const text = String(window.getSelection()?.toString() || '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
  return text.length >= 80 ? text : ''
}

// Tier 2 input: full page HTML so Readability can parse it in the side panel.
function capturePageHtmlInPage() {
  return {
    html: document.documentElement.outerHTML,
    url: window.location.href,
  }
}

// Known job-board layouts (LinkedIn/Indeed selectors).
function extractJobDescriptionInPage() {
  const normalize = (text) => {
    const lines = String(text || '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const unique = lines.filter(
      (line, index) => index === 0 || line.toLowerCase() !== lines[index - 1].toLowerCase(),
    )
    return unique
      .join('\n')
      .replace(/^About the job\s+About the job\b/i, 'About the job')
      .replace(/^About the job\s+(?=About\b)/i, '')
      .trim()
  }

  const selectors = [
    '#job-details',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.jobs-description__container',
    'article.jobs-description__container',
    '.jobs-box__html-content',
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '.job-description',
    '[data-test="job-description"]',
  ]

  const candidates = []
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const text = normalize(element.innerText || element.textContent || '')
      if (text.length >= 200) candidates.push(text)
    }
  }

  // Fallback: locate the "About the job" heading and climb to the block that
  // holds the full description when no known container selector matches.
  if (candidates.length === 0) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
    const aboutHeading = headings.find((heading) => /about the job/i.test(heading.textContent || ''))
    let node = aboutHeading ? aboutHeading.parentElement : null
    for (let depth = 0; node && depth < 4; depth += 1) {
      const text = normalize(node.innerText || node.textContent || '')
      if (text.length >= 200) {
        candidates.push(text)
        break
      }
      node = node.parentElement
    }
  }

  if (candidates.length === 0) return ''
  return candidates.sort((a, b) => b.length - a.length)[0]
}

function App() {
  const [step, setStep] = useState(1)
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1)
  const [jd, setJd] = useState('')
  const [jdStatus, setJdStatus] = useState('')
  const [loadingJd, setLoadingJd] = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [savedResumeMeta, setSavedResumeMeta] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [resumeSyncStatus, setResumeSyncStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingSeconds, setProcessingSeconds] = useState(0)
  const [keywordsData, setKeywordsData] = useState(null)
  const [atsReport, setAtsReport] = useState(null)
  const [resumeChanges, setResumeChanges] = useState(null)
  const [scoreImprovement, setScoreImprovement] = useState(null)
  const [tailoredData, setTailoredData] = useState(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')
  const [cloudLink, setCloudLink] = useState(null)
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false)
  const [resultMessage, setResultMessage] = useState('')
  const pollTimerRef = useRef(null)
  const pdfBlobUrlRef = useRef('')
  const pdfBlobRef = useRef(null)
  const lastExtractedJdRef = useRef('')
  const jdRef = useRef('')
  const processingRef = useRef(false)

  useEffect(() => {
    jdRef.current = jd
  }, [jd])

  useEffect(() => {
    processingRef.current = isProcessing
  }, [isProcessing])

  const advanceTo = (target) => {
    setStep(target)
    setMaxUnlockedStep((current) => Math.max(current, target))
  }

  const goToStep = (target) => {
    if (target <= maxUnlockedStep) setStep(target)
  }

  useEffect(() => {
    void (async () => {
      const usedSelection = await consumePendingSelection()
      if (!usedSelection) extractJdFromPage()
    })()
    initializeUserResume()

    return () => {
      stopPolling()
      if (pdfBlobUrlRef.current) {
        window.URL.revokeObjectURL(pdfBlobUrlRef.current)
      }
    }
    // Extension popup should extract the active tab once when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The side panel stays open across navigation, so refresh the JD when the
  // user switches tabs or a page finishes loading — but never clobber text
  // the user typed or pasted by hand.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.onActivated) return undefined

    const autoExtract = async (tabId) => {
      if (processingRef.current) return
      try {
        const text = await extractFromTab(tabId)
        if (!text) return
        const current = jdRef.current.trim()
        if (current && current !== lastExtractedJdRef.current.trim()) return
        if (text.trim() === current) return
        applyExtractedJd(text)
      } catch {
        // Best-effort refresh only.
      }
    }

    const onActivated = ({ tabId }) => { void autoExtract(tabId) }
    const onUpdated = (tabId, info, tab) => {
      if (info.status === 'complete' && tab?.active) void autoExtract(tabId)
    }

    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply a context-menu selection even when the side panel is already open.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return undefined

    const onChanged = (changes, area) => {
      if (area !== 'local' || !changes[PENDING_SELECTION_KEY]?.newValue) return
      void consumePendingSelection()
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isProcessing) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setProcessingSeconds((seconds) => seconds + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isProcessing])

  async function initializeUserResume() {
    try {
      const [profile, stored] = await Promise.all([
        getGoogleProfile(),
        chromeStorageGet([SAVED_RESUME_KEY, USER_PROFILE_KEY, TEMPLATE_KEY]),
      ])
      const resolvedProfile = profile || stored[USER_PROFILE_KEY] || null
      if (resolvedProfile) {
        setUserProfile(resolvedProfile)
        await chromeStorageSet({ [USER_PROFILE_KEY]: resolvedProfile })
      }

      if (stored[TEMPLATE_KEY]) {
        setSelectedTemplateId(stored[TEMPLATE_KEY])
      }

      const savedResume = stored[SAVED_RESUME_KEY]
      if (savedResume?.dataUrl && savedResume?.metadata) {
        const restoredFile = dataUrlToFile(savedResume.dataUrl, savedResume.metadata)
        setResumeFile(restoredFile)
        setSavedResumeMeta(savedResume.metadata)
        setResumeSyncStatus('Saved resume loaded for this browser.')
        if (resolvedProfile) {
          void syncResumeRecord(resolvedProfile, savedResume.metadata)
        }
      } else if (resolvedProfile) {
        setResumeSyncStatus(`Signed in as ${resolvedProfile.email}. Select a resume once to save it.`)
      }
    } catch (error) {
      console.error(error)
      setResumeSyncStatus('Could not load saved resume. Select your PDF once.')
    }
  }

  async function runInTab(tabId, func) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
    })
    return results?.[0]?.result
  }

  // Tier 2 fallback for sites without known selectors: Readability strips the
  // page down to its main article, then the backend AI filter isolates the JD
  // from any remaining noise. Falls back to the raw article text when the
  // backend/AI is unreachable — the deep JD analyzer copes with some noise.
  async function extractGenericJd(tabId) {
    const captured = await runInTab(tabId, capturePageHtmlInPage)
    if (!captured?.html) return ''

    const doc = new DOMParser().parseFromString(captured.html, 'text/html')
    const article = new Readability(doc).parse()
    const raw = String(article?.textContent || '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
    if (raw.length < 200) return ''

    try {
      const response = await fetch(`${API_BASE_URL}/extract-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw.slice(0, 30000), url: captured.url || '' }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.isJobDescription === false) return ''
        if (typeof data.jd === 'string' && data.jd.trim().length >= 80) return data.jd.trim()
      }
    } catch {
      // Backend down or AI blocked on this network — raw article text still works.
    }
    return raw
  }

  // Returns the JD text, '' when the page was reachable but had no JD, or
  // null when the page could not be accessed at all. Priority: highlighted
  // text → known job-board selectors → (manual extraction only) Readability.
  async function extractFromTab(tabId, { allowGeneric = false } = {}) {
    // Fresh injection first: it survives extension reloads that orphan the
    // content script, which is the common failure in a long-lived side panel.
    if (chrome.scripting?.executeScript) {
      try {
        const selection = await runInTab(tabId, extractSelectionInPage)
        if (selection) return selection

        const layout = await runInTab(tabId, extractJobDescriptionInPage)
        if (layout) return layout

        if (allowGeneric) {
          const generic = await extractGenericJd(tabId)
          if (generic) return generic
        }
        return ''
      } catch {
        // No host permission for this site or a restricted page; fall through
        // to the declared content script.
      }
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_JD' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null)
          return
        }
        resolve(response?.jd || '')
      })
    })
  }

  async function consumePendingSelection() {
    const stored = await chromeStorageGet([PENDING_SELECTION_KEY])
    const pending = stored[PENDING_SELECTION_KEY]
    if (!pending?.text) return false
    await chromeStorageRemove([PENDING_SELECTION_KEY])
    if (processingRef.current) return false
    applyExtractedJd(pending.text)
    setStep(1)
    setJdStatus('Using your highlighted text as the job description.')
    return true
  }

  const applyExtractedJd = (text) => {
    lastExtractedJdRef.current = text
    setJd(text)
    setAtsReport(null)
    setResumeChanges(null)
    resetGeneratedPdf()
    setMaxUnlockedStep((current) => Math.min(current, 1))
    setJdStatus('Full job description detected.')
  }

  async function extractJdFromPage() {
    setLoadingJd(true)
    setJdStatus('')
    setResultMessage('')

    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        throw new Error('Job extraction is available from the installed Chrome extension.')
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        throw new Error('Could not access the active tab.')
      }

      const text = await extractFromTab(tab.id, { allowGeneric: true })
      if (text) {
        applyExtractedJd(text)
      } else if (text === null) {
        setJdStatus('Could not read this page. Highlight the job description and use the right-click "Tailor with selected text" menu, or paste it below.')
      } else {
        setJdStatus('No job description was found on this page. Highlight it and press Extract again, or paste it below.')
      }
    } catch (error) {
      console.error(error)
      setJdStatus(error instanceof Error ? error.message : 'Could not extract the job description.')
    } finally {
      setLoadingJd(false)
    }
  }

  const syncResumeRecord = async (profile, metadata) => {
    if (!profile?.email || !metadata) return
    try {
      await fetch(`${API_BASE_URL}/user-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: profile,
          resume: metadata,
        }),
      })
    } catch (error) {
      console.warn('Could not sync resume record:', error)
    }
  }

  const persistSelectedResume = async (file) => {
    const metadata = resumeMetadataFromFile(file)
    const dataUrl = await fileToDataUrl(file)
    await chromeStorageSet({
      [SAVED_RESUME_KEY]: {
        metadata,
        dataUrl,
        savedAt: new Date().toISOString(),
      },
    })
    setSavedResumeMeta(metadata)
    setResumeSyncStatus('Resume saved. It will be selected automatically next time.')
    await syncResumeRecord(userProfile, metadata)
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null
    setResumeFile(file)
    setAtsReport(null)
    setResumeChanges(null)
    resetGeneratedPdf()
    setMaxUnlockedStep((current) => Math.min(current, 2))
    setResultMessage('')
    if (!file) return
    try {
      await persistSelectedResume(file)
    } catch (error) {
      console.error(error)
      setResumeSyncStatus(error instanceof Error ? error.message : 'Could not save this resume.')
    }
  }

  const clearSavedResume = async () => {
    await chromeStorageRemove(SAVED_RESUME_KEY)
    setResumeFile(null)
    setSavedResumeMeta(null)
    setAtsReport(null)
    setResumeChanges(null)
    resetGeneratedPdf()
    setMaxUnlockedStep((current) => Math.min(current, 2))
    setResumeSyncStatus('Saved resume removed. Choose a PDF when you are ready.')
  }

  const stopPolling = () => {
    if (!pollTimerRef.current) return
    window.clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
  }

  const resetGeneratedPdf = () => {
    setTailoredData(null)
    setPdfBlobUrl('')
    setCloudLink(null)
    setIsUploadingToCloud(false)
    pdfBlobRef.current = null
    if (pdfBlobUrlRef.current) {
      window.URL.revokeObjectURL(pdfBlobUrlRef.current)
      pdfBlobUrlRef.current = ''
    }
  }

  const createFormData = () => {
    const cleanJd = jd.trim()
    if (!resumeFile) {
      setResultMessage('Please upload your base resume first.')
      return null
    }
    if (!cleanJd) {
      setResultMessage('Add or extract the full job description before continuing.')
      return null
    }
    const formData = new FormData()
    formData.append('resume', resumeFile)
    formData.append('jd', cleanJd)
    return formData
  }

  const parseResponse = async (response, fallbackError) => {
    const responseText = await response.text()
    let data
    try {
      data = responseText ? JSON.parse(responseText) : {}
    } catch {
      data = { error: responseText || fallbackError }
    }
    if (!response.ok) {
      const validationDetails = Array.isArray(data.validationErrors) && data.validationErrors.length > 0
        ? `\n${data.validationErrors.slice(0, 4).join('\n')}`
        : ''
      throw new Error(`${data.error || fallbackError}${validationDetails}`)
    }
    return data
  }

  const requestWithTimeout = async (path, formData) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      let response
      try {
        response = await fetch(`${API_BASE_URL}/${path}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error
        }
        throw new Error('Could not reach the local backend. Start it with `npm run dev` in the backend folder, then retry.', { cause: error })
      }

      return parseResponse(response, `Failed to ${path} resume`)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const getTailorJob = async (jobId) => {
    let response
    try {
      response = await fetch(`${API_BASE_URL}/tailor?jobId=${encodeURIComponent(jobId)}`)
    } catch (error) {
      throw new Error('Could not reach the local backend while checking the tailoring job.', { cause: error })
    }
    return parseResponse(response, 'Failed to check tailoring job')
  }

  const generatePdfBlob = async (data) => {
    const [{ pdf }, ResumeTemplate] = await Promise.all([
      import('@react-pdf/renderer'),
      getResumeTemplateMeta(selectedTemplateId).load(),
    ])
    const blob = await pdf(<ResumeTemplate data={data} />).toBlob()
    pdfBlobRef.current = blob
    const url = window.URL.createObjectURL(blob)
    if (pdfBlobUrlRef.current) {
      window.URL.revokeObjectURL(pdfBlobUrlRef.current)
    }
    pdfBlobUrlRef.current = url
    setPdfBlobUrl(url)
    return url
  }

  const triggerPdfDownload = (url) => {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'Tailored_Resume.pdf'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleCompletedTailorJob = async (job) => {
    const result = job.result
    const data = result.tailoredData
    setAtsReport({
      atsScore: result.atsScore,
      gapAnalysis: result.gapAnalysis,
      keywordAnalysis: result.keywordAnalysis,
      jdAnalysis: result.jdAnalysis,
    })
    setKeywordsData(result.addedKeywords || [])
    setResumeChanges(result.resumeChanges)
    setScoreImprovement(
      typeof result.tailoredAtsScore?.score === 'number'
        ? { before: result.atsScore.score, after: result.tailoredAtsScore.score }
        : null,
    )
    setTailoredData(data)
    setResultMessage('Tailored resume ready. Generating PDF...')
    advanceTo(4)
    const url = await generatePdfBlob(data)
    triggerPdfDownload(url)
    setResultMessage('Tailored resume downloaded successfully.')
  }

  const pollTailorJob = (jobId) => {
    stopPolling()
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const job = await getTailorJob(jobId)
        if (job.status === 'pending' || job.status === 'processing') {
          setResultMessage('AI is tailoring your resume...')
          return
        }
        stopPolling()
        if (job.status === 'failed') {
          const validationDetails = Array.isArray(job.validationErrors) && job.validationErrors.length > 0
            ? `\n${job.validationErrors.slice(0, 4).join('\n')}`
            : ''
          throw new Error(`${job.error || 'Could not tailor the resume.'}${validationDetails}`)
        }
        if (job.status === 'completed') {
          await handleCompletedTailorJob(job)
        }
      } catch (error) {
        stopPolling()
        console.error(error)
        setResultMessage(error instanceof Error ? error.message : 'Could not tailor the resume.')
      } finally {
        if (!pollTimerRef.current) {
          setIsProcessing(false)
          setProcessingSeconds(0)
        }
      }
    }, POLL_INTERVAL_MS)
  }

  const handleAnalyzeResume = async () => {
    const formData = createFormData()
    if (!formData) return
    setIsProcessing(true)
    setResultMessage('')
    setResumeChanges(null)
    resetGeneratedPdf()
    try {
      const report = await requestWithTimeout('analyze', formData)
      setAtsReport(report)
      advanceTo(3)
      setResultMessage('ATS analysis complete. Review the gaps before tailoring.')
    } catch (error) {
      console.error(error)
      setResultMessage(error instanceof Error ? error.message : 'Could not analyze the resume.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTailorResume = async () => {
    const formData = createFormData()
    if (!formData) return
    setProcessingSeconds(0)
    setIsProcessing(true)
    setKeywordsData(null)
    setResumeChanges(null)
    setScoreImprovement(null)
    resetGeneratedPdf()
    setResultMessage('Starting tailoring job...')

    try {
      const data = await requestWithTimeout('tailor', formData)
      if (!data.jobId) throw new Error('Backend did not return a tailoring job ID.')
      setResultMessage('AI is tailoring your resume...')
      pollTailorJob(data.jobId)
    } catch (error) {
      console.error(error)
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'The request timed out after 3 minutes. Please retry.'
        : error instanceof Error
          ? error.message
          : 'Could not tailor the resume.'
      setResultMessage(message)
      setIsProcessing(false)
      setProcessingSeconds(0)
    }
  }

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId)
    void chromeStorageSet({ [TEMPLATE_KEY]: templateId })
  }

  const downloadPdf = () => {
    if (!pdfBlobUrl) return
    triggerPdfDownload(pdfBlobUrl)
    setResultMessage('Tailored resume downloaded successfully.')
  }

  // Uploads the rendered PDF to the backend, which stores it in Cloudflare R2
  // and returns a presigned download link (valid 7 days).
  const saveToCloud = async () => {
    if (!pdfBlobRef.current || isUploadingToCloud) return
    setIsUploadingToCloud(true)
    try {
      const formData = new FormData()
      formData.append('pdf', pdfBlobRef.current, 'Tailored_Resume.pdf')
      const response = await fetch(`${API_BASE_URL}/resume-pdf`, {
        method: 'POST',
        body: formData,
      })
      const data = await parseResponse(response, 'Could not upload the PDF to cloud storage')
      setCloudLink(data)
      try {
        await navigator.clipboard.writeText(data.downloadUrl)
        setResultMessage('Cloud link copied to clipboard — valid for 7 days.')
      } catch {
        setResultMessage('Cloud link ready below — valid for 7 days.')
      }
    } catch (error) {
      console.error(error)
      setResultMessage(error instanceof Error ? error.message : 'Could not upload the PDF to cloud storage.')
    } finally {
      setIsUploadingToCloud(false)
    }
  }

  const handleContinueFromJd = () => {
    if (!jd.trim()) return
    advanceTo(2)
  }

  const startOver = () => {
    setAtsReport(null)
    setResumeChanges(null)
    setKeywordsData(null)
    setScoreImprovement(null)
    resetGeneratedPdf()
    setResultMessage('')
    setStep(1)
    setMaxUnlockedStep(1)
    extractJdFromPage()
  }

  return (
    <main className="app-shell">
      <Header userEmail={userProfile?.email} />

      <Stepper step={step} maxUnlockedStep={maxUnlockedStep} onStepClick={goToStep} />

      {step === 1 && (
        <JdCard
          jd={jd}
          onJdChange={(event) => {
            setJd(event.target.value)
            setJdStatus('')
            setAtsReport(null)
            setResumeChanges(null)
            resetGeneratedPdf()
            setMaxUnlockedStep((current) => Math.min(current, 1))
          }}
          jdStatus={jdStatus}
          loadingJd={loadingJd}
          onExtract={extractJdFromPage}
        />
      )}

      {step === 2 && (
        <>
          <ResumeUploadCard
            resumeFile={resumeFile}
            resumeSyncStatus={resumeSyncStatus}
            savedResumeMeta={savedResumeMeta}
            onFileChange={handleFileChange}
            onClear={clearSavedResume}
          />
          <TemplatePickerCard selectedTemplateId={selectedTemplateId} onSelect={handleSelectTemplate} />
        </>
      )}

      {step === 3 && atsReport && <AtsReportCard atsReport={atsReport} />}

      {step === 4 && (
        <>
          <ScoreImprovementCard scoreImprovement={scoreImprovement} />
          <KeywordsCard keywordsData={keywordsData} />
          <ChangesCard resumeChanges={resumeChanges} />
        </>
      )}

      <ActionFooter
        step={step}
        resultMessage={resultMessage}
        pdfBlobUrl={pdfBlobUrl}
        tailoredData={tailoredData}
        isProcessing={isProcessing}
        loadingJd={loadingJd}
        processingSeconds={processingSeconds}
        canContinueFromJd={Boolean(jd.trim())}
        onBack={() => goToStep(step - 1)}
        onContinueJd={handleContinueFromJd}
        onAnalyze={handleAnalyzeResume}
        onTailor={handleTailorResume}
        cloudLink={cloudLink}
        isUploadingToCloud={isUploadingToCloud}
        onSaveToCloud={saveToCloud}
        onDownload={downloadPdf}
        onStartOver={startOver}
      />
    </main>
  )
}

export default App
