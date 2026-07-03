// Background script for managing extension state and API calls

chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Resume Tailor Extension Installed.");
});

// We can handle API calls to our Next.js backend here later
// to avoid CORS issues if we were making them directly from the popup or content script.
