// Background service worker
console.log("Background service worker started");

let modelLoadRequested = false; // Track if model load has been requested
let lastBroadcastProgress = -1; // Throttle progress broadcasts

// Update extension badge to show loading status
function updateBadge(text, color = "#666666", title = "") {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (title) {
    chrome.action.setTitle({ title });
  }
}

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
    url: 'pages/offscreen.html',
    reasons: ['DOM_SCRAPING'], // We need DOM APIs for URL.createObjectURL
    justification: 'Load and run Transformers.js model which requires DOM APIs'
  });

  console.log("Offscreen document created successfully");

  // Request model load only once, with delay to ensure offscreen is ready
  if (!modelLoadRequested) {
    modelLoadRequested = true;
    updateBadge("...", "#FFA500", "Loading grammar model...");

    // Wait a moment for offscreen document to fully initialize
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("Requesting model load from offscreen...");
    sendLoadModelWithRetry(3);
  }
}

// Retry mechanism for sending loadModel message
function sendLoadModelWithRetry(retries) {
  chrome.runtime.sendMessage({ action: "loadModel" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Error requesting model load:", chrome.runtime.lastError.message);
      if (retries > 0) {
        console.log(`Retrying in 1s... (${retries} attempts left)`);
        setTimeout(() => sendLoadModelWithRetry(retries - 1), 1000);
      } else {
        updateBadge("!", "#DC3545", "Failed to load model");
        modelLoadRequested = false; // Reset on error
      }
    } else {
      console.log("Model load request sent successfully");
    }
  });
}

// Initialize offscreen document
setupOffscreenDocument().catch(error => {
  console.error("Error setting up offscreen document:", error);
  updateBadge("!", "#DC3545", "Offscreen setup error");
});

// Handle extension icon click - open full page app
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/app.html') });
});

// Listen for messages from offscreen document and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request, "from:", sender.url || sender.tab?.id);

  // Handle messages from offscreen document (identified by sender.url containing offscreen.html)
  if (sender.url && sender.url.includes('offscreen.html')) {
    if (request.type === "progressUpdate") {
      // Update badge with progress percentage
      const progress = request.progress || 0;
      if (request.status === "testing") {
        updateBadge("...", "#9C27B0", "Testing model...");
      } else if (progress < 100) {
        updateBadge(`${progress}%`, "#4A90E2", `Loading model: ${progress}%`);
      }

      // Throttle broadcasts - only send if progress changed by 5% or more (but always send "testing" status)
      if (request.status !== "testing" && Math.abs(progress - lastBroadcastProgress) < 5 && progress < 100) {
        return;
      }
      lastBroadcastProgress = progress;

      // Broadcast to all tabs (web pages + extension pages)
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
      // Show success badge
      updateBadge("✓", "#28A745", "Grammar model ready!");

      console.log("Model ready message received from offscreen, broadcasting to all tabs...");
      // Broadcast model ready to all tabs (including extension pages)
      chrome.tabs.query({}, (tabs) => {
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
      updateBadge("!", "#DC3545", `Error: ${request.error}`);
      console.error("Model error from offscreen:", request.error);
      return;
    }

    // If offscreen sends a response to a forwarded message, handle it
    if (request.type === "response") {
      // This shouldn't happen in normal flow
      return;
    }
  }

  // Handle messages from content script (identified by sender.tab) or extension pages (like app.html)
  const isFromExtensionPage = sender.url && sender.url.startsWith('chrome-extension://') && !sender.url.includes('offscreen.html');
  const isFromContentScript = !!sender.tab;

  if (isFromContentScript || isFromExtensionPage) {
    if (request.action === "correctGrammar" || request.action === "getModelStatus" || request.action === "loadModel") {
      // Forward to offscreen document using direct communication
      setupOffscreenDocument()
        .then(async () => {
          // Get offscreen document context
          const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
          });

          if (contexts.length === 0) {
            sendResponse({ error: "Offscreen document not found" });
            return;
          }

          // Send message directly to offscreen document
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
