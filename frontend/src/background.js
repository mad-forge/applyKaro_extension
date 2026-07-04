// Background script for managing extension state and API calls

// Open the side panel (right-docked) when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Could not set side panel behavior:", error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Resume Tailor Extension Installed.");
});

// We can handle API calls to our Next.js backend here later
// to avoid CORS issues if we were making them directly from the popup or content script.
