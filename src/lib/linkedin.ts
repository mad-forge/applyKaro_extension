import {
  createJobData,
  first,
  firstVisibleText,
  formattedTextFrom,
  inferWorkplace,
  parseLocationAndWorkplace,
  type JobExtractor
} from "./extraction"

export const linkedinExtractor: JobExtractor = {
  id: "linkedin",
  canExtract: ({ url }) => url.includes("linkedin.com/jobs"),
  extract: ({ document: documentRef, url }) => {
    if (!url.includes("linkedin.com/jobs")) return null

  const title = firstVisibleText(documentRef, [
    ".jobs-search__job-details--container h1",
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

  const company = firstVisibleText(documentRef, [
    ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name a",
    ".jobs-search__job-details--container .job-details-jobs-unified-top-card__company-name",
    ".job-view-layout .job-details-jobs-unified-top-card__company-name a",
    ".job-view-layout .job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    "a.topcard__org-name-link"
  ])

  const detailsText = firstVisibleText(documentRef, [
    ".jobs-search__job-details--container .job-details-jobs-unified-top-card__primary-description-container",
    ".job-view-layout .job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description",
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    ".topcard__flavor-row"
  ])

  const parsedDetails = parseLocationAndWorkplace(detailsText)

  const descriptionContainer =
    first(documentRef, [
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
    first(documentRef, [
      ".jobs-search__job-details--container",
      ".job-view-layout",
      ".jobs-details__main-content",
      ".jobs-details"
    ])

  const description = formattedTextFrom(descriptionContainer)
  const workplace = parsedDetails.workplace || inferWorkplace(`${detailsText}\n${description}`)

    return createJobData({
      title,
      company,
      location: parsedDetails.location,
      workplace,
      description,
      url,
      source: "linkedin",
      extractionMethod: "linkedin"
    })
  }
}

export const scrapeLinkedinJob = () => linkedinExtractor.extract({ document, url: window.location.href })
