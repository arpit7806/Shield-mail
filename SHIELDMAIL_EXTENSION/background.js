chrome.runtime.onInstalled.addListener(() => {
  console.log('[Sheidmail] Extension installed successfully.');
  chrome.storage.local.set({ lastResult: null });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_LAST_RESULT') {
    chrome.storage.local.get(['lastResult', 'lastEmail'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});
