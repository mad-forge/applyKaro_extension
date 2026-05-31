import type { JobData, RuntimeMessage } from "~lib/types"

const RECENT_JOBS_KEY = "applyKroRecentJobs"
const ANALYTICS_KEY = "applyKroAnalytics"

let latestJobData: JobData | null = null

const cacheJobData = async (job: JobData) => {
  const stored = await chrome.storage.local.get([RECENT_JOBS_KEY, ANALYTICS_KEY])
  const recentJobs = ((stored[RECENT_JOBS_KEY] || []) as JobData[]).filter((item) => item.url !== job.url)
  const analytics = stored[ANALYTICS_KEY] || {}

  await chrome.storage.local.set({
    [RECENT_JOBS_KEY]: [job, ...recentJobs].slice(0, 10),
    [ANALYTICS_KEY]: {
      ...analytics,
      extractedJobs: Number(analytics.extractedJobs || 0) + 1,
      lastExtractionAt: new Date().toISOString()
    }
  })
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "JOB_DATA_UPDATED") {
    latestJobData = message.payload
    cacheJobData(message.payload).catch(() => {})
    sendResponse({ ok: true })
    return
  }

  if (message.type === "GET_LATEST_JOB_DATA") {
    sendResponse({ job: latestJobData })
  }

  if (message.type === "GET_RECENT_JOB_DATA") {
    chrome.storage.local.get(RECENT_JOBS_KEY).then((stored) => {
      sendResponse({ jobs: stored[RECENT_JOBS_KEY] || [] })
    })
    return true
  }
})
