import type { JobData } from "./types"

export type ExtractorContext = {
  document: Document
  url: string
  source?: string
}

export type JobExtractor = {
  id: string
  canExtract: (context: ExtractorContext) => boolean
  extract: (context: ExtractorContext) => JobData | null
}

export const textFrom = (element: Element | null): string =>
  (element?.textContent || "").replace(/\s+/g, " ").trim()

export const formattedTextFrom = (element: Element | null): string => {
  if (!element) return ""

  const raw =
    element instanceof HTMLElement ? element.innerText || element.textContent || "" : element.textContent || ""

  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(
      /(About the job|Job description|What You'll Do|Key Responsibilities|What You'll Need|Technical Skills|Preferred \/ Nice To Have|Education & Experience|How We Work(?: \(core Competencies\))?|Responsibilities|Qualifications|Requirements|Minimum qualifications|Preferred qualifications|Skills|Benefits)(?=\s+[A-Z(])/g,
      "\n\n$1\n"
    )
    .trim()
}

export const first = (documentRef: Document, selectors: string[]): Element | null => {
  for (const selector of selectors) {
    const match = documentRef.querySelector(selector)
    if (match) return match
  }

  return null
}

const isVisible = (element: Element) => {
  if (!(element instanceof HTMLElement)) return true
  if (!element.isConnected || element.ownerDocument.defaultView !== window) return true
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
}

export const firstVisibleText = (documentRef: Document, selectors: string[]): string => {
  for (const selector of selectors) {
    for (const element of Array.from(documentRef.querySelectorAll(selector))) {
      const text = textFrom(element)
      if (text && isVisible(element)) return text
    }
  }

  return ""
}

export const parseLocationAndWorkplace = (text: string) => {
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

export const inferWorkplace = (text: string) => {
  if (/\bremote\b/i.test(text)) return "Remote"
  if (/\bhybrid\b/i.test(text)) return "Hybrid"
  if (/\bon[-\s]?site\b/i.test(text)) return "On-site"
  return ""
}

const getMeta = (documentRef: Document, names: string[]) => {
  for (const name of names) {
    const selector = `meta[name="${name}"], meta[property="${name}"]`
    const content = documentRef.querySelector<HTMLMetaElement>(selector)?.content?.trim()
    if (content) return content
  }

  return ""
}

const cleanTitle = (title: string) =>
  title
    .replace(/\s+[-|]\s+(LinkedIn|Indeed|Glassdoor|Wellfound|Greenhouse|Lever|Workday).*$/i, "")
    .replace(/\s+/g, " ")
    .trim()

const findLargestTextBlock = (documentRef: Document) => {
  const candidates = Array.from(
    documentRef.querySelectorAll("article, main, section, [class*='job'], [id*='job'], [class*='description'], [id*='description']")
  )
    .map((element) => ({ element, text: formattedTextFrom(element) }))
    .filter((candidate) => candidate.text.length >= 250)
    .sort((a, b) => b.text.length - a.text.length)

  return candidates[0]?.element || documentRef.body
}

export const createJobData = ({
  title,
  company,
  location,
  workplace,
  description,
  url,
  source,
  extractionMethod
}: Omit<JobData, "scrapedAt">): JobData | null => {
  const normalizedDescription = description.trim()
  if (!normalizedDescription || normalizedDescription.length < 80) return null

  return {
    title: title.trim() || "Untitled Role",
    company: company.trim() || "Unknown Company",
    location: location?.trim(),
    workplace: workplace?.trim() || inferWorkplace(normalizedDescription),
    description: normalizedDescription,
    url,
    source,
    extractionMethod,
    scrapedAt: new Date().toISOString()
  }
}

export const genericExtractor: JobExtractor = {
  id: "generic",
  canExtract: () => true,
  extract: ({ document: documentRef, url, source }) => {
    const title = cleanTitle(
      firstVisibleText(documentRef, ["h1", "[data-testid*='title' i]", "[class*='title' i]"]) ||
        getMeta(documentRef, ["og:title", "twitter:title"]) ||
        documentRef.title
    )
    const company =
      firstVisibleText(documentRef, [
        "[data-testid*='company' i]",
        "[class*='company' i] a",
        "[class*='company' i]",
        "[class*='employer' i]",
        "[class*='organization' i]"
      ]) || getMeta(documentRef, ["og:site_name", "application-name"])
    const details = firstVisibleText(documentRef, [
      "[data-testid*='location' i]",
      "[class*='location' i]",
      "[class*='job-meta' i]",
      "[class*='subtitle' i]"
    ])
    const parsedDetails = parseLocationAndWorkplace(details)
    const descriptionElement =
      first(documentRef, [
        "[data-testid*='description' i]",
        "[class*='job-description' i]",
        "[class*='description' i]",
        "[id*='description' i]",
        "article",
        "main"
      ]) || findLargestTextBlock(documentRef)
    const description = formattedTextFrom(descriptionElement)

    return createJobData({
      title,
      company,
      location: parsedDetails.location,
      workplace: parsedDetails.workplace,
      description,
      url,
      source,
      extractionMethod: source === "url-import" ? "url" : "generic"
    })
  }
}

export const extractJob = (context: ExtractorContext, extractors: JobExtractor[]): JobData | null => {
  for (const extractor of extractors) {
    if (!extractor.canExtract(context)) continue
    const job = extractor.extract(context)
    if (job) return job
  }

  return null
}

export const extractSelectedJob = (element: Element, url: string): JobData | null => {
  let container: Element | null = element
  let best = element
  let bestText = formattedTextFrom(element)

  for (let depth = 0; depth < 4 && container?.parentElement; depth += 1) {
    container = container.parentElement
    const text = formattedTextFrom(container)
    if (text.length > bestText.length && text.length < 18000) {
      best = container
      bestText = text
    }
  }

  const documentRef = element.ownerDocument
  const title = firstVisibleText(documentRef, ["h1", "h2"]) || cleanTitle(documentRef.title)
  const company =
    firstVisibleText(documentRef, ["[data-testid*='company' i]", "[class*='company' i]", "[class*='employer' i]"]) ||
    getMeta(documentRef, ["og:site_name"])

  return createJobData({
    title,
    company,
    description: bestText,
    url,
    source: "selector",
    extractionMethod: "selector"
  })
}
