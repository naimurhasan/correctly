// Background service worker
console.log("Background service worker started");

// Create offscreen document
async function setupOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    console.log("Offscreen document already exists");
    return;
  }

  // Create the offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_SCRAPING'], // We need DOM APIs for URL.createObjectURL
    justification: 'Load and run Transformers.js model which requires DOM APIs'
  });

  console.log("Offscreen document created successfully");
}

// Initialize offscreen document
setupOffscreenDocument().catch(error => {
  console.error("Error setting up offscreen document:", error);
});

// Listen for messages from offscreen document and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request, "from:", sender.url || sender.tab?.id);

  // Handle messages from offscreen document (identified by sender.url containing offscreen.html)
  if (sender.url && sender.url.includes('offscreen.html')) {
    if (request.type === "progressUpdate") {
      // Broadcast progress to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: "modelLoadingProgress",
            progress: request.progress,
            status: request.status
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        });
      });
      return;
    }

    if (request.type === "modelReady") {
      console.log("Model ready message received from offscreen, broadcasting to all tabs...");
      // Broadcast model ready to all tabs (only web pages, not extension pages)
      chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
        console.log(`Found ${tabs.length} web tabs to broadcast to`);
        if (tabs.length === 0) {
          console.log("No tabs to broadcast to. Open a web page to test the extension.");
        }
        tabs.forEach(tab => {
          console.log(`Sending modelReady to tab ${tab.id} (${tab.url})`);
          chrome.tabs.sendMessage(tab.id, {
            action: "modelReady"
          }).then(() => {
            console.log(`✓ Successfully sent to tab ${tab.id}`);
          }).catch((error) => {
            console.log(`✗ Failed to send to tab ${tab.id}:`, error.message);
          });
        });
      });
      // Don't send response to offscreen
      return;
    }

    if (request.type === "modelError") {
      console.error("Model error from offscreen:", request.error);
      return;
    }

    // If offscreen sends a response to a forwarded message, handle it
    if (request.type === "response") {
      // This shouldn't happen in normal flow
      return;
    }
  }

  // Handle messages from content script (identified by sender.tab)
  if (sender.tab) {
    if (request.action === "correctGrammar" || request.action === "getModelStatus") {
      // Forward to offscreen document by sending a message
      // The offscreen document will receive this and respond
      setupOffscreenDocument()
        .then(() => {
          // Send message to all extension contexts (offscreen will receive it)
          chrome.runtime.sendMessage(request, (response) => {
            if (chrome.runtime.lastError) {
              console.log("Error communicating with offscreen:", chrome.runtime.lastError.message);
              sendResponse({ error: "Offscreen document not ready" });
            } else if (response) {
              sendResponse(response);
            } else {
              sendResponse({ error: "No response from offscreen" });
            }
          });
        })
        .catch(error => {
          sendResponse({ error: "Failed to setup offscreen: " + error.message });
        });
      return true; // Keep message channel open for async response
    }
  }

  sendResponse({ status: "Message received in background" });
});
