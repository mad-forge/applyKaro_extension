import { extractJob, extractSelectedJob, genericExtractor } from "~lib/extraction"
import { linkedinExtractor } from "~lib/linkedin"
import type { RuntimeMessage } from "~lib/types"

export const config = {
  matches: ["https://*/*", "http://*/*"]
}

let lastUrl = window.location.href
let selectorCleanup: (() => void) | null = null

const publishJobData = () => {
  const payload = extractJob(
    { document, url: window.location.href, source: "active-tab" },
    [linkedinExtractor, genericExtractor]
  )

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

const publishSelectedJobData = (element: Element) => {
  const payload = extractSelectedJob(element, window.location.href)
  if (!payload) return

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

  if (message.type === "START_SELECTOR_MODE") {
    startSelectorMode()
    sendResponse({ ok: true })
  }
})

const startSelectorMode = () => {
  selectorCleanup?.()

  const overlay = document.createElement("div")
  overlay.style.position = "fixed"
  overlay.style.inset = "0"
  overlay.style.zIndex = "2147483646"
  overlay.style.pointerEvents = "none"
  overlay.style.border = "2px solid rgba(34, 211, 238, 0.95)"
  overlay.style.background = "rgba(8, 47, 73, 0.08)"
  overlay.style.display = "none"

  const label = document.createElement("div")
  label.textContent = "Click Job Description Section | Press ESC to Cancel"
  label.style.position = "fixed"
  label.style.left = "16px"
  label.style.top = "16px"
  label.style.zIndex = "2147483647"
  label.style.padding = "10px 12px"
  label.style.borderRadius = "8px"
  label.style.background = "rgba(2, 6, 23, 0.92)"
  label.style.color = "white"
  label.style.font = "600 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
  label.style.boxShadow = "0 12px 40px rgba(2, 6, 23, 0.35)"

  document.documentElement.append(overlay, label)

  const cleanup = () => {
    document.removeEventListener("mousemove", onMouseMove, true)
    document.removeEventListener("click", onClick, true)
    document.removeEventListener("keydown", onKeyDown, true)
    overlay.remove()
    label.remove()
    selectorCleanup = null
  }

  const updateOverlay = (target: Element) => {
    const rect = target.getBoundingClientRect()
    overlay.style.display = "block"
    overlay.style.left = `${Math.max(0, rect.left)}px`
    overlay.style.top = `${Math.max(0, rect.top)}px`
    overlay.style.width = `${Math.max(0, rect.width)}px`
    overlay.style.height = `${Math.max(0, rect.height)}px`
  }

  function onMouseMove(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof Element) || target === overlay || target === label) return
    updateOverlay(target)
  }

  function onClick(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof Element) || target === overlay || target === label) return
    event.preventDefault()
    event.stopPropagation()
    publishSelectedJobData(target)
    cleanup()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    cleanup()
    chrome.runtime.sendMessage({ type: "SELECTOR_MODE_CANCELLED" } as RuntimeMessage).catch(() => {})
  }

  selectorCleanup = cleanup
  document.addEventListener("mousemove", onMouseMove, true)
  document.addEventListener("click", onClick, true)
  document.addEventListener("keydown", onKeyDown, true)
}

setupUrlChangeListener()
setTimeout(publishJobData, 1000)
