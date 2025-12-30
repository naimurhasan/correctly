// Background service worker
console.log("Background service worker started");

let modelLoadRequested = false; // Track if model load has been requested

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
  
  // Request model load only once
  if (!modelLoadRequested) {
    modelLoadRequested = true;
    updateBadge("...", "#FFA500", "Loading grammar model...");
    console.log("Requesting model load from offscreen...");
    chrome.runtime.sendMessage({ action: "loadModel" }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Error requesting model load:", chrome.runtime.lastError.message);
        updateBadge("!", "#DC3545", "Failed to load model");
        modelLoadRequested = false; // Reset on error
      } else {
        console.log("Model load request sent successfully");
      }
    });
  }
}

// Initialize offscreen document
setupOffscreenDocument().catch(error => {
  console.error("Error setting up offscreen document:", error);
  updateBadge("!", "#DC3545", "Offscreen setup error");
});

// Listen for messages from offscreen document and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request, "from:", sender.url || sender.tab?.id);

  // Handle messages from offscreen document (identified by sender.url containing offscreen.html)
  if (sender.url && sender.url.includes('offscreen.html')) {
    if (request.type === "progressUpdate") {
      // Update badge with progress percentage
      const progress = request.progress || 0;
      if (progress < 100) {
        updateBadge(`${progress}%`, "#4A90E2", `Loading model: ${progress}%`);
      }
      
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
      // Show success badge
      updateBadge("✓", "#28A745", "Grammar model ready!");
      
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

  // Handle messages from content script (identified by sender.tab)
  if (sender.tab) {
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
