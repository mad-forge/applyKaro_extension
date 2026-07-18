// Background script: side panel behavior + "tailor selected text" context menu.

const PENDING_SELECTION_KEY = 'applyKro:pendingSelection'
const CONTEXT_MENU_ID = 'applykro-tailor-selection'

// Open the side panel (right-docked) when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Could not set side panel behavior:', error))

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'ApplyKro: Tailor with selected text',
    contexts: ['selection'],
  })
})

// info.selectionText collapses newlines, so re-read the live selection from the
// page when we can (the context-menu click grants activeTab for this tab).
async function readSelectionFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString() || '',
    })
    return results?.[0]?.result || ''
  } catch {
    return ''
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return

  const selection = (await readSelectionFromTab(tab.id)) || info.selectionText || ''
  const text = selection.trim()
  if (!text) return

  await chrome.storage.local.set({
    [PENDING_SELECTION_KEY]: { text, savedAt: Date.now() },
  })

  try {
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (error) {
    console.error('Could not open side panel:', error)
  }
})
