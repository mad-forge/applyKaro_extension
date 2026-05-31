export type JobData = {
  title: string
  company: string
  location?: string
  workplace?: string
  description: string
  url: string
  source?: string
  extractionMethod?: "linkedin" | "generic" | "url" | "selector"
  scrapedAt: string
}

export type RuntimeMessage =
  | { type: "JOB_DATA_UPDATED"; payload: JobData }
  | { type: "GET_LATEST_JOB_DATA" }
  | { type: "GET_RECENT_JOB_DATA" }
  | { type: "SCRAPE_JOB_PAGE" }
  | { type: "START_SELECTOR_MODE" }
  | { type: "SELECTOR_MODE_CANCELLED" }
