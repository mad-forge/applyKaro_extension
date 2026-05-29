import type { JobData, RuntimeMessage } from "~lib/types"

let latestJobData: JobData | null = null

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "JOB_DATA_UPDATED") {
    latestJobData = message.payload
    sendResponse({ ok: true })
    return
  }

  if (message.type === "GET_LATEST_JOB_DATA") {
    sendResponse({ job: latestJobData })
  }
})
