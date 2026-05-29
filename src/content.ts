import { scrapeLinkedinJob } from "~lib/linkedin"
import type { RuntimeMessage } from "~lib/types"

export const config = {
  matches: ["https://www.linkedin.com/jobs/*", "https://linkedin.com/jobs/*"]
}

let lastUrl = window.location.href

const publishJobData = () => {
  const payload = scrapeLinkedinJob()

  if (!payload) {
    return
  }

  const message: RuntimeMessage = {
    type: "JOB_DATA_UPDATED",
    payload
  }

  chrome.runtime.sendMessage(message).catch(() => {
    // Popup/background may be unloaded; ignore runtime errors.
  })
}

const setupUrlChangeListener = () => {
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      setTimeout(publishJobData, 600)
    }
  })

  observer.observe(document, { subtree: true, childList: true })

  window.addEventListener("popstate", () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      setTimeout(publishJobData, 600)
    }
  })
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "SCRAPE_JOB_PAGE") {
    publishJobData()
    sendResponse({ ok: true })
  }
})

setupUrlChangeListener()
setTimeout(publishJobData, 1000)
