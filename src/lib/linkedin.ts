import type { JobData } from "./types"

const textFrom = (element: Element | null): string =>
  (element?.textContent || "").replace(/\s+/g, " ").trim()

const formattedTextFrom = (element: Element | null): string => {
  if (!element) return ""

  const raw =
    element instanceof HTMLElement ? element.innerText || element.textContent || "" : element.textContent || ""

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
    if (match) {
      return match
    }
  }

  return null
}

const visibleElements = (selectors: string[]): Element[] =>
  selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })

const firstVisibleText = (selectors: string[]): string => {
  for (const element of visibleElements(selectors)) {
    const text = textFrom(element)
    if (text) {
      return text
    }
  }

  return ""
}

export const scrapeLinkedinJob = (): JobData | null => {
  if (!window.location.href.includes("linkedin.com/jobs")) {
    return null
  }

  const title = firstVisibleText([
    ".jobs-search__job-details--container h1",
    ".job-view-layout h1",
    ".jobs-details h1",
    ".jobs-unified-top-card h1",
    ".jobs-details__main-content h1",
    "h1.t-24.t-bold.inline",
    "h1.job-details-jobs-unified-top-card__job-title",
    "h1[data-test-id='job-details-jobs-unified-top-card__job-title']"
  ])

  const company = firstVisibleText([
    ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name a",
    ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name",
    ".job-view-layout .job-details-jobs-unified-top-card__company-name a",
    ".job-view-layout .job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    "a.topcard__org-name-link"
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

  if (!title || !company || description.length < 80) {
    return null
  }

  return {
    title,
    company,
    description,
    url: window.location.href,
    scrapedAt: new Date().toISOString()
  }
}
