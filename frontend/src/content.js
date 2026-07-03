// This script runs on the job pages (e.g., LinkedIn, Indeed)

console.log("AI Resume Tailor Content Script loaded");

function normalizeJobDescription(text) {
  const lines = text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const uniqueLines = lines.filter((line, index) => {
    return index === 0 || line.toLowerCase() !== lines[index - 1].toLowerCase();
  });

  return uniqueLines
    .join('\n')
    .replace(/^About the job\s+About the job\b/i, 'About the job')
    .replace(/^About the job\s+(?=About\b)/i, '')
    .trim();
}

function extractJobDescription() {
  const selectors = [
    '#job-details',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
    '#jobDescriptionText',
    '.job-description',
    '[data-test="job-description"]'
  ];

  const candidates = [];
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const text = normalizeJobDescription(element.innerText || element.textContent || '');
      if (text.length >= 200) {
        candidates.push(text);
      }
    }
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }

  return '';
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "EXTRACT_JD") {
    const jd = extractJobDescription();
    sendResponse({ jd: jd });
  }
  return true;
});
