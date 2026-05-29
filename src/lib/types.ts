export type JobData = {
  title: string
  company: string
  location?: string
  workplace?: string
  description: string
  url: string
  scrapedAt: string
}

export type RuntimeMessage =
  | { type: "JOB_DATA_UPDATED"; payload: JobData }
  | { type: "GET_LATEST_JOB_DATA" }
  | { type: "SCRAPE_JOB_PAGE" }
